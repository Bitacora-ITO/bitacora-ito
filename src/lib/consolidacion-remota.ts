// Descarga y publicación del consolidado del turno (jefe de turno, semana 8).
// Todo pasa por una `FuenteConsolidacion`: la real usa Supabase (clave anon, como sync.ts) y la de
// memoria sirve para las pruebas (scripts/consolidacion) y para la demostración sin nube.
//
// En Supabase (migración 0002, «solo agrega»), una parte ENTREGADA es un `reporte` con `entregado_en`
// lleno (su estado remoto queda en 'aprobado'; «entregado» solo existe en el teléfono).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Clima, ColumnaAlerta, Criticidad, Turno } from "./types";
import type { CuerpoEnvio, RespuestaEnvio } from "./envio";
import type { Consolidacion, EntradaConsolidacion, ParteEntrada } from "./consolidar";
import { esDiaTrabajo } from "./rol";

// ───────────────────────── Filas remotas (snake_case, como en supabase/migrations) ─────────────────────────

export interface FilaContrato {
  id: string; nombre: string; numero: string | null; mandante: string; codigo_proyecto: string;
  codigo_interno: string | null; revision_formato: string; fecha_formato: string | null;
  prefijo_correlativo: string; ultimo_correlativo: number; destinatarios: string[];
}
export interface FilaUsuario { id: string; nombre: string; correo: string; rol: string; activo?: boolean | null; contrato_id?: string | null }
export interface FilaRolTurno { usuario_id: string; contrato_id: string; dias_trabajo: number; dias_descanso: number; fecha_inicio: string }
export interface FilaReporte {
  id: string; contrato_id: string; fecha: string; turno: Turno; correlativo: string; elaborado_por: string;
  clima_turno: Clima; clima_proyeccion: Clima; estado: string; entregado_en?: string | null; url_pdf?: string | null;
}
export interface FilaAreaTurno { id: string; reporte_id: string; frente_id: string; empresa_id: string; orden: number }
export interface FilaRegistro {
  id: string; reporte_id: string; area_turno_id: string; sin_actividad: boolean; descripcion: string; registrado_en: string;
}
export interface FilaAlerta {
  id: string; reporte_id: string; columna: ColumnaAlerta; empresa_id: string | null; area_turno_id: string | null;
  descripcion: string; criticidad: Criticidad; registrado_en: string;
}
export interface FilaFotografia {
  id: string; reporte_id: string | null; registro_id: string | null; alerta_id: string | null;
  ruta: string; url: string | null; orden: number; pie_foto: string | null; capturada_en: string;
}
export interface FilaFrente { id: string; nombre: string; orden: number }
export interface FilaEmpresa { id: string; nombre: string }
export interface FilaConsolidado {
  id: string; contrato_id: string; fecha: string; turno: Turno; correlativo: string; consolidado_por: string | null;
  partes: string[]; elaborado_por_texto: string; clima_turno: Clima; clima_proyeccion: Clima;
  estado: "borrador" | "generado" | "aprobado" | "enviado"; ruta_pdf: string | null; enviado_en: string | null;
}

export interface DetallePartes {
  areasTurno: FilaAreaTurno[];
  registros: FilaRegistro[];
  alertas: FilaAlerta[];
  fotografias: FilaFotografia[];
}

/** Lo que la consolidación necesita de la nube. Cada método lanza un Error con mensaje legible si falla. */
export interface FuenteConsolidacion {
  leerContrato(contratoId: string): Promise<FilaContrato | null>;
  leerUsuarios(contratoId: string): Promise<FilaUsuario[]>;
  leerRolesTurno(contratoId: string): Promise<FilaRolTurno[]>;
  leerReportesDelTurno(contratoId: string, fecha: string, turno: Turno): Promise<FilaReporte[]>;
  leerDetalle(reporteIds: string[]): Promise<DetallePartes>;
  leerCatalogo(contratoId: string): Promise<{ frentes: FilaFrente[]; empresas: FilaEmpresa[] }>;
  descargarFoto(url: string): Promise<Blob>;
  subirPdf(ruta: string, pdf: Blob): Promise<void>;
  guardarConsolidado(fila: FilaConsolidado): Promise<void>;
  /** Deja `contrato.ultimo_correlativo` en `n` si el actual es menor. */
  actualizarUltimoCorrelativo(contratoId: string, n: number): Promise<void>;
}

// ───────────────────────── Fuente Supabase ─────────────────────────

const BUCKET_FOTOS = "fotos";
const BUCKET_REPORTES = "reportes";

function falla(que: string, e: { message?: string } | null | undefined): Error {
  const m = e?.message ?? "error desconocido";
  const pista = /relation .*consolidado|consolidado.*does not exist|Could not find the table/i.test(m)
    ? " Falta aplicar la migración 0002 en Supabase."
    : "";
  return new Error(`No se pudo ${que}: ${m}.${pista}`);
}

export function fuenteSupabase(sb: SupabaseClient): FuenteConsolidacion {
  return {
    async leerContrato(id) {
      const { data, error } = await sb.from("contrato").select("*").eq("id", id).maybeSingle();
      if (error) throw falla("leer el contrato", error);
      return (data as FilaContrato | null) ?? null;
    },
    async leerUsuarios(contratoId) {
      const { data, error } = await sb.from("usuario").select("*");
      if (error) throw falla("leer los usuarios", error);
      const todos = (data ?? []) as FilaUsuario[];
      // `usuario.contrato_id` (0002) puede venir vacío en los usuarios antiguos: si nadie lo tiene, van todos.
      const delContrato = todos.filter((u) => u.contrato_id === contratoId);
      return delContrato.length ? delContrato : todos.filter((u) => !u.contrato_id);
    },
    async leerRolesTurno(contratoId) {
      const { data, error } = await sb.from("rol_turno").select("*").eq("contrato_id", contratoId);
      if (error) throw falla("leer los roles de turno", error);
      return (data ?? []) as FilaRolTurno[];
    },
    async leerReportesDelTurno(contratoId, fecha, turno) {
      const { data, error } = await sb.from("reporte").select("*").eq("contrato_id", contratoId).eq("fecha", fecha).eq("turno", turno);
      if (error) throw falla("leer las partes del turno", error);
      return (data ?? []) as FilaReporte[];
    },
    async leerDetalle(ids) {
      if (!ids.length) return { areasTurno: [], registros: [], alertas: [], fotografias: [] };
      const [at, rg, al, fo] = await Promise.all([
        sb.from("area_turno").select("*").in("reporte_id", ids),
        sb.from("registro").select("*").in("reporte_id", ids),
        sb.from("alerta").select("*").in("reporte_id", ids),
        sb.from("fotografia").select("*").in("reporte_id", ids),
      ]);
      for (const [q, nombre] of [[at, "las áreas del turno"], [rg, "los registros"], [al, "las alertas"], [fo, "las fotografías"]] as const) {
        if (q.error) throw falla(`leer ${nombre}`, q.error);
      }
      const fotos = ((fo.data ?? []) as FilaFotografia[]).map((f) => ({
        ...f, url: f.url || sb.storage.from(BUCKET_FOTOS).getPublicUrl(f.ruta).data.publicUrl,
      }));
      return {
        areasTurno: (at.data ?? []) as FilaAreaTurno[],
        registros: (rg.data ?? []) as FilaRegistro[],
        alertas: (al.data ?? []) as FilaAlerta[],
        fotografias: fotos,
      };
    },
    async leerCatalogo(contratoId) {
      const [fr, em] = await Promise.all([
        sb.from("frente").select("id, nombre, orden").eq("contrato_id", contratoId),
        sb.from("empresa").select("id, nombre").eq("contrato_id", contratoId),
      ]);
      if (fr.error) throw falla("leer las áreas del contrato", fr.error);
      if (em.error) throw falla("leer las empresas del contrato", em.error);
      return { frentes: (fr.data ?? []) as FilaFrente[], empresas: (em.data ?? []) as FilaEmpresa[] };
    },
    async descargarFoto(url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`No se pudo descargar una fotografía (${r.status}).`);
      return r.blob();
    },
    async subirPdf(ruta, pdf) {
      const { error } = await sb.storage.from(BUCKET_REPORTES).upload(ruta, pdf, { contentType: "application/pdf", upsert: true });
      if (error) throw falla("subir el PDF consolidado", error);
    },
    async guardarConsolidado(fila) {
      const { error } = await sb.from("consolidado").upsert(fila, { onConflict: "id" });
      if (error) throw falla("guardar el consolidado", error);
    },
    async actualizarUltimoCorrelativo(contratoId, n) {
      // Solo sube: si otro teléfono ya avanzó la serie, no se retrocede.
      const { error } = await sb.from("contrato").update({ ultimo_correlativo: n }).eq("id", contratoId).lt("ultimo_correlativo", n);
      if (error) throw falla("actualizar el correlativo del contrato", error);
    },
  };
}

// ───────────────────────── Fuente en memoria (pruebas y demostración) ─────────────────────────

export interface DatosEnMemoria {
  contrato: FilaContrato;
  usuarios: FilaUsuario[];
  roles?: FilaRolTurno[];
  reportes: FilaReporte[];
  areasTurno: FilaAreaTurno[];
  registros: FilaRegistro[];
  alertas: FilaAlerta[];
  fotografias: FilaFotografia[];
  frentes: FilaFrente[];
  empresas: FilaEmpresa[];
  /** Lo que se «escribió» (para revisar en las pruebas). */
  escrituras?: { tipo: string; datos: unknown }[];
}

export function fuenteEnMemoria(d: DatosEnMemoria): FuenteConsolidacion {
  const escribir = (tipo: string, datos: unknown) => { (d.escrituras ??= []).push({ tipo, datos }); };
  const en = <T extends { reporte_id: string | null }>(xs: T[], ids: string[]) => xs.filter((x) => x.reporte_id && ids.includes(x.reporte_id));
  return {
    leerContrato: async (id) => (d.contrato.id === id ? { ...d.contrato } : null),
    leerUsuarios: async () => d.usuarios,
    leerRolesTurno: async () => d.roles ?? [],
    leerReportesDelTurno: async (c, f, t) => d.reportes.filter((r) => r.contrato_id === c && r.fecha === f && r.turno === t),
    leerDetalle: async (ids) => ({
      areasTurno: en(d.areasTurno, ids), registros: en(d.registros, ids), alertas: en(d.alertas, ids), fotografias: en(d.fotografias, ids),
    }),
    leerCatalogo: async () => ({ frentes: d.frentes, empresas: d.empresas }),
    descargarFoto: async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`No se pudo descargar la foto ${url} (${r.status}).`);
      return r.blob();
    },
    subirPdf: async (ruta, pdf) => escribir("pdf", { ruta, bytes: pdf.size }),
    guardarConsolidado: async (fila) => escribir("consolidado", fila),
    actualizarUltimoCorrelativo: async (_c, n) => {
      if (d.contrato.ultimo_correlativo < n) d.contrato.ultimo_correlativo = n;
      escribir("correlativo", n);
    },
  };
}

/**
 * Fuente para la pantalla del jefe de turno: la de memoria si la página dejó datos de demostración en
 * `window.__bitacoraDemoConsolidacion` (solo pruebas locales), si no Supabase, o null sin nube.
 */
export function fuenteParaPantalla(sb: SupabaseClient | null): FuenteConsolidacion | null {
  if (typeof window !== "undefined") {
    const demo = (window as unknown as { __bitacoraDemoConsolidacion?: DatosEnMemoria }).__bitacoraDemoConsolidacion;
    if (demo) return fuenteEnMemoria(demo);
  }
  return sb ? fuenteSupabase(sb) : null;
}

// ───────────────────────── Estado del turno (lista de partes) ─────────────────────────

export interface ResumenParte {
  reporteId: string;
  inspectorId: string;
  inspector: string;
  /** true si el inspector tocó «Entregar al jefe de turno» (`entregado_en` lleno). */
  entregado: boolean;
  entregadoEn?: string;
  /** Estado remoto del reporte, para las partes aún no entregadas. */
  estado: string;
  areas: number;
  registros: number;
  alertas: number;
  fotos: number;
}

export interface InspectorPendiente {
  id: string;
  nombre: string;
  /** "pendiente": día de trabajo sin entrega; "descanso": su rol 7x7 dice que hoy descansa. */
  motivo: "pendiente" | "descanso";
  /** Si su parte está en la nube pero sin entregar: "borrador", "generado" o "aprobado". */
  estadoParte?: string;
}

export interface EstadoTurno {
  contrato: FilaContrato;
  partes: ResumenParte[];
  pendientes: InspectorPendiente[];
}

const PARTE_VISIBLE = new Set(["generado", "aprobado", "entregado", "enviado"]);

/** Partes del contrato, fecha y turno (entregadas y en preparación) e inspectores que aún no entregan. */
export async function leerEstadoTurno(f: FuenteConsolidacion, contratoId: string, fecha: string, turno: Turno): Promise<EstadoTurno> {
  const [contrato, usuarios, roles, reportes] = await Promise.all([
    f.leerContrato(contratoId), f.leerUsuarios(contratoId), f.leerRolesTurno(contratoId), f.leerReportesDelTurno(contratoId, fecha, turno),
  ]);
  if (!contrato) throw new Error("El contrato de este teléfono no está en la nube. Sincroniza desde un teléfono con el contrato cargado.");
  const nombre = new Map(usuarios.map((u) => [u.id, u.nombre]));
  // Partes con contenido: entregadas, o con PDF generado/aprobado (se muestran para que el jefe sepa en qué van).
  const visibles = reportes.filter((r) => r.entregado_en || PARTE_VISIBLE.has(r.estado));
  const det = await f.leerDetalle(visibles.map((r) => r.id));
  const cuenta = <T extends { reporte_id: string | null }>(xs: T[], id: string) => xs.filter((x) => x.reporte_id === id).length;
  const partes: ResumenParte[] = visibles.map((r) => ({
    reporteId: r.id,
    inspectorId: r.elaborado_por,
    inspector: nombre.get(r.elaborado_por) ?? "Inspector sin nombre",
    entregado: Boolean(r.entregado_en),
    entregadoEn: r.entregado_en ?? undefined,
    estado: r.entregado_en ? "entregado" : r.estado,
    areas: cuenta(det.areasTurno, r.id),
    registros: cuenta(det.registros, r.id),
    alertas: cuenta(det.alertas, r.id),
    fotos: cuenta(det.fotografias, r.id),
  }));
  partes.sort((a, b) => Number(b.entregado) - Number(a.entregado) || (a.entregadoEn ?? "").localeCompare(b.entregadoEn ?? "") || a.inspector.localeCompare(b.inspector, "es"));

  const entregaron = new Set(partes.filter((p) => p.entregado).map((p) => p.inspectorId));
  const pendientes: InspectorPendiente[] = usuarios
    .filter((u) => u.rol === "inspector" && u.activo !== false && !entregaron.has(u.id))
    .map((u) => {
      const rol = roles.find((x) => x.usuario_id === u.id);
      const descansa = rol ? !esDiaTrabajo(fecha, { diasTrabajo: rol.dias_trabajo, diasDescanso: rol.dias_descanso, fechaInicio: rol.fecha_inicio }) : false;
      const suya = reportes.find((r) => r.elaborado_por === u.id);
      return { id: u.id, nombre: u.nombre, motivo: descansa && !suya ? "descanso" as const : "pendiente" as const, estadoParte: suya?.estado };
    })
    .sort((a, b) => (a.motivo === b.motivo ? a.nombre.localeCompare(b.nombre, "es") : a.motivo === "pendiente" ? -1 : 1));
  return { contrato, partes, pendientes };
}

// ───────────────────────── Descarga de las partes elegidas ─────────────────────────

export interface PartesDescargadas {
  entrada: EntradaConsolidacion;
  /** Imágenes ya descargadas, por id de fotografía (para el PDF y el paquete .zip). */
  fotos: Map<string, Blob>;
  /** Fotos que no se pudieron bajar (el consolidado sigue; se avisa). */
  fotosFallidas: number;
  destinatarios: string[];
  mandante: string;
}

export async function descargarPartes(
  f: FuenteConsolidacion, contratoId: string, fecha: string, turno: Turno, reporteIds: string[],
  alAvanzar?: (texto: string) => void,
): Promise<PartesDescargadas> {
  alAvanzar?.("Leyendo las partes…");
  const [contrato, usuarios, reportes, catalogo] = await Promise.all([
    f.leerContrato(contratoId), f.leerUsuarios(contratoId), f.leerReportesDelTurno(contratoId, fecha, turno), f.leerCatalogo(contratoId),
  ]);
  if (!contrato) throw new Error("No se encontró el contrato en la nube.");
  const elegidos = reportes.filter((r) => reporteIds.includes(r.id));
  if (!elegidos.length) throw new Error("No hay partes para consolidar.");
  const det = await f.leerDetalle(elegidos.map((r) => r.id));
  const nombre = new Map(usuarios.map((u) => [u.id, u.nombre]));

  // Fotos: se bajan una vez (de a 4) y se reutilizan para el PDF y el paquete.
  const fotos = new Map<string, Blob>();
  let fallidas = 0;
  const lista = det.fotografias.filter((x) => x.url);
  for (let i = 0; i < lista.length; i += 4) {
    alAvanzar?.(`Descargando fotografías (${Math.min(i + 4, lista.length)} de ${lista.length})…`);
    await Promise.all(lista.slice(i, i + 4).map(async (x) => {
      try { fotos.set(x.id, await f.descargarFoto(x.url!)); } catch { fallidas++; }
    }));
  }

  const partes: ParteEntrada[] = elegidos.map((r) => ({
    reporteId: r.id,
    inspector: { id: r.elaborado_por, nombre: nombre.get(r.elaborado_por) ?? "Inspector" },
    climaTurno: r.clima_turno,
    climaProyeccion: r.clima_proyeccion,
    entregadoEn: r.entregado_en ?? undefined,
    areasTurno: det.areasTurno.filter((x) => x.reporte_id === r.id).map((x) => ({ id: x.id, areaId: x.frente_id, empresaId: x.empresa_id, orden: x.orden })),
    registros: det.registros.filter((x) => x.reporte_id === r.id).map((x) => ({
      id: x.id, areaTurnoId: x.area_turno_id, sinActividad: x.sin_actividad, descripcion: x.descripcion ?? "", registradoEn: x.registrado_en,
    })),
    alertas: det.alertas.filter((x) => x.reporte_id === r.id).map((x) => ({
      id: x.id, columna: x.columna, empresaId: x.empresa_id ?? undefined, areaTurnoId: x.area_turno_id ?? undefined,
      descripcion: x.descripcion, criticidad: x.criticidad, registradoEn: x.registrado_en,
    })),
    fotografias: det.fotografias.filter((x) => x.reporte_id === r.id && fotos.has(x.id)).map((x) => ({
      id: x.id, registroId: x.registro_id ?? undefined, alertaId: x.alerta_id ?? undefined, url: x.url ?? "",
      orden: x.orden, pieFoto: x.pie_foto ?? undefined, capturadaEn: x.capturada_en,
    })),
  }));

  return {
    entrada: {
      contrato: {
        nombre: contrato.nombre, numero: contrato.numero ?? "", codigoInterno: contrato.codigo_interno ?? "",
        codigoProyecto: contrato.codigo_proyecto, revisionFormato: contrato.revision_formato,
        fechaFormato: contrato.fecha_formato ?? "", prefijoCorrelativo: contrato.prefijo_correlativo,
        ultimoCorrelativo: contrato.ultimo_correlativo,
      },
      fecha, turno,
      areas: catalogo.frentes.map((x) => ({ id: x.id, nombre: x.nombre })),
      empresas: catalogo.empresas.map((x) => ({ id: x.id, nombre: x.nombre })),
      partes,
    },
    fotos,
    fotosFallidas: fallidas,
    destinatarios: contrato.destinatarios ?? [],
    mandante: contrato.mandante,
  };
}

// ───────────────────────── Aprobar y enviar ─────────────────────────

/** Ruta del PDF consolidado en el bucket `reportes` (la API /api/enviar la acepta tal cual). */
export function rutaPdfConsolidado(fecha: string, id: string): string {
  return `consolidados/${fecha}/${id}.pdf`;
}

/** Cuerpo para /api/enviar (el mismo contrato que usaba el inspector; `reporte.id` = id del consolidado). */
export function cuerpoConsolidado(
  c: Consolidacion, id: string, destinatarios: string[], ruta: string, mandante?: string, resumen?: string,
): CuerpoEnvio {
  const numero = String(c.numero).padStart(5, "0");
  return {
    destinatarios,
    reporte: {
      id,
      correlativo: c.correlativo,
      numero,
      fecha: c.fecha,
      turno: c.turno,
      elaboradoPor: c.elaboradoPor,
      contrato: c.contrato.nombre,
      numeroContrato: c.contrato.numero,
      mandante,
      codigoProyecto: c.contrato.codigoProyecto,
      resumen,
      areas: c.totales.areas,
      registros: c.totales.registros,
      sinActividad: c.totales.sinActividad,
      alertas: c.totales.alertas,
      alertasAltas: c.totales.alertasAltas,
      fotos: c.totales.fotos,
    },
    pdf: { nombre: `Reporte diario ${numero} ${c.fecha} turno ${c.turno === "dia" ? "día" : "noche"}.pdf`, ruta },
  };
}

export interface PedidoEnvio {
  id: string; // id del consolidado
  contratoId: string;
  consolidadoPor: string;
  consolidacion: Consolidacion;
  pdf: Blob;
  destinatarios: string[];
  mandante?: string;
  /** Llamada a /api/enviar (lib/envio.ts → enviarCuerpoAlMandante); se inyecta para poder simularla. */
  enviar: (cuerpo: CuerpoEnvio) => Promise<RespuestaEnvio>;
}

export type ResultadoEnvioConsolidado =
  | { ok: true; ruta: string; enviadoEn: string }
  | { ok: false; error: string; ruta?: string; sinRed?: boolean };

/**
 * «Aprobar y enviar al mandante»:
 *  1. sube el PDF a `reportes/consolidados/<fecha>/<id>.pdf`;
 *  2. guarda la fila en `consolidado` (aprobado);
 *  3. avanza `contrato.ultimo_correlativo` al número usado;
 *  4. llama a /api/enviar con la ruta del PDF;
 *  5. si el correo sale, deja el consolidado `enviado` con la hora.
 * Si algo falla, devuelve el error y se puede reintentar: cada paso sobrescribe (upsert) sin duplicar.
 */
export async function aprobarYEnviar(f: FuenteConsolidacion, p: PedidoEnvio): Promise<ResultadoEnvioConsolidado> {
  const c = p.consolidacion;
  const ruta = rutaPdfConsolidado(c.fecha, p.id);
  const fila: FilaConsolidado = {
    id: p.id, contrato_id: p.contratoId, fecha: c.fecha, turno: c.turno, correlativo: c.correlativo,
    consolidado_por: p.consolidadoPor || null, partes: c.partes.map((x) => x.reporteId),
    elaborado_por_texto: c.elaboradoPor, clima_turno: c.climaTurno, clima_proyeccion: c.climaProyeccion,
    estado: "aprobado", ruta_pdf: ruta, enviado_en: null,
  };
  try {
    await f.subirPdf(ruta, p.pdf);
    await f.guardarConsolidado(fila);
    await f.actualizarUltimoCorrelativo(p.contratoId, c.numero);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const destinatarios = p.destinatarios.map((d) => d.trim()).filter(Boolean);
  if (!destinatarios.length) return { ok: false, ruta, error: "El contrato no tiene destinatarios configurados." };
  const r = await p.enviar(cuerpoConsolidado(c, p.id, destinatarios, ruta, p.mandante));
  if (!r.ok) return { ok: false, ruta, error: r.error, sinRed: r.sinRed };
  const enviadoEn = new Date().toISOString();
  try {
    await f.guardarConsolidado({ ...fila, estado: "enviado", enviado_en: enviadoEn });
  } catch { /* el correo ya salió: en la nube queda «aprobado»; en el teléfono sí queda «enviado» */ }
  return { ok: true, ruta, enviadoEn };
}

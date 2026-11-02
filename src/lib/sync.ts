// Sincronización con Supabase: sube lo que tenga `sincronizadoEn` vacío.
// CONTRATO: nunca bloquea la app ni lanza errores hacia la interfaz; si algo falla, se reintenta después.
//
// Orden (por las llaves foráneas de la base remota):
//   1. catálogos del contrato (usuario, contrato, empresa, frente, rol_turno), solo si cambiaron;
//   2. reportes pendientes;
//   3. áreas del turno de los reportes que cambiaron;
//   4. registros, alertas y fotografías pendientes (las imágenes van al bucket `fotos`);
//   5. limpieza remota de lo que se borró en el teléfono (áreas, registros, alertas y fotos quitadas);
//   6. PDF de los reportes (bucket `reportes`) y envíos.
//
// `AreaTurno` no tiene `sincronizadoEn` y los cambios de un borrador no siempre marcan el reporte;
// por eso se guarda en `ajustes` una «huella» de cada reporte (sus hijos) y se compara en cada pasada.
import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "./db";
import { hayRed } from "./nativo";
import { BUCKET_FOTOS, BUCKET_REPORTES, obtenerSupabase, rutaFoto, rutaPdfReporte } from "./supabase";
import { aFilaContrato, aFilaEmpresa, aFilaFrente, aFilaUsuario } from "./catalogo";
import type {
  Alerta, Area, AreaTurno, Contrato, Empresa, Envio, Fotografia, Registro, Reporte, RolTurno, Usuario,
} from "./types";

export interface EstadoSync {
  pendientes: number;
  ultimaSync?: string;
  error?: string;
}

const CLAVE_ULTIMA = "sync.ultimaSync";
const CLAVE_CATALOGOS = "sync.huellaCatalogos";
const CLAVE_HUELLAS = "sync.huellasReportes";

let enCurso: Promise<EstadoSync> | null = null;

/** Sube a Supabase los reportes, áreas del turno, registros, alertas, fotos, PDF y envíos pendientes. */
export function sincronizar(): Promise<EstadoSync> {
  if (typeof window === "undefined") return Promise.resolve({ pendientes: 0 });
  // Si ya hay una pasada en curso (p. ej. al volver la red y al abrir la app a la vez), se reutiliza.
  if (!enCurso) {
    enCurso = ejecutar()
      .catch(async (e): Promise<EstadoSync> => ({ pendientes: await contarPendientes(), error: mensaje(e) }))
      .finally(() => { enCurso = null; });
  }
  return enCurso;
}

/** Cantidad de elementos locales aún no sincronizados. */
export async function contarPendientes(): Promise<number> {
  if (typeof window === "undefined" || !db) return 0;
  try {
    const sin = <T extends { sincronizadoEn?: string }>(x: T) => !x.sincronizadoEn;
    const [r, g, a, f, e, p] = await Promise.all([
      db.reportes.filter(sin).count(),
      db.registros.filter(sin).count(),
      db.alertas.filter(sin).count(),
      db.fotografias.filter(sin).count(),
      db.envios.filter(sin).count(),
      db.pdfs.filter((x) => !x.urlRemota).count(),
    ]);
    return r + g + a + f + e + p;
  } catch {
    return 0;
  }
}

/**
 * Sube el PDF del reporte al bucket `reportes` (si no estaba ya) y devuelve su ruta, o null si no se pudo.
 * La usa también lib/envio.ts para mandar al servidor una ruta en vez del archivo (límite de Vercel).
 */
export async function subirPdf(reporteId: string): Promise<string | null> {
  const sb = obtenerSupabase();
  if (!sb || typeof window === "undefined") return null;
  try {
    const [pdf, reporte] = await Promise.all([db.pdfs.get(reporteId), db.reportes.get(reporteId)]);
    if (!pdf || !reporte) return null;
    if (pdf.urlRemota) return pdf.urlRemota;
    const ruta = rutaPdfReporte(reporte);
    const { error } = await sb.storage.from(BUCKET_REPORTES).upload(ruta, pdf.pdf, { contentType: "application/pdf", upsert: true });
    if (error) throw error;
    // Solo se marca si el PDF local sigue siendo el mismo que se subió.
    await db.transaction("rw", db.pdfs, async () => {
      const actual = await db.pdfs.get(reporteId);
      if (actual && actual.generadoEn === pdf.generadoEn) await db.pdfs.update(reporteId, { urlRemota: ruta });
    });
    // Si el reporte ya existe en la nube, se le anota la ruta (si aún no existe, se anota al sincronizarlo).
    await sb.from("reporte").update({ url_pdf: ruta }).eq("id", reporteId);
    return ruta;
  } catch {
    return null;
  }
}

// ───────────────────────── Pasada de sincronización ─────────────────────────

async function ejecutar(): Promise<EstadoSync> {
  const sb = obtenerSupabase();
  if (!sb) return { pendientes: await contarPendientes() }; // sin Supabase configurado: la app sigue local
  const ultimaPrevia = (await db.ajustes.get(CLAVE_ULTIMA))?.valor;
  if (!(await hayRed())) return { pendientes: await contarPendientes(), ultimaSync: ultimaPrevia, error: "Sin conexión" };

  const errores: string[] = [];
  const paso = async (nombre: string, f: () => Promise<void>) => {
    try {
      await f();
    } catch (e) {
      errores.push(`${nombre}: ${mensaje(e)}`);
    }
  };

  await paso("catálogos", () => subirCatalogos(sb));
  // Sin catálogos no se puede subir nada que dependa de ellos (llaves foráneas).
  if (errores.length === 0) {
    const huellasPrevias = leerJson<Record<string, string>>((await db.ajustes.get(CLAVE_HUELLAS))?.valor) ?? {};
    const huellas = await calcularHuellas();
    const cambiados = Object.keys(huellas).filter((id) => huellas[id] !== huellasPrevias[id]);

    await paso("reportes", async () => {
      // La ruta del PDF va con el reporte (si el PDF subió antes que el reporte, aquí queda anotada).
      const rutas = new Map((await db.pdfs.toArray()).filter((p) => p.urlRemota).map((p) => [p.reporteId, p.urlRemota!]));
      await subirPendientes(sb, "reporte", db.reportes, (r) => ({ ...aReporte(r), url_pdf: rutas.get(r.id) ?? null }));
    });
    await paso("áreas del turno", () => subirAreasTurno(sb, cambiados));
    await paso("registros", () => subirPendientes(sb, "registro", db.registros, aRegistro));
    await paso("alertas", () => subirPendientes(sb, "alerta", db.alertas, aAlerta));
    await paso("fotografías", () => subirFotos(sb));
    const sinErrorEnHijos = errores.length === 0;
    if (sinErrorEnHijos) await paso("limpieza", () => limpiarBorrados(sb, cambiados));
    await paso("PDF", () => subirPdfs());
    await paso("envíos", () => subirPendientes(sb, "envio", db.envios, aEnvio));

    // Las huellas se guardan solo si todo lo del reporte quedó arriba; si no, se repite la próxima vez.
    if (errores.length === 0) await db.ajustes.put({ clave: CLAVE_HUELLAS, valor: JSON.stringify(huellas) });
  }

  const pendientes = await contarPendientes();
  if (errores.length) return { pendientes, ultimaSync: ultimaPrevia, error: errores.join(" · ") };
  const ahora = new Date().toISOString();
  await db.ajustes.put({ clave: CLAVE_ULTIMA, valor: ahora });
  return { pendientes, ultimaSync: ahora };
}

// ───────────────────────── Catálogos ─────────────────────────

async function subirCatalogos(sb: SupabaseClient): Promise<void> {
  const [usuarios, contratos, empresas, areas, roles] = await Promise.all([
    db.usuarios.toArray(), db.contratos.toArray(), db.empresas.toArray(), db.areas.toArray(), db.rolesTurno.toArray(),
  ]);
  const huella = huellaDe([usuarios, contratos, empresas, areas, roles]);
  if ((await db.ajustes.get(CLAVE_CATALOGOS))?.valor === huella) return;
  await asegurarCatalogoRemoto(sb, { usuarios, contratos, empresas, areas });
  await upsert(sb, "rol_turno", roles.map(aRolTurno));
  await db.ajustes.put({ clave: CLAVE_CATALOGOS, valor: huella });
}

/**
 * Catálogo remoto (semana 8): antes de subir reportes, crea en Supabase el contrato, los usuarios,
 * las empresas y las áreas que aún no existan (las llaves foráneas lo exigen). Solo inserta lo que
 * falta (`on conflict do nothing`): lo que ya está arriba lo maneja el administrador al publicar el
 * catálogo (lib/catalogo.ts), y un teléfono con el catálogo desactualizado no debe pisarlo
 * (por ejemplo, volver a dejar vigente un área dada de baja).
 */
async function asegurarCatalogoRemoto(
  sb: SupabaseClient,
  local: { usuarios: Usuario[]; contratos: Contrato[]; empresas: Empresa[]; areas: Area[] },
): Promise<void> {
  const contratoDe = (contratoId?: string) => contratoId ?? (local.contratos.length === 1 ? local.contratos[0].id : undefined);
  const pasos: [string, Fila[]][] = [
    ["contrato", local.contratos.map(aFilaContrato)],
    ["usuario", local.usuarios.map((u) => aFilaUsuario(u, contratoDe(u.contratoId)))],
    ["empresa", local.empresas.map(aFilaEmpresa)],
    ["frente", local.areas.map(aFilaFrente)],
  ];
  for (const [tabla, filas] of pasos) {
    for (let i = 0; i < filas.length; i += 200) {
      const { error } = await sb.from(tabla).upsert(filas.slice(i, i + 200), { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    }
  }
}

// ───────────────────────── Tablas con `sincronizadoEn` ─────────────────────────

type ConSync = { id: string; sincronizadoEn?: string };

async function subirPendientes<T extends ConSync>(
  sb: SupabaseClient,
  tabla: string,
  local: import("dexie").Table<T, string>,
  mapear: (x: T) => Fila,
): Promise<void> {
  const pendientes = await local.filter((x) => !x.sincronizadoEn).toArray();
  if (!pendientes.length) return;
  const subidos = await upsert(sb, tabla, pendientes.map(mapear));
  await marcar(local, pendientes.filter((p) => subidos.has(p.id)));
  if (subidos.size < pendientes.length) throw new Error(`${pendientes.length - subidos.size} filas de ${tabla} no se pudieron subir`);
}

/** Marca como sincronizado solo si el registro local no cambió mientras se subía. */
async function marcar<T extends ConSync>(local: import("dexie").Table<T, string>, subidos: T[]): Promise<void> {
  if (!subidos.length) return;
  const ahora = new Date().toISOString();
  await db.transaction("rw", local, async () => {
    for (const s of subidos) {
      const actual = await local.get(s.id);
      if (actual && huellaDe(sinBinarios(actual)) === huellaDe(sinBinarios(s))) {
        await local.update(s.id, { sincronizadoEn: ahora } as never);
      }
    }
  });
}

async function subirAreasTurno(sb: SupabaseClient, reportesCambiados: string[]): Promise<void> {
  if (!reportesCambiados.length) return;
  // Solo hijos de reportes que ya existen arriba: el historial de demostración se siembra marcado
  // como sincronizado y nunca se sube, así que sus áreas del turno violarían la llave foránea.
  const remotos: string[] = [];
  for (let i = 0; i < reportesCambiados.length; i += 100) {
    const { data, error } = await sb.from("reporte").select("id").in("id", reportesCambiados.slice(i, i + 100));
    if (error) throw error;
    for (const r of data ?? []) remotos.push(r.id as string);
  }
  if (!remotos.length) return;
  const ats = await db.areasTurno.where("reporteId").anyOf(remotos).toArray();
  const subidos = await upsert(sb, "area_turno", ats.map(aAreaTurno));
  if (subidos.size < ats.length) throw new Error(`${ats.length - subidos.size} áreas del turno no se pudieron subir`);
}

async function subirFotos(sb: SupabaseClient): Promise<void> {
  const pendientes = await db.fotografias.filter((f) => !f.sincronizadoEn).toArray();
  let fallidas = 0;
  for (const f of pendientes) {
    try {
      const reporteId = await reporteDeFoto(f);
      const ruta = rutaFoto(f.id, reporteId);
      const subida = await sb.storage.from(BUCKET_FOTOS).upload(ruta, f.imagen, { contentType: f.imagen.type || "image/jpeg", upsert: true });
      if (subida.error) throw subida.error;
      const url = sb.storage.from(BUCKET_FOTOS).getPublicUrl(ruta).data.publicUrl;
      const { error } = await sb.from("fotografia").upsert(aFotografia(f, ruta, url, reporteId), { onConflict: "id" });
      if (error) throw error;
      await db.transaction("rw", db.fotografias, async () => {
        const actual = await db.fotografias.get(f.id);
        if (actual && huellaDe(sinBinarios(actual)) === huellaDe(sinBinarios(f))) {
          await db.fotografias.update(f.id, { urlRemota: url, sincronizadoEn: new Date().toISOString() });
        }
      });
    } catch {
      fallidas++;
    }
  }
  if (fallidas) throw new Error(`${fallidas} fotografías no se pudieron subir`);
}

async function reporteDeFoto(f: Fotografia): Promise<string | undefined> {
  if (f.registroId) return (await db.registros.get(f.registroId))?.reporteId;
  if (f.alertaId) return (await db.alertas.get(f.alertaId))?.reporteId;
  return undefined;
}

async function subirPdfs(): Promise<void> {
  const pendientes = await db.pdfs.filter((p) => !p.urlRemota).toArray();
  let fallidos = 0;
  for (const p of pendientes) if (!(await subirPdf(p.reporteId))) fallidos++;
  if (fallidos) throw new Error(`${fallidos} PDF no se pudieron subir`);
}

/** Borra en la nube las áreas, registros, alertas y fotos que ya no existen en el teléfono. */
async function limpiarBorrados(sb: SupabaseClient, reportesCambiados: string[]): Promise<void> {
  for (const reporteId of reportesCambiados) {
    const [ats, regs, als] = await Promise.all([
      db.areasTurno.where("reporteId").equals(reporteId).primaryKeys(),
      db.registros.where("reporteId").equals(reporteId).primaryKeys(),
      db.alertas.where("reporteId").equals(reporteId).primaryKeys(),
    ]);
    const fotos = [
      ...(regs.length ? await db.fotografias.where("registroId").anyOf(regs).primaryKeys() : []),
      ...(als.length ? await db.fotografias.where("alertaId").anyOf(als).primaryKeys() : []),
    ];
    // Hijos primero (llaves foráneas): fotografía → registro / alerta → área del turno.
    await borrarFaltantes(sb, "fotografia", reporteId, fotos);
    await borrarFaltantes(sb, "registro", reporteId, regs);
    await borrarFaltantes(sb, "alerta", reporteId, als);
    await borrarFaltantes(sb, "area_turno", reporteId, ats);
  }
}

async function borrarFaltantes(sb: SupabaseClient, tabla: string, reporteId: string, idsLocales: string[]): Promise<void> {
  let q = sb.from(tabla).delete().eq("reporte_id", reporteId);
  if (idsLocales.length) q = q.not("id", "in", `(${idsLocales.join(",")})`);
  const { error } = await q;
  if (error) throw error;
}

/** Huella de cada reporte: sus áreas del turno (con empresa y orden) y los ids de registros, alertas y fotos. */
async function calcularHuellas(): Promise<Record<string, string>> {
  const [ats, regs, als, fotos] = await Promise.all([
    db.areasTurno.toArray(), db.registros.toArray(), db.alertas.toArray(), db.fotografias.toArray(),
  ]);
  const regAReporte = new Map(regs.map((r) => [r.id, r.reporteId]));
  const alAReporte = new Map(als.map((a) => [a.id, a.reporteId]));
  const partes = new Map<string, string[]>();
  const agregar = (rep: string | undefined, s: string) => {
    if (!rep) return;
    const l = partes.get(rep) ?? [];
    l.push(s);
    partes.set(rep, l);
  };
  for (const a of ats) agregar(a.reporteId, `t:${a.id}:${a.areaId}:${a.empresaId}:${a.orden}`);
  for (const r of regs) agregar(r.reporteId, `r:${r.id}`);
  for (const a of als) agregar(a.reporteId, `a:${a.id}`);
  for (const f of fotos) agregar(f.registroId ? regAReporte.get(f.registroId) : f.alertaId ? alAReporte.get(f.alertaId) : undefined, `f:${f.id}`);
  for (const r of await db.reportes.toCollection().primaryKeys()) if (!partes.has(r)) partes.set(r, []);
  const out: Record<string, string> = {};
  for (const [rep, l] of partes) out[rep] = l.sort().join("|");
  return out;
}

// ───────────────────────── Subida por lotes ─────────────────────────

type Fila = Record<string, unknown> & { id: string };

/** Upsert por lotes; si un lote falla, se reintenta fila por fila. Devuelve los ids que sí subieron. */
async function upsert(sb: SupabaseClient, tabla: string, filas: Fila[]): Promise<Set<string>> {
  const ok = new Set<string>();
  let primerError: unknown = null;
  for (let i = 0; i < filas.length; i += 200) {
    const lote = filas.slice(i, i + 200);
    const { error } = await sb.from(tabla).upsert(lote, { onConflict: "id" });
    if (!error) {
      lote.forEach((f) => ok.add(f.id));
      continue;
    }
    for (const f of lote) {
      const r = await sb.from(tabla).upsert(f, { onConflict: "id" });
      if (r.error) primerError ??= r.error;
      else ok.add(f.id);
    }
  }
  if (ok.size === 0 && filas.length && primerError) throw primerError;
  return ok;
}

// ───────────────────────── Conversión a la base remota (snake_case) ─────────────────────────

const nulo = <T>(v: T | undefined) => (v === undefined ? null : v);

const aUsuario = (u: Usuario): Fila => ({ id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol });

const aContrato = (c: Contrato): Fila => ({
  id: c.id, nombre: c.nombre, numero: c.numero, mandante: c.mandante, codigo_proyecto: c.codigoProyecto,
  codigo_interno: c.codigoInterno, revision_formato: c.revisionFormato, fecha_formato: c.fechaFormato,
  prefijo_correlativo: c.prefijoCorrelativo, ultimo_correlativo: c.ultimoCorrelativo,
  destinatarios: c.destinatarios, hora_cierre_turno_dia: c.horaCierreTurnoDia,
});

const aEmpresa = (e: Empresa): Fila => ({ id: e.id, contrato_id: e.contratoId, nombre: e.nombre, tipo: e.tipo });

const aFrente = (a: Area): Fila => ({ id: a.id, contrato_id: a.contratoId, nombre: a.nombre, orden: a.orden, vigente: a.vigente });

const aRolTurno = (r: RolTurno): Fila => ({
  id: r.id, usuario_id: r.usuarioId, contrato_id: r.contratoId, dias_trabajo: r.diasTrabajo,
  dias_descanso: r.diasDescanso, fecha_inicio: r.fechaInicio,
});

/**
 * «Entregado al jefe de turno» no es un estado de la base remota (migración 0002, «solo agrega»):
 * en Supabase la parte entregada queda `aprobado` con `entregado_en` lleno. Si el inspector vuelve
 * a editar (el reporte pasa a borrador), `entregado_en` se limpia y la parte deja de estar entregada.
 */
const aReporte = (r: Reporte): Fila => ({
  id: r.id, contrato_id: r.contratoId, fecha: r.fecha, turno: r.turno, correlativo: r.correlativo,
  elaborado_por: r.elaboradoPor, clima_turno: r.climaTurno, clima_proyeccion: r.climaProyeccion,
  estado: estadoRemoto(r.estado),
  entregado_en: r.estado === "entregado" ? r.entregadoEn ?? new Date().toISOString() : null,
  resumen_turno: nulo(r.resumenTurno), hora_generacion: nulo(r.horaGeneracion), hora_aprobacion: nulo(r.horaAprobacion),
  aprobado_por: nulo(r.aprobadoPor), sincronizado_en: new Date().toISOString(),
});

/** Estado que acepta la regla `reporte_estado_check` remota (no incluye «entregado»). */
export function estadoRemoto(estado: Reporte["estado"]): Exclude<Reporte["estado"], "entregado"> {
  return estado === "entregado" ? "aprobado" : estado;
}

/**
 * Lo que falta subir de un reporte (para la pantalla de entrega): el reporte, sus registros,
 * alertas y fotos sin `sincronizadoEn`, y el PDF sin ruta remota. 0 = la parte ya está en la nube.
 */
export async function pendientesDeReporte(reporteId: string): Promise<number> {
  if (typeof window === "undefined" || !db) return 0;
  const [reporte, pdf, regs, als] = await Promise.all([
    db.reportes.get(reporteId),
    db.pdfs.get(reporteId),
    db.registros.where("reporteId").equals(reporteId).toArray(),
    db.alertas.where("reporteId").equals(reporteId).toArray(),
  ]);
  const ids = regs.map((r) => r.id), idsAl = als.map((a) => a.id);
  const fotos = [
    ...(ids.length ? await db.fotografias.where("registroId").anyOf(ids).toArray() : []),
    ...(idsAl.length ? await db.fotografias.where("alertaId").anyOf(idsAl).toArray() : []),
  ];
  return (reporte && !reporte.sincronizadoEn ? 1 : 0) + (pdf && !pdf.urlRemota ? 1 : 0) +
    regs.filter((r) => !r.sincronizadoEn).length + als.filter((a) => !a.sincronizadoEn).length +
    fotos.filter((f) => !f.sincronizadoEn).length;
}

const aAreaTurno = (a: AreaTurno): Fila => ({
  id: a.id, reporte_id: a.reporteId, frente_id: a.areaId, empresa_id: a.empresaId, orden: a.orden, agregada_en: a.agregadaEn,
});

const aRegistro = (r: Registro): Fila => ({
  id: r.id, reporte_id: r.reporteId, area_turno_id: r.areaTurnoId, sin_actividad: r.sinActividad,
  descripcion: r.descripcion, origen_descripcion: r.origenDescripcion, latitud: nulo(r.latitud), longitud: nulo(r.longitud),
  registrado_en: r.registradoEn, sincronizado_en: new Date().toISOString(),
});

const aAlerta = (a: Alerta): Fila => ({
  id: a.id, reporte_id: a.reporteId, columna: a.columna, empresa_id: nulo(a.empresaId), area_turno_id: nulo(a.areaTurnoId),
  descripcion: a.descripcion, criticidad: a.criticidad, registrado_en: a.registradoEn, sincronizado_en: new Date().toISOString(),
});

const aFotografia = (f: Fotografia, ruta: string, url: string, reporteId?: string): Fila => ({
  id: f.id, reporte_id: nulo(reporteId), registro_id: nulo(f.registroId), alerta_id: nulo(f.alertaId),
  ruta, url, orden: f.orden, pie_foto: nulo(f.pieFoto), capturada_en: f.capturadaEn,
  latitud: nulo(f.latitud), longitud: nulo(f.longitud), sincronizado_en: new Date().toISOString(),
});

const aEnvio = (e: Envio): Fila => ({
  id: e.id, reporte_id: e.reporteId, enviado_por: e.enviadoPor, destinatarios: e.destinatarios, estado: e.estado,
  creado_en: e.creadoEn, enviado_en: nulo(e.enviadoEn), intentos: e.intentos, error: nulo(e.error),
  sincronizado_en: new Date().toISOString(),
});

// ───────────────────────── Utilidades ─────────────────────────

function sinBinarios<T extends object>(x: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x)) {
    if (k === "sincronizadoEn" || k === "urlRemota") continue;
    out[k] = typeof Blob !== "undefined" && v instanceof Blob ? `blob:${v.size}:${v.type}` : v;
  }
  return out;
}

/** Texto estable (llaves ordenadas) para comparar objetos. */
function huellaDe(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );
}

function leerJson<T>(s: string | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function mensaje(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

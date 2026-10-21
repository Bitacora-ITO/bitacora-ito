// Operaciones de datos de la app sobre la base local (Dexie). Las pantallas no escriben en `db` directamente.
import { ahoraISO, db, hoyLocal, nuevoId } from "./db";
import type {
  Alerta, Area, AreaTurno, Clima, ColumnaAlerta, Contrato, Criticidad, Empresa, Envio,
  Fotografia, Registro, Reporte, RolTurno, Turno, Usuario,
} from "./types";
import type { FotoCapturada } from "./nativo";

// ───────────────────────── Contexto de la sesión ─────────────────────────

export const CLAVES = {
  usuario: "usuarioActual",
  contrato: "contratoActual",
  semilla: "semillaVersion",
  destinatario: "destinatarioPrueba",
} as const;

export async function leerAjuste(clave: string): Promise<string | undefined> {
  return (await db.ajustes.get(clave))?.valor;
}

export async function escribirAjuste(clave: string, valor: string): Promise<void> {
  await db.ajustes.put({ clave, valor });
}

export interface Contexto {
  usuario: Usuario;
  contrato: Contrato;
}

export async function obtenerContexto(): Promise<Contexto> {
  const [uid, cid] = await Promise.all([leerAjuste(CLAVES.usuario), leerAjuste(CLAVES.contrato)]);
  const usuario = uid ? await db.usuarios.get(uid) : await db.usuarios.toCollection().first();
  const contrato = cid ? await db.contratos.get(cid) : await db.contratos.toCollection().first();
  if (!usuario || !contrato) throw new Error("No hay usuario ni contrato cargados en el teléfono.");
  return { usuario, contrato };
}

/** Turno del inspector de la maqueta: siempre el turno día. */
export function turnoActual(): Turno {
  return "dia";
}

export function formatoCorrelativo(prefijo: string, n: number): string {
  return `${prefijo}${String(n).padStart(5, "0")}`;
}

/** "4600026893-8211-INDCS-01972" → "01972". */
export function numeroCorto(correlativo: string): string {
  return correlativo.split("-").pop() ?? correlativo;
}

// ───────────────────────── Reporte del día ─────────────────────────

export async function buscarReporte(contratoId: string, fecha: string, turno: Turno): Promise<Reporte | undefined> {
  return db.reportes.where("[contratoId+fecha+turno]").equals([contratoId, fecha, turno]).first();
}

export async function reporteDeHoy(): Promise<Reporte | undefined> {
  const { contrato } = await obtenerContexto();
  return buscarReporte(contrato.id, hoyLocal(), turnoActual());
}

let creando: Promise<Reporte> | null = null;

/**
 * Regla 1: un solo reporte por contrato, fecha y turno, con el correlativo siguiente de la serie.
 * HU-01: el turno nuevo parte con las áreas (y empresas) del reporte anterior, todas pendientes.
 */
export function asegurarReporteHoy(): Promise<Reporte> {
  if (!creando) {
    creando = crearReporteHoy().finally(() => { creando = null; });
  }
  return creando;
}

async function crearReporteHoy(): Promise<Reporte> {
  const { usuario, contrato } = await obtenerContexto();
  const fecha = hoyLocal();
  const turno = turnoActual();
  return db.transaction("rw", [db.reportes, db.contratos, db.areasTurno], async () => {
    const existente = await buscarReporte(contrato.id, fecha, turno);
    if (existente) return existente;
    const c = (await db.contratos.get(contrato.id))!;
    const n = c.ultimoCorrelativo + 1;
    const anteriores = await db.reportes.where("contratoId").equals(c.id).filter((r) => r.fecha < fecha).toArray();
    anteriores.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    const previo = anteriores[0];
    const reporte: Reporte = {
      id: nuevoId(),
      contratoId: c.id,
      fecha,
      turno,
      correlativo: formatoCorrelativo(c.prefijoCorrelativo, n),
      elaboradoPor: usuario.id,
      climaTurno: previo?.climaProyeccion ?? "despejado",
      climaProyeccion: previo?.climaProyeccion ?? "despejado",
      estado: "borrador",
    };
    await db.reportes.add(reporte);
    await db.contratos.update(c.id, { ultimoCorrelativo: n });
    if (previo) {
      const areasPrevias = await db.areasTurno.where("reporteId").equals(previo.id).sortBy("orden");
      const ahora = ahoraISO();
      await db.areasTurno.bulkAdd(areasPrevias.map((a, i) => ({
        id: nuevoId(), reporteId: reporte.id, areaId: a.areaId, empresaId: a.empresaId, orden: i + 1, agregadaEn: ahora,
      })));
    }
    return reporte;
  });
}

// ───────────────────────── Estado de las áreas del turno ─────────────────────────

export type EstadoArea = "con_registro" | "sin_actividad" | "pendiente" | "por_sincronizar";

export interface AreaDelTurno {
  areaTurno: AreaTurno;
  area: Area;
  empresa: Empresa;
  registros: Registro[];
  estado: EstadoArea;
  /** Hora del último registro, "08:40". */
  ultimaHora?: string;
  fotos: number;
}

export function estadoDeArea(registros: Registro[], haySinSincronizar: boolean): EstadoArea {
  if (registros.length === 0) return "pendiente";
  if (registros.some((r) => !r.sincronizadoEn) && haySinSincronizar) return "por_sincronizar";
  if (registros.every((r) => r.sinActividad)) return "sin_actividad";
  return "con_registro";
}

/**
 * Áreas del reporte con su empresa, registros y estado.
 * `pendientesSync` viene de `contarPendientes()`: si es 0, nada se muestra «Por sincronizar».
 */
export async function areasDelReporte(reporteId: string, pendientesSync = 0): Promise<AreaDelTurno[]> {
  const ats = await db.areasTurno.where("reporteId").equals(reporteId).sortBy("orden");
  const [areas, empresas, registros] = await Promise.all([
    db.areas.bulkGet(ats.map((a) => a.areaId)),
    db.empresas.bulkGet(ats.map((a) => a.empresaId)),
    db.registros.where("reporteId").equals(reporteId).toArray(),
  ]);
  const regIds = registros.map((r) => r.id);
  const fotos = regIds.length ? await db.fotografias.where("registroId").anyOf(regIds).toArray() : [];
  return ats.map((at, i) => {
    const regs = registros.filter((r) => r.areaTurnoId === at.id).sort((a, b) => a.registradoEn.localeCompare(b.registradoEn));
    const ids = new Set(regs.map((r) => r.id));
    const ultimo = regs[regs.length - 1];
    return {
      areaTurno: at,
      area: areas[i] ?? { id: at.areaId, contratoId: "", nombre: "Área", orden: 0, vigente: true },
      empresa: empresas[i] ?? { id: at.empresaId, contratoId: "", nombre: "Empresa", tipo: "otro" },
      registros: regs,
      estado: estadoDeArea(regs, pendientesSync > 0),
      ultimaHora: ultimo ? horaLocal(ultimo.registradoEn) : undefined,
      fotos: fotos.filter((f) => f.registroId && ids.has(f.registroId)).length,
    };
  });
}

function horaLocal(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Áreas del turno sin registro ni declaración de sin actividad (regla 2, HU-06). */
export async function areasSinResolver(reporteId: string): Promise<AreaDelTurno[]> {
  return (await areasDelReporte(reporteId)).filter((a) => a.estado === "pendiente");
}

// ───────────────────────── Edición del reporte ─────────────────────────

export class ReporteNoEditable extends Error {
  constructor(msg = "El reporte ya fue enviado y no se edita. Una corrección genera un envío nuevo.") {
    super(msg);
    this.name = "ReporteNoEditable";
  }
}

/** Envío más reciente del reporte. */
export async function ultimoEnvio(reporteId: string): Promise<Envio | undefined> {
  const envios = await db.envios.where("reporteId").equals(reporteId).toArray();
  envios.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
  return envios[envios.length - 1];
}

export async function esEditable(reporte: Reporte): Promise<boolean> {
  if (reporte.estado === "enviado") return false;
  const envio = await ultimoEnvio(reporte.id);
  return !(envio && (envio.estado === "en_cola" || envio.estado === "enviando" || envio.estado === "enviado"));
}

/**
 * Antes de cualquier cambio: un reporte enviado (o con envío en curso) no se edita (regla 7).
 * Si ya tenía PDF generado o estaba aprobado, vuelve a borrador: hay que revisar de nuevo la vista previa (regla 9).
 */
async function prepararEdicion(reporteId: string): Promise<Reporte> {
  const r = await db.reportes.get(reporteId);
  if (!r) throw new Error("No se encontró el reporte del turno.");
  if (!(await esEditable(r))) throw new ReporteNoEditable();
  if (r.estado !== "borrador") {
    await db.reportes.update(r.id, {
      estado: "borrador", horaGeneracion: undefined, horaAprobacion: undefined, aprobadoPor: undefined, sincronizadoEn: undefined,
    });
    await db.pdfs.delete(r.id);
  }
  return r;
}

export async function actualizarClima(reporteId: string, campo: "climaTurno" | "climaProyeccion", valor: Clima) {
  await prepararEdicion(reporteId);
  await db.reportes.update(reporteId, { [campo]: valor, sincronizadoEn: undefined });
}

export async function agregarAreaAlTurno(reporteId: string, areaId: string, empresaId: string): Promise<AreaTurno> {
  await prepararEdicion(reporteId);
  return db.transaction("rw", db.areasTurno, async () => {
    const actuales = await db.areasTurno.where("reporteId").equals(reporteId).toArray();
    if (actuales.some((a) => a.areaId === areaId)) throw new Error("El área ya está en el turno.");
    const at: AreaTurno = {
      id: nuevoId(),
      reporteId,
      areaId,
      empresaId,
      orden: actuales.reduce((m, a) => Math.max(m, a.orden), 0) + 1,
      agregadaEn: ahoraISO(),
    };
    await db.areasTurno.add(at);
    return at;
  });
}

export async function quitarAreaDelTurno(areaTurnoId: string): Promise<void> {
  const at = await db.areasTurno.get(areaTurnoId);
  if (!at) return;
  await prepararEdicion(at.reporteId);
  const regs = await db.registros.where("areaTurnoId").equals(areaTurnoId).primaryKeys();
  await db.transaction("rw", [db.areasTurno, db.registros, db.fotografias], async () => {
    if (regs.length) await db.fotografias.where("registroId").anyOf(regs).delete();
    await db.registros.bulkDelete(regs);
    await db.areasTurno.delete(areaTurnoId);
  });
}

export interface DatosRegistro {
  areaTurnoId: string;
  empresaId: string;
  sinActividad: boolean;
  descripcion: string;
  origen: "dictado" | "escrito";
  fotos: FotoCapturada[];
  latitud?: number;
  longitud?: number;
  /** Para editar un registro existente. */
  registroId?: string;
}

/**
 * Guarda un registro con sus fotos (HU-02) o la declaración de sin actividad (HU-04).
 * - Sin actividad reemplaza los registros del área (la pantalla pide confirmación antes).
 * - Un avance nuevo quita la declaración de sin actividad, si existía.
 * - Cambiar la empresa cambia la empresa del área en el turno.
 */
export async function guardarRegistro(d: DatosRegistro): Promise<Registro> {
  const at = await db.areasTurno.get(d.areaTurnoId);
  if (!at) throw new Error("El área ya no está en el turno.");
  await prepararEdicion(at.reporteId);
  if (!d.sinActividad && d.fotos.length === 0) throw new Error("Toma al menos 1 fotografía del avance.");
  if (!d.sinActividad && !d.descripcion.trim()) throw new Error("Dicta o escribe qué se avanzó.");

  return db.transaction("rw", [db.areasTurno, db.registros, db.fotografias], async () => {
    if (at.empresaId !== d.empresaId) await db.areasTurno.update(at.id, { empresaId: d.empresaId });
    const previos = await db.registros.where("areaTurnoId").equals(at.id).toArray();
    const aBorrar = d.sinActividad
      ? previos.filter((r) => r.id !== d.registroId)
      : previos.filter((r) => r.sinActividad && r.id !== d.registroId);
    if (aBorrar.length) {
      await db.fotografias.where("registroId").anyOf(aBorrar.map((r) => r.id)).delete();
      await db.registros.bulkDelete(aBorrar.map((r) => r.id));
    }
    const existente = d.registroId ? previos.find((r) => r.id === d.registroId) : undefined;
    const registro: Registro = {
      id: existente?.id ?? nuevoId(),
      reporteId: at.reporteId,
      areaTurnoId: at.id,
      sinActividad: d.sinActividad,
      descripcion: d.sinActividad ? "" : d.descripcion.trim(),
      origenDescripcion: d.origen,
      latitud: d.latitud ?? existente?.latitud,
      longitud: d.longitud ?? existente?.longitud,
      registradoEn: existente?.registradoEn ?? ahoraISO(), // regla 6: se conserva la hora original
    };
    await db.registros.put(registro);
    await db.fotografias.where("registroId").equals(registro.id).delete();
    if (!d.sinActividad) {
      await db.fotografias.bulkAdd(d.fotos.map((f, i): Fotografia => ({
        id: nuevoId(), registroId: registro.id, imagen: f.imagen, orden: i + 1,
        capturadaEn: f.capturadaEn, latitud: f.latitud ?? d.latitud, longitud: f.longitud ?? d.longitud,
      })));
    }
    return registro;
  });
}

export async function eliminarRegistro(registroId: string): Promise<void> {
  const r = await db.registros.get(registroId);
  if (!r) return;
  await prepararEdicion(r.reporteId);
  await db.transaction("rw", [db.registros, db.fotografias], async () => {
    await db.fotografias.where("registroId").equals(registroId).delete();
    await db.registros.delete(registroId);
  });
}

export async function fotosDeRegistro(registroId: string): Promise<Fotografia[]> {
  return db.fotografias.where("registroId").equals(registroId).sortBy("orden");
}

export interface DatosAlerta {
  reporteId: string;
  columna: ColumnaAlerta;
  criticidad: Criticidad;
  empresaId?: string;
  areaTurnoId?: string;
  descripcion: string;
  fotos: FotoCapturada[];
}

/** HU-03. Regla 4: una alerta de criticidad alta exige al menos una fotografía. */
export async function guardarAlerta(d: DatosAlerta): Promise<Alerta> {
  await prepararEdicion(d.reporteId);
  if (!d.descripcion.trim()) throw new Error("Describe la alerta.");
  if (d.criticidad === "alta" && d.fotos.length === 0) throw new Error("Criticidad alta exige fotografía.");
  return db.transaction("rw", [db.alertas, db.fotografias], async () => {
    const alerta: Alerta = {
      id: nuevoId(), reporteId: d.reporteId, columna: d.columna, criticidad: d.criticidad,
      empresaId: d.empresaId, areaTurnoId: d.areaTurnoId, descripcion: d.descripcion.trim(), registradoEn: ahoraISO(),
    };
    await db.alertas.add(alerta);
    await db.fotografias.bulkAdd(d.fotos.map((f, i): Fotografia => ({
      id: nuevoId(), alertaId: alerta.id, imagen: f.imagen, orden: i + 1,
      capturadaEn: f.capturadaEn, latitud: f.latitud, longitud: f.longitud,
    })));
    return alerta;
  });
}

export async function eliminarAlerta(alertaId: string): Promise<void> {
  const a = await db.alertas.get(alertaId);
  if (!a) return;
  await prepararEdicion(a.reporteId);
  await db.transaction("rw", [db.alertas, db.fotografias], async () => {
    await db.fotografias.where("alertaId").equals(alertaId).delete();
    await db.alertas.delete(alertaId);
  });
}

// ───────────────────────── Vista previa, aprobación ─────────────────────────

/** Regla 9: el reporte pasa a `generado` cuando se arma el PDF de la vista previa. */
export async function guardarPdfGenerado(reporteId: string, pdf: Blob): Promise<void> {
  const r = await db.reportes.get(reporteId);
  if (!r) throw new Error("No se encontró el reporte.");
  if (!(await esEditable(r))) throw new ReporteNoEditable();
  const ahora = ahoraISO();
  await db.transaction("rw", [db.pdfs, db.reportes], async () => {
    await db.pdfs.put({ reporteId, pdf, generadoEn: ahora });
    await db.reportes.update(reporteId, {
      estado: "generado", horaGeneracion: ahora, horaAprobacion: undefined, aprobadoPor: undefined, sincronizadoEn: undefined,
    });
  });
}

/** Regla 5 y 9: solo se aprueba un reporte `generado` (es decir, desde la vista previa), con autor y hora. */
export async function aprobarReporte(reporteId: string, usuarioId: string): Promise<void> {
  const r = await db.reportes.get(reporteId);
  if (!r) throw new Error("No se encontró el reporte.");
  if (r.estado === "aprobado") return;
  if (r.estado !== "generado") throw new Error("El reporte se aprueba solo desde la vista previa del PDF.");
  if (!(await db.pdfs.get(reporteId))) throw new Error("Falta el PDF de la vista previa.");
  await db.reportes.update(reporteId, {
    estado: "aprobado", horaAprobacion: ahoraISO(), aprobadoPor: usuarioId, sincronizadoEn: undefined,
  });
}

// ───────────────────────── Resumen del borrador ─────────────────────────

export interface ResumenReporte {
  areas: number;
  conRegistro: number;
  sinActividad: number;
  alertas: Alerta[];
  porCriticidad: Record<Criticidad, number>;
  porColumna: Record<ColumnaAlerta, number>;
  fotos: number;
}

export async function resumenReporte(reporteId: string): Promise<ResumenReporte> {
  const areas = await areasDelReporte(reporteId);
  const alertas = await db.alertas.where("reporteId").equals(reporteId).toArray();
  const fotosAlertas = alertas.length ? await db.fotografias.where("alertaId").anyOf(alertas.map((a) => a.id)).count() : 0;
  const porCriticidad: Record<Criticidad, number> = { alta: 0, media: 0, baja: 0 };
  const porColumna: Record<ColumnaAlerta, number> = { construccion: 0, laboratorio: 0, topografia: 0, interferencia: 0 };
  for (const a of alertas) { porCriticidad[a.criticidad]++; porColumna[a.columna]++; }
  return {
    areas: areas.length,
    conRegistro: areas.filter((a) => a.registros.some((r) => !r.sinActividad)).length,
    sinActividad: areas.filter((a) => a.estado === "sin_actividad").length,
    alertas,
    porCriticidad,
    porColumna,
    fotos: areas.reduce((s, a) => s + a.fotos, 0) + fotosAlertas,
  };
}

// ───────────────────────── Catálogos ─────────────────────────

export async function areasDelContrato(contratoId: string): Promise<Area[]> {
  return (await db.areas.where("contratoId").equals(contratoId).sortBy("orden")).filter((a) => a.vigente);
}

export async function empresasDelContrato(contratoId: string): Promise<Empresa[]> {
  return db.empresas.where("contratoId").equals(contratoId).toArray();
}

export const TIPO_EMPRESA: Record<Empresa["tipo"], string> = {
  contratista: "Contratista",
  laboratorio: "Laboratorio",
  topografia: "Topografía",
  obras_civiles: "Obras civiles",
  otro: "Otro",
};

export const COLUMNA: Record<ColumnaAlerta, { corto: string; largo: string }> = {
  construccion: { corto: "Constr.", largo: "Construcción" },
  laboratorio: { corto: "Lab.", largo: "Laboratorio" },
  topografia: { corto: "Topo.", largo: "Topografía" },
  interferencia: { corto: "Interf.", largo: "Interferencia" },
};

export const CRITICIDAD: Record<Criticidad, string> = { baja: "Baja", media: "Media", alta: "Alta" };
export const CLIMA: Record<Clima, string> = { despejado: "Despejado", nublado: "Nublado", lluvia: "Lluvia" };

// ───────────────────────── Rol e historial ─────────────────────────

export async function rolDelUsuario(): Promise<RolTurno | undefined> {
  const { usuario } = await obtenerContexto();
  return db.rolesTurno.where("usuarioId").equals(usuario.id).first();
}

export async function fijarInicioTurno(fecha: string): Promise<void> {
  const rol = await rolDelUsuario();
  if (!rol) throw new Error("No hay rol de turnos cargado.");
  await db.rolesTurno.update(rol.id, { fechaInicio: fecha });
}

/** Fechas con al menos un envío en estado enviado. */
export async function fechasEnviadas(contratoId: string): Promise<Set<string>> {
  const [reportes, envios] = await Promise.all([
    db.reportes.where("contratoId").equals(contratoId).toArray(),
    db.envios.where("estado").equals("enviado").toArray(),
  ]);
  const ids = new Set(envios.map((e) => e.reporteId));
  return new Set(reportes.filter((r) => ids.has(r.id)).map((r) => r.fecha));
}

export interface DetalleDia {
  reporte?: Reporte;
  envio?: Envio;
  areas: AreaDelTurno[];
  alertas: Alerta[];
  fotos: Fotografia[];
}

export async function detalleDelDia(fecha: string): Promise<DetalleDia> {
  const { contrato } = await obtenerContexto();
  const reporte = await buscarReporte(contrato.id, fecha, turnoActual());
  if (!reporte) return { areas: [], alertas: [], fotos: [] };
  const [areas, alertas, envios] = await Promise.all([
    areasDelReporte(reporte.id),
    db.alertas.where("reporteId").equals(reporte.id).toArray(),
    db.envios.where("reporteId").equals(reporte.id).toArray(),
  ]);
  const regIds = areas.flatMap((a) => a.registros.map((r) => r.id));
  const fotosReg = regIds.length ? await db.fotografias.where("registroId").anyOf(regIds).toArray() : [];
  const fotosAl = alertas.length ? await db.fotografias.where("alertaId").anyOf(alertas.map((a) => a.id)).toArray() : [];
  const envio = envios.find((e) => e.estado === "enviado") ?? envios.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn)).pop();
  return { reporte, envio, areas, alertas, fotos: [...fotosReg, ...fotosAl] };
}

// ───────────────────────── Ajustes de la demostración ─────────────────────────

export async function fijarDestinatarioPrueba(correo: string): Promise<void> {
  const limpio = correo.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) throw new Error("Escribe un correo válido.");
  const { contrato } = await obtenerContexto();
  await db.transaction("rw", [db.contratos, db.ajustes], async () => {
    await db.contratos.update(contrato.id, { destinatarios: [limpio] });
    await db.ajustes.put({ clave: CLAVES.destinatario, valor: limpio });
  });
}

/** Borra toda la base local. La semilla se vuelve a cargar al abrir la app. */
export async function borrarTodo(): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

// Tipos del dominio. Siguen docs/01-estructura-datos.md (versión 2).
// Las fechas van como texto ISO: "YYYY-MM-DD" para días y ISO completo para instantes.

export type Turno = "dia" | "noche";
export type Clima = "despejado" | "nublado" | "lluvia";
export type ColumnaAlerta = "construccion" | "laboratorio" | "topografia" | "interferencia";
export type Criticidad = "baja" | "media" | "alta";
/** "entregado": el inspector dejó su parte disponible para el jefe de turno (semana 8). */
export type EstadoReporte = "borrador" | "generado" | "aprobado" | "entregado" | "enviado";
/** Rol con que se usa la app en este teléfono (la maqueta no tiene inicio de sesión). */
export type RolApp = "inspector" | "jefatura" | "admin";
export type EstadoEnvio = "en_cola" | "enviando" | "enviado" | "fallido";
export type TipoEmpresa = "contratista" | "laboratorio" | "topografia" | "obras_civiles" | "otro";

export interface Usuario {
  id: string;
  nombre: string; // "Jorge Orellana S."
  correo: string;
  rol: RolApp; // "jefatura" = jefe de turno
  contratoId?: string;
  activo?: boolean;
}

export interface Contrato {
  id: string;
  nombre: string; // "Servicio de Inspección Técnica de Obras y Apoyo a la Construcción de Carén"
  numero: string; // "4600026893"
  mandante: string;
  codigoProyecto: string; // "4600026893-8211-FRMCS-00001"
  codigoInterno: string; // "JEJ-664-CT-INF-002"
  revisionFormato: string; // "1"
  fechaFormato: string; // "02-07-2024" (tal como se imprime)
  prefijoCorrelativo: string; // "4600026893-8211-INDCS-"
  ultimoCorrelativo: number; // 1972
  destinatarios: string[];
  horaCierreTurnoDia: string; // "19:00"
}

export interface Empresa {
  id: string;
  contratoId: string;
  nombre: string; // "TECNASIC"
  tipo: TipoEmpresa;
}

/** Catálogo de áreas del contrato (tabla `frente` del modelo). Lo carga la jefatura; el inspector solo elige. */
export interface Area {
  id: string;
  contratoId: string;
  nombre: string; // "Peralte Muro Sotelo"
  orden: number;
  vigente: boolean;
}

export interface Reporte {
  id: string;
  contratoId: string;
  fecha: string; // "2026-10-14"
  turno: Turno;
  correlativo: string; // "4600026893-8211-INDCS-01972"
  elaboradoPor: string; // usuarioId
  climaTurno: Clima;
  climaProyeccion: Clima;
  estado: EstadoReporte;
  resumenTurno?: string;
  horaGeneracion?: string;
  horaAprobacion?: string;
  entregadoEn?: string;
  aprobadoPor?: string;
  sincronizadoEn?: string;
}

/** Área agregada al reporte de un turno, con la empresa que la ejecuta. `orden` numera el reporte (n.0 / n.1). */
export interface AreaTurno {
  id: string;
  reporteId: string;
  areaId: string;
  empresaId: string;
  orden: number;
  agregadaEn: string;
}

export interface Registro {
  id: string;
  reporteId: string;
  areaTurnoId: string;
  sinActividad: boolean;
  descripcion: string; // vacío si sinActividad
  origenDescripcion: "dictado" | "escrito";
  latitud?: number;
  longitud?: number;
  registradoEn: string;
  sincronizadoEn?: string;
}

export interface Alerta {
  id: string;
  reporteId: string;
  columna: ColumnaAlerta;
  empresaId?: string;
  areaTurnoId?: string;
  descripcion: string;
  criticidad: Criticidad;
  registradoEn: string;
  sincronizadoEn?: string;
}

/** Fotografía: cuelga de un registro o de una alerta, nunca de ambos. La imagen va como Blob en la base local. */
export interface Fotografia {
  id: string;
  registroId?: string;
  alertaId?: string;
  imagen: Blob; // JPEG comprimido
  orden: number;
  pieFoto?: string;
  capturadaEn: string;
  latitud?: number;
  longitud?: number;
  urlRemota?: string; // Supabase Storage, una vez sincronizada
  sincronizadoEn?: string;
}

/** PDF generado para la vista previa y el envío (uno por reporte; se reemplaza si se vuelve a generar). */
export interface PdfReporte {
  reporteId: string;
  pdf: Blob;
  generadoEn: string;
  urlRemota?: string;
}

export interface Envio {
  id: string;
  reporteId: string;
  enviadoPor: string;
  destinatarios: string[];
  estado: EstadoEnvio;
  creadoEn: string;
  enviadoEn?: string;
  intentos: number;
  error?: string;
  sincronizadoEn?: string;
}

/** Rol de turnos del inspector (7x7). `fechaInicio` es el primer día de turno que marca el inspector. */
export interface RolTurno {
  id: string;
  usuarioId: string;
  contratoId: string;
  diasTrabajo: number;
  diasDescanso: number;
  fechaInicio: string; // "2026-10-08"
}

/** Ajustes locales de la sesión de la maqueta (se asume sesión iniciada). */
export interface Ajuste {
  clave: string; // "usuarioActual" | "contratoActual" | "semillaVersion" | ...
  valor: string;
}

/** Estado de un día en el calendario del historial. */
export type EstadoDia = "enviado" | "no_entregado" | "descanso" | "hoy" | "programado" | "descanso_futuro";

/** Reporte consolidado del turno, armado por el jefe de turno con las partes de los inspectores. */
export interface Consolidado {
  id: string;
  contratoId: string;
  fecha: string; // "2026-10-30"
  turno: Turno;
  correlativo: string;
  consolidadoPor: string; // usuarioId del jefe de turno
  partes: string[]; // ids de los reportes de los inspectores incluidos
  elaboradoPorTexto: string; // "Jorge Orellana S. / Alberto Castillo"
  climaTurno: Clima;
  climaProyeccion: Clima;
  estado: "borrador" | "generado" | "aprobado" | "enviado";
  rutaPdf?: string; // en el bucket `reportes`
  pdf?: Blob; // copia local para la vista previa
  enviadoEn?: string;
  creadoEn: string;
}

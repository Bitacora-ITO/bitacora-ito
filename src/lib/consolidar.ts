// Consolidación del turno (semana 8): junta las partes de los inspectores en UN reporte para el mandante.
// Módulo puro: no usa la red ni la base local. Recibe las partes ya descargadas
// (lib/consolidacion-remota.ts las baja de Supabase) y devuelve los datos del informe PDF.
//
// Reglas (pedido del profesor guía y formato del informe real):
//  - Las áreas se fusionan por NOMBRE: cada área es una sección n.0, numerada en el orden de su primera
//    aparición (partes ordenadas por hora de entrega; dentro de cada parte, por el orden de su turno).
//  - Dentro de cada área, una subsección n.1, n.2… por EMPRESA, también por primera aparición.
//  - Si dos inspectores registraron la misma área y empresa, sus líneas se juntan por hora de registro.
//    «Sin actividad.» se imprime solo si nadie registró actividad en esa área y empresa.
//  - Las alertas se juntan por columna (construcción, laboratorio, topografía, interferencia) por hora.
//  - «Elaborado por»: los nombres de los inspectores separados por « / », como en el informe real.
//  - Clima: el que elija el jefe de turno; por defecto, el más repetido entre las partes.
//  - Correlativo: prefijo del contrato + (último correlativo + 1), con 5 dígitos.
import type { Clima, ColumnaAlerta, Criticidad, Turno } from "./types";
import type { AlertaInforme, DatosInforme, FotoInforme, LineaInforme, SeccionInforme } from "./informe/tipos";

// ───────────────────────── Entrada ─────────────────────────

export interface AreaTurnoEntrada { id: string; areaId: string; empresaId: string; orden: number }
export interface RegistroEntrada { id: string; areaTurnoId: string; sinActividad: boolean; descripcion: string; registradoEn: string }
export interface AlertaEntrada {
  id: string; columna: ColumnaAlerta; empresaId?: string; areaTurnoId?: string;
  descripcion: string; criticidad: Criticidad; registradoEn: string;
}
export interface FotoEntrada {
  id: string; registroId?: string; alertaId?: string;
  url: string; // URL pública del bucket `fotos` (o ruta local en las pruebas)
  orden: number; pieFoto?: string; capturadaEn: string;
}

/** La parte de un inspector: su reporte del turno con todo lo que cuelga de él. */
export interface ParteEntrada {
  reporteId: string;
  inspector: { id: string; nombre: string };
  climaTurno: Clima;
  climaProyeccion: Clima;
  entregadoEn?: string;
  areasTurno: AreaTurnoEntrada[];
  registros: RegistroEntrada[];
  alertas: AlertaEntrada[];
  fotografias: FotoEntrada[];
}

export interface ContratoEntrada {
  nombre: string;
  numero: string;
  codigoInterno: string;
  codigoProyecto: string;
  revisionFormato: string;
  fechaFormato: string;
  prefijoCorrelativo: string;
  ultimoCorrelativo: number;
}

export interface EntradaConsolidacion {
  contrato: ContratoEntrada;
  fecha: string; // "2026-10-30"
  turno: Turno;
  /** Catálogo del contrato (tabla `frente`) y empresas, para poner nombres. */
  areas: { id: string; nombre: string }[];
  empresas: { id: string; nombre: string }[];
  partes: ParteEntrada[];
}

export interface OpcionesConsolidacion {
  climaTurno?: Clima;
  climaProyeccion?: Clima;
  /** Fuente de cada foto para el PDF (p. ej. data URL ya descargada). Por defecto, su URL. */
  srcFoto?: (f: FotoEntrada) => string;
}

// ───────────────────────── Resultado intermedio ─────────────────────────

export interface LineaConsolidada {
  texto: string;
  sinActividad: boolean;
  inspector: string;
  registradoEn: string;
}

export interface EmpresaConsolidada {
  numero: string; // "1.1"
  nombre: string;
  lineas: LineaConsolidada[];
  inspectores: string[];
}

export interface FotoConsolidada {
  id: string;
  url: string;
  src: string;
  pie?: string;
  /** Nombre legible dentro del paquete .zip: "fotos/01-peralte-muro-sotelo-j-orellana-1032.jpg". */
  archivo: string;
  inspector: string;
  capturadaEn: string;
  area: string;
  origen: "registro" | "alerta";
}

export interface AreaConsolidada {
  numero: string; // "1.0"
  nombre: string;
  empresas: EmpresaConsolidada[];
  fotos: FotoConsolidada[];
}

export interface AlertaConsolidada {
  columna: ColumnaAlerta;
  empresa?: string;
  area?: string;
  texto: string;
  criticidad: Criticidad;
  inspector: string;
  registradoEn: string;
  fotos: string[]; // archivos dentro del paquete
}

export interface ParteResumida {
  reporteId: string;
  inspector: string;
  entregadoEn?: string;
  areas: number;
  registros: number;
  alertas: number;
  fotos: number;
}

export interface Consolidacion {
  contrato: ContratoEntrada;
  fecha: string;
  turno: Turno;
  numero: number; // 1973
  correlativo: string; // "4600026893-8211-INDCS-01973"
  elaboradoPor: string;
  inspectores: string[];
  climaTurno: Clima;
  climaProyeccion: Clima;
  areas: AreaConsolidada[];
  alertas: AlertaConsolidada[];
  fotos: FotoConsolidada[];
  partes: ParteResumida[];
  totales: { areas: number; registros: number; sinActividad: number; alertas: number; alertasAltas: number; fotos: number };
}

export const ORDEN_COLUMNAS: ColumnaAlerta[] = ["construccion", "laboratorio", "topografia", "interferencia"];
const NOMBRE_COLUMNA: Record<ColumnaAlerta, string> = {
  construccion: "Construcción", laboratorio: "Laboratorio", topografia: "Topografía", interferencia: "Interferencia",
};
const NOMBRE_CRITICIDAD: Record<Criticidad, string> = { baja: "baja", media: "media", alta: "alta" };

// ───────────────────────── Utilidades puras ─────────────────────────

export function formatoCorrelativo(prefijo: string, n: number): string {
  return `${prefijo}${String(n).padStart(5, "0")}`;
}

/** Clave para fusionar nombres: sin tildes, sin mayúsculas ni espacios repetidos. */
export function claveNombre(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es-CL").replace(/\s+/g, " ").trim();
}

/** "2026-10-30" → "30-10-2026". */
function fechaCorta(dia: string): string {
  const [a, m, d] = dia.split("-");
  return a && m && d ? `${d}-${m}-${a}` : dia;
}

/** "17:42" en la hora local del teléfono. */
export function horaLocal(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "Jorge Orellana S." → "J. Orellana" (como en la interfaz). */
export function nombreCorto(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return p.length < 2 ? nombre : `${p[0][0]}. ${p[1]}`;
}

/** Texto apto para nombre de archivo: "Peralte Muro Sotelo" → "peralte-muro-sotelo". */
export function aSlug(s: string): string {
  return claveNombre(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "sin-nombre";
}

/** Cada línea del texto es una viñeta; se quita el guion inicial si el inspector lo dictó o escribió. */
function lineasDe(descripcion: string): string[] {
  return descripcion.split(/\r?\n/).map((l) => l.replace(/^\s*[-–•·]\s*/, "").trim()).filter(Boolean);
}

/** Valor más repetido; en empate gana el que aparece primero. */
export function masRepetido<T extends string>(valores: T[]): T | undefined {
  const cuenta = new Map<T, number>();
  for (const v of valores) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  let mejor: T | undefined;
  for (const [v, n] of cuenta) if (mejor === undefined || n > cuenta.get(mejor)!) mejor = v;
  return mejor;
}

/** Partes en orden de entrega (las sin hora de entrega al final) y, en empate, por nombre. */
export function ordenarPartes(partes: ParteEntrada[]): ParteEntrada[] {
  return [...partes].sort((a, b) => {
    const ea = a.entregadoEn ?? "￿", eb = b.entregadoEn ?? "￿";
    return ea.localeCompare(eb) || a.inspector.nombre.localeCompare(b.inspector.nombre, "es");
  });
}

// ───────────────────────── Consolidación ─────────────────────────

/** Arma la estructura completa del consolidado (la usan el PDF, el resumen .md y el paquete .zip). */
export function estructurar(entrada: EntradaConsolidacion, opciones: OpcionesConsolidacion = {}): Consolidacion {
  const partes = ordenarPartes(entrada.partes);
  const nombreArea = new Map(entrada.areas.map((a) => [a.id, a.nombre.trim()]));
  const nombreEmpresa = new Map(entrada.empresas.map((e) => [e.id, e.nombre.trim()]));
  const srcFoto = opciones.srcFoto ?? ((f: FotoEntrada) => f.url);

  // 1. Áreas y empresas por primera aparición.
  interface AreaTmp { nombre: string; empresas: Map<string, { nombre: string; regs: { r: RegistroEntrada; inspector: string; fotos: FotoEntrada[] }[] }> }
  const areas = new Map<string, AreaTmp>();
  /** areaTurnoId → clave del área (por parte, porque los ids son de cada teléfono). */
  const areaDeAt = new Map<string, string>();
  for (const p of partes) {
    for (const at of [...p.areasTurno].sort((a, b) => a.orden - b.orden)) {
      const nombre = nombreArea.get(at.areaId) ?? "Área sin nombre";
      const k = claveNombre(nombre);
      areaDeAt.set(at.id, k);
      if (!areas.has(k)) areas.set(k, { nombre, empresas: new Map() });
      const area = areas.get(k)!;
      const emp = nombreEmpresa.get(at.empresaId) ?? "";
      const ke = claveNombre(emp);
      if (!area.empresas.has(ke)) area.empresas.set(ke, { nombre: emp, regs: [] });
      const grupo = area.empresas.get(ke)!;
      for (const r of p.registros.filter((x) => x.areaTurnoId === at.id)) grupo.regs.push({ r, inspector: p.inspector.nombre, fotos: p.fotografias });
    }
  }

  // 2. Fotos: nombre legible y correlativo dentro del paquete.
  const fotos: FotoConsolidada[] = [];
  const usados = new Set<string>();
  const nombrarFoto = (area: string, inspector: string, capturadaEn: string, alerta: boolean) => {
    const n = String(fotos.length + 1).padStart(2, "0");
    let base = `fotos/${n}-${aSlug(area)}${alerta ? "-alerta" : ""}-${aSlug(nombreCorto(inspector))}-${horaLocal(capturadaEn).replace(":", "") || "0000"}`;
    while (usados.has(base)) base += "b";
    usados.add(base);
    return `${base}.jpg`;
  };
  const ordenFoto = (a: FotoEntrada, b: FotoEntrada) => a.orden - b.orden || a.capturadaEn.localeCompare(b.capturadaEn);

  const areasOut: AreaConsolidada[] = [];
  const fotosPorArea = new Map<string, FotoConsolidada[]>();
  let i = 0;
  for (const [k, a] of areas) {
    i++;
    const empresas: EmpresaConsolidada[] = [];
    let j = 0;
    for (const [, e] of a.empresas) {
      j++;
      const regs = [...e.regs].sort((x, y) => x.r.registradoEn.localeCompare(y.r.registradoEn));
      const activos = regs.filter((x) => !x.r.sinActividad);
      const lineas: LineaConsolidada[] = activos.length
        ? activos.flatMap((x) => lineasDe(x.r.descripcion).map((texto) => ({
            texto, sinActividad: false, inspector: x.inspector, registradoEn: x.r.registradoEn,
          })))
        : regs.length
          ? [{ texto: "Sin actividad.", sinActividad: true, inspector: regs.map((x) => x.inspector).join(" / "), registradoEn: regs[0].r.registradoEn }]
          : [];
      empresas.push({ numero: `${i}.${j}`, nombre: e.nombre, lineas, inspectores: [...new Set(regs.map((x) => x.inspector))] });
    }
    // Fotos de los registros del área, en el orden de sus registros (todas las empresas).
    const fotosArea: FotoConsolidada[] = [];
    const regsArea = [...a.empresas.values()].flatMap((e) => e.regs).sort((x, y) => x.r.registradoEn.localeCompare(y.r.registradoEn));
    for (const { r, inspector, fotos: suyas } of regsArea) {
      for (const f of suyas.filter((x) => x.registroId === r.id).sort(ordenFoto)) {
        const foto: FotoConsolidada = {
          id: f.id, url: f.url, src: srcFoto(f), pie: f.pieFoto, inspector, capturadaEn: f.capturadaEn,
          area: a.nombre, origen: "registro", archivo: nombrarFoto(a.nombre, inspector, f.capturadaEn, false),
        };
        fotos.push(foto);
        fotosArea.push(foto);
      }
    }
    fotosPorArea.set(k, fotosArea);
    areasOut.push({ numero: `${i}.0`, nombre: a.nombre, empresas, fotos: fotosArea });
  }

  // 3. Alertas por columna y hora; sus fotos van al final de la sección de su área (o a la primera).
  const todas = partes.flatMap((p) => p.alertas.map((al) => ({ al, p })))
    .sort((x, y) => x.al.registradoEn.localeCompare(y.al.registradoEn));
  const alertas: AlertaConsolidada[] = [];
  for (const { al, p } of todas) {
    const kArea = al.areaTurnoId ? areaDeAt.get(al.areaTurnoId) : undefined;
    const area = kArea ? areas.get(kArea)?.nombre : undefined;
    const destino = kArea && fotosPorArea.has(kArea) ? fotosPorArea.get(kArea)! : areasOut[0]?.fotos;
    const nombreDestino = kArea && area ? area : areasOut[0]?.nombre ?? "";
    const pie = `Alerta · ${NOMBRE_COLUMNA[al.columna]} (${NOMBRE_CRITICIDAD[al.criticidad]})`;
    const archivos: string[] = [];
    for (const f of p.fotografias.filter((x) => x.alertaId === al.id).sort(ordenFoto)) {
      const foto: FotoConsolidada = {
        id: f.id, url: f.url, src: srcFoto(f), pie, inspector: p.inspector.nombre, capturadaEn: f.capturadaEn,
        area: nombreDestino, origen: "alerta", archivo: nombrarFoto(nombreDestino, p.inspector.nombre, f.capturadaEn, true),
      };
      fotos.push(foto);
      archivos.push(foto.archivo);
      destino?.push(foto); // sin áreas en el turno no hay dónde imprimirla en el PDF, pero va al paquete
    }
    alertas.push({
      columna: al.columna, empresa: al.empresaId ? nombreEmpresa.get(al.empresaId) : undefined, area,
      texto: al.descripcion.trim(), criticidad: al.criticidad, inspector: p.inspector.nombre,
      registradoEn: al.registradoEn, fotos: archivos,
    });
  }
  alertas.sort((a, b) => ORDEN_COLUMNAS.indexOf(a.columna) - ORDEN_COLUMNAS.indexOf(b.columna) || a.registradoEn.localeCompare(b.registradoEn));

  // 4. Encabezado.
  const inspectores = [...new Set(partes.map((p) => p.inspector.nombre.trim()).filter(Boolean))];
  const numero = entrada.contrato.ultimoCorrelativo + 1;
  const lineas = areasOut.flatMap((a) => a.empresas.flatMap((e) => e.lineas));
  return {
    contrato: entrada.contrato,
    fecha: entrada.fecha,
    turno: entrada.turno,
    numero,
    correlativo: formatoCorrelativo(entrada.contrato.prefijoCorrelativo, numero),
    elaboradoPor: inspectores.join(" / "),
    inspectores,
    climaTurno: opciones.climaTurno ?? masRepetido(partes.map((p) => p.climaTurno)) ?? "despejado",
    climaProyeccion: opciones.climaProyeccion ?? masRepetido(partes.map((p) => p.climaProyeccion)) ?? "despejado",
    areas: areasOut,
    alertas,
    fotos,
    partes: partes.map((p) => ({
      reporteId: p.reporteId, inspector: p.inspector.nombre, entregadoEn: p.entregadoEn,
      areas: p.areasTurno.length, registros: p.registros.length, alertas: p.alertas.length, fotos: p.fotografias.length,
    })),
    totales: {
      areas: areasOut.length,
      registros: lineas.filter((l) => !l.sinActividad).length,
      sinActividad: lineas.filter((l) => l.sinActividad).length,
      alertas: alertas.length,
      alertasAltas: alertas.filter((a) => a.criticidad === "alta").length,
      fotos: fotos.length,
    },
  };
}

/** Convierte la estructura en los datos del informe PDF (lib/informe/tipos.ts). */
export function aDatosInforme(c: Consolidacion): DatosInforme {
  const secciones: SeccionInforme[] = c.areas.map((a) => ({
    numero: a.numero,
    titulo: a.nombre.toLocaleUpperCase("es-CL"),
    subsecciones: a.empresas.map((e) => ({
      numero: e.numero,
      titulo: e.nombre,
      lineas: e.lineas.map((l): LineaInforme => ({ texto: l.texto, tipo: l.sinActividad ? "sin_actividad" : "normal" })),
    })),
    tituloFotos: a.fotos.length ? a.nombre : undefined,
    fotos: a.fotos.map((f): FotoInforme => ({ src: f.src, pie: f.pie })),
  }));
  const alertas: Record<ColumnaAlerta, AlertaInforme[]> = { construccion: [], laboratorio: [], topografia: [], interferencia: [] };
  for (const al of c.alertas) alertas[al.columna].push({ empresa: al.empresa, texto: al.texto, criticidad: al.criticidad });
  return {
    contrato: {
      nombreServicio: c.contrato.nombre,
      numero: c.contrato.numero,
      codigoInterno: c.contrato.codigoInterno,
      codigoProyecto: c.contrato.codigoProyecto,
      revision: c.contrato.revisionFormato,
      fechaFormato: c.contrato.fechaFormato,
    },
    fecha: fechaCorta(c.fecha),
    turno: c.turno,
    correlativo: c.correlativo,
    elaboradoPor: c.elaboradoPor,
    climaTurno: c.climaTurno,
    climaProyeccion: c.climaProyeccion,
    alertas,
    secciones,
  };
}

/** Atajo: partes descargadas → datos del informe consolidado. */
export function consolidar(entrada: EntradaConsolidacion, opciones: OpcionesConsolidacion = {}): DatosInforme {
  return aDatosInforme(estructurar(entrada, opciones));
}

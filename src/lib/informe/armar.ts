// Arma los datos del informe PDF (DatosInforme) desde la base local.
import { db } from "../db";
import type { ColumnaAlerta, Fotografia } from "../types";
import type { AlertaInforme, DatosInforme, FotoInforme, LineaInforme, SeccionInforme } from "./tipos";
import { fechaCorta } from "../fechas";
import { COLUMNA, CRITICIDAD } from "../repositorio";

function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result));
    lector.onerror = () => mal(lector.error ?? new Error("No se pudo leer la fotografía."));
    lector.readAsDataURL(blob);
  });
}

/** Cada línea del texto es una viñeta; se quita el guion inicial si el inspector lo dictó o escribió. */
function lineasDe(descripcion: string): LineaInforme[] {
  return descripcion
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-–•·]\s*/, "").trim())
    .filter(Boolean)
    .map((texto) => ({ texto, tipo: "normal" as const }));
}

async function fotosInforme(fotos: Fotografia[], pie?: string): Promise<FotoInforme[]> {
  const ordenadas = [...fotos].sort((a, b) => a.orden - b.orden || a.capturadaEn.localeCompare(b.capturadaEn));
  return Promise.all(ordenadas.map(async (f) => ({ src: await blobADataUrl(f.imagen), pie: f.pieFoto ?? pie })));
}

/**
 * - Cada área del turno es la sección n.0 (nombre en mayúsculas) y su empresa la subsección n.1.
 * - Un registro por viñeta; los saltos de línea separan viñetas; «Sin actividad.» en rojo.
 * - Fotos de los registros del área como data URL, con el nombre del área como título de la columna.
 *   Las fotos de una alerta con área van al final de esa sección, con pie «Alerta · Columna (criticidad)».
 * - Alertas agrupadas por columna, con empresa, texto y criticidad.
 */
export async function armarDatosInforme(reporteId: string): Promise<DatosInforme> {
  const reporte = await db.reportes.get(reporteId);
  if (!reporte) throw new Error("No se encontró el reporte.");
  const [contrato, usuario, ats, registros, alertas, empresas, areas] = await Promise.all([
    db.contratos.get(reporte.contratoId),
    db.usuarios.get(reporte.elaboradoPor),
    db.areasTurno.where("reporteId").equals(reporteId).sortBy("orden"),
    db.registros.where("reporteId").equals(reporteId).toArray(),
    db.alertas.where("reporteId").equals(reporteId).toArray(),
    db.empresas.toArray(),
    db.areas.toArray(),
  ]);
  if (!contrato) throw new Error("No se encontró el contrato del reporte.");
  const empresa = (id?: string) => empresas.find((e) => e.id === id)?.nombre;
  const regIds = registros.map((r) => r.id);
  const alertaIds = alertas.map((a) => a.id);
  const [fotosReg, fotosAl] = await Promise.all([
    regIds.length ? db.fotografias.where("registroId").anyOf(regIds).toArray() : Promise.resolve([]),
    alertaIds.length ? db.fotografias.where("alertaId").anyOf(alertaIds).toArray() : Promise.resolve([]),
  ]);

  const secciones: SeccionInforme[] = [];
  for (const [i, at] of ats.entries()) {
    const n = i + 1;
    const nombreArea = areas.find((a) => a.id === at.areaId)?.nombre ?? "Área";
    const regs = registros.filter((r) => r.areaTurnoId === at.id).sort((a, b) => a.registradoEn.localeCompare(b.registradoEn));
    const lineas: LineaInforme[] = regs.flatMap((r) =>
      r.sinActividad ? [{ texto: "Sin actividad.", tipo: "sin_actividad" as const }] : lineasDe(r.descripcion),
    );
    const ids = new Set(regs.map((r) => r.id));
    const fotos = await fotosInforme(fotosReg.filter((f) => f.registroId && ids.has(f.registroId)));
    for (const al of alertas.filter((a) => a.areaTurnoId === at.id)) {
      const pie = `Alerta · ${COLUMNA[al.columna].largo} (${CRITICIDAD[al.criticidad].toLowerCase()})`;
      fotos.push(...(await fotosInforme(fotosAl.filter((f) => f.alertaId === al.id), pie)));
    }
    secciones.push({
      numero: `${n}.0`,
      titulo: nombreArea.toLocaleUpperCase("es-CL"),
      subsecciones: [{ numero: `${n}.1`, titulo: empresa(at.empresaId) ?? "", lineas }],
      tituloFotos: fotos.length ? nombreArea : undefined,
      fotos,
    });
  }

  // Fotos de alertas sin área: van a la primera sección para no perder la evidencia.
  const sueltas = alertas.filter((a) => !a.areaTurnoId || !ats.some((at) => at.id === a.areaTurnoId));
  for (const al of sueltas) {
    const fs = fotosAl.filter((f) => f.alertaId === al.id);
    if (!fs.length || !secciones.length) continue;
    const pie = `Alerta · ${COLUMNA[al.columna].largo} (${CRITICIDAD[al.criticidad].toLowerCase()})`;
    secciones[0].fotos.push(...(await fotosInforme(fs, pie)));
    secciones[0].tituloFotos ??= areas.find((a) => a.id === ats[0].areaId)?.nombre;
  }

  const grupos: Record<ColumnaAlerta, AlertaInforme[]> = { construccion: [], laboratorio: [], topografia: [], interferencia: [] };
  for (const al of [...alertas].sort((a, b) => a.registradoEn.localeCompare(b.registradoEn))) {
    grupos[al.columna].push({ empresa: empresa(al.empresaId), texto: al.descripcion, criticidad: al.criticidad });
  }

  return {
    contrato: {
      nombreServicio: contrato.nombre,
      numero: contrato.numero,
      codigoInterno: contrato.codigoInterno,
      codigoProyecto: contrato.codigoProyecto,
      revision: contrato.revisionFormato,
      fechaFormato: contrato.fechaFormato,
    },
    fecha: fechaCorta(reporte.fecha),
    turno: reporte.turno,
    correlativo: reporte.correlativo,
    elaboradoPor: usuario?.nombre ?? "",
    climaTurno: reporte.climaTurno,
    climaProyeccion: reporte.climaProyeccion,
    alertas: grupos,
    secciones,
  };
}

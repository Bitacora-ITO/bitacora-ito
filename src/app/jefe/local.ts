// Copia local del consolidado (tabla Dexie `consolidados`, db.ts v2), con el PDF como Blob para la vista previa.
import { ahoraISO, db, nuevoId } from "@/lib/db";
import type { Consolidacion } from "@/lib/consolidar";
import type { Consolidado, Turno } from "@/lib/types";

/** Consolidado local más reciente del contrato, fecha y turno. */
export async function consolidadoLocal(contratoId: string, fecha: string, turno: Turno): Promise<Consolidado | undefined> {
  const todos = await db.consolidados.where("[contratoId+fecha+turno]").equals([contratoId, fecha, turno]).toArray();
  return todos.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn)).pop();
}

/** Id para un consolidado nuevo: reutiliza el borrador local del turno si aún no se envió. */
export async function idParaConsolidar(contratoId: string, fecha: string, turno: Turno): Promise<string> {
  const previo = await consolidadoLocal(contratoId, fecha, turno);
  return previo && previo.estado !== "enviado" ? previo.id : nuevoId();
}

export async function guardarGenerado(id: string, contratoId: string, consolidadoPor: string, c: Consolidacion, pdf: Blob): Promise<void> {
  const previo = await db.consolidados.get(id);
  await db.consolidados.put({
    id, contratoId, fecha: c.fecha, turno: c.turno, correlativo: c.correlativo, consolidadoPor,
    partes: c.partes.map((p) => p.reporteId), elaboradoPorTexto: c.elaboradoPor,
    climaTurno: c.climaTurno, climaProyeccion: c.climaProyeccion, estado: "generado", pdf,
    creadoEn: previo?.creadoEn ?? ahoraISO(),
  });
}

export async function marcarAprobado(id: string, rutaPdf: string): Promise<void> {
  await db.consolidados.update(id, { estado: "aprobado", rutaPdf });
}

/** Enviado: también avanza el correlativo local del contrato, para que la próxima subida del catálogo no lo retroceda. */
export async function marcarEnviado(id: string, contratoId: string, numero: number, enviadoEn: string): Promise<void> {
  await db.transaction("rw", [db.consolidados, db.contratos], async () => {
    await db.consolidados.update(id, { estado: "enviado", enviadoEn });
    const contrato = await db.contratos.get(contratoId);
    if (contrato && contrato.ultimoCorrelativo < numero) await db.contratos.update(contratoId, { ultimoCorrelativo: numero });
  });
}

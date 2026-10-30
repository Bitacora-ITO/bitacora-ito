// Envío del reporte al mandante por correo, a través de la función de Vercel /api/enviar.
// CONTRATO: las pantallas usan `enviarReporte` y `procesarCola` (no cambiar las firmas).
// Semana 8: el inspector ya no envía al mandante; entrega su parte al jefe de turno
// (`entregarAlJefe`) y el jefe envía el consolidado (`enviarCuerpoAlMandante`). `enviarReporte`
// queda para los envíos antiguos que sigan en cola en algún teléfono.
//
// Flujo:
//  1. Solo se envía un reporte `aprobado` con su PDF en `db.pdfs`.
//  2. Sin red, el envío queda `en_cola` y `procesarCola()` lo reintenta al volver la señal.
//  3. Con red: el PDF se sube primero a Supabase Storage y se manda solo la ruta (las funciones de
//     Vercel aceptan cuerpos de ~4,5 MB). Si no hay Supabase o la subida falla, y el PDF es chico,
//     va en base64 dentro del cuerpo.
//  4. Si el servidor responde bien: envío `enviado` y reporte `enviado`. Si no: `fallido`, con el error.
import { Capacitor } from "@capacitor/core";
import { ahoraISO, db, nuevoId } from "./db";
import { blobABase64, hayRed } from "./nativo";
import { pendientesDeReporte, sincronizar, subirPdf } from "./sync";
import { supabaseConfigurado } from "./supabase";
import type { Envio, Reporte } from "./types";

export type ResultadoEnvio =
  | { estado: "enviado"; envio: Envio }
  | { estado: "en_cola"; envio: Envio } // sin señal: se reintenta solo al volver la red
  | { estado: "fallido"; envio: Envio; error: string };

/** Cuerpo que recibe /api/enviar (lo comparten el cliente y la función de Vercel). */
export interface CuerpoEnvio {
  destinatarios: string[];
  reporte: {
    id: string;
    correlativo: string;
    numero: string; // correlativo corto, p. ej. "01972"
    fecha: string; // "YYYY-MM-DD"
    turno: "dia" | "noche";
    elaboradoPor: string; // nombre del inspector
    contrato?: string;
    numeroContrato?: string;
    mandante?: string;
    codigoProyecto?: string;
    resumen?: string;
    areas: number;
    registros: number;
    sinActividad: number;
    alertas: number;
    alertasAltas: number;
    fotos: number;
  };
  pdf: { nombre: string; ruta?: string; base64?: string };
}

/**
 * Límite para mandar el PDF dentro del cuerpo. El base64 pesa 4/3 del archivo y Vercel acepta
 * ~4,5 MB por solicitud: con 3,2 MB de PDF el cuerpo queda en ~4,3 MB, con margen para el resto.
 */
const MAX_PDF_EN_CUERPO = 3_200_000;
const ESPERA_RESPUESTA_MS = 60_000;

// Envíos que se están procesando ahora (evita mandar dos veces el mismo correo).
const enProceso = new Set<string>();
let colaEnCurso: Promise<number> | null = null;

/**
 * Envía el PDF ya aprobado del reporte (tabla `pdfs`) a los destinatarios del contrato.
 * Crea o actualiza el registro en `envios` y, si se envía, deja el reporte en estado "enviado".
 */
export async function enviarReporte(reporteId: string): Promise<ResultadoEnvio> {
  const reporte = await db.reportes.get(reporteId);
  const pdf = await db.pdfs.get(reporteId);
  const contrato = reporte ? await db.contratos.get(reporte.contratoId) : undefined;
  const usuarioActual = (await db.ajustes.get("usuarioActual"))?.valor;
  const destinatarios = (contrato?.destinatarios ?? []).map((d) => d.trim()).filter(Boolean);

  // Validaciones previas: no se crea un envío si el reporte no está listo.
  const problema = !reporte
    ? "No se encontró el reporte."
    : reporte.estado === "enviado"
      ? "Este reporte ya fue enviado."
      : reporte.estado !== "aprobado"
        ? "El reporte debe aprobarse desde la vista previa antes de enviarlo."
        : !pdf
          ? "Falta el PDF del reporte. Vuelve a abrir la vista previa."
          : destinatarios.length === 0
            ? "El contrato no tiene destinatarios configurados."
            : null;
  if (problema || !reporte) {
    const envio: Envio = {
      id: nuevoId(), reporteId, enviadoPor: usuarioActual ?? reporte?.elaboradoPor ?? "",
      destinatarios, estado: "fallido", creadoEn: ahoraISO(), intentos: 0, error: problema ?? "Error desconocido",
    };
    return { estado: "fallido", envio, error: envio.error! };
  }

  // Se reutiliza un envío pendiente del mismo reporte (en cola o fallido) en vez de crear otro.
  const previos = await db.envios.where("reporteId").equals(reporteId).toArray();
  const pendiente = previos
    .filter((e) => e.estado === "en_cola" || e.estado === "fallido" || e.estado === "enviando")
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))[0];
  if (pendiente && enProceso.has(pendiente.id)) {
    return { estado: "en_cola", envio: pendiente }; // ya se está enviando en este momento
  }
  const envio: Envio = pendiente
    ? { ...pendiente, destinatarios, estado: "en_cola", error: undefined, sincronizadoEn: undefined }
    : {
        id: nuevoId(), reporteId, enviadoPor: usuarioActual ?? reporte.aprobadoPor ?? reporte.elaboradoPor,
        destinatarios, estado: "en_cola", creadoEn: ahoraISO(), intentos: 0,
      };
  await db.envios.put(envio);

  if (!(await hayRed())) return { estado: "en_cola", envio };
  return intentar(envio);
}

/** Reintenta los envíos en cola (se llama al recuperar la señal y al abrir la app). Devuelve cuántos se enviaron. */
export function procesarCola(): Promise<number> {
  if (typeof window === "undefined") return Promise.resolve(0);
  if (!colaEnCurso) {
    colaEnCurso = (async () => {
      if (!(await hayRed())) return 0;
      const hace2min = new Date(Date.now() - 2 * 60_000).toISOString();
      const cola = (await db.envios.toArray()).filter(
        (e) => !enProceso.has(e.id) &&
          // «enviando» viejo = la app se cerró a mitad de un envío: se vuelve a intentar.
          (e.estado === "en_cola" || (e.estado === "enviando" && (e.enviadoEn ?? e.creadoEn) < hace2min)),
      );
      let enviados = 0;
      for (const e of cola) {
        const r = await intentar(e).catch(() => null);
        if (r?.estado === "enviado") enviados++;
        if (r?.estado === "en_cola") break; // se cortó la red: no tiene sentido seguir
      }
      return enviados;
    })()
      .catch(() => 0)
      .finally(() => { colaEnCurso = null; });
  }
  return colaEnCurso;
}

// ───────────────────────── Envío efectivo ─────────────────────────

async function intentar(base: Envio): Promise<ResultadoEnvio> {
  if (enProceso.has(base.id)) return { estado: "en_cola", envio: base };
  enProceso.add(base.id);
  let envio: Envio = { ...base, estado: "enviando", intentos: base.intentos + 1, error: undefined, sincronizadoEn: undefined };
  try {
    await db.envios.put(envio);
    const reporte = await db.reportes.get(envio.reporteId);
    const pdf = await db.pdfs.get(envio.reporteId);
    if (!reporte || !pdf) return await fallar(envio, "El reporte o su PDF ya no están en el teléfono.");
    if (reporte.estado === "enviado") {
      envio = { ...envio, estado: "enviado", enviadoEn: envio.enviadoEn ?? ahoraISO() };
      await db.envios.put(envio);
      return { estado: "enviado", envio };
    }

    const url = urlApi();
    if (!url) return await fallar(envio, "Falta configurar NEXT_PUBLIC_API_URL (dirección de Vercel) en el APK.");

    const cuerpo = await armarCuerpo(reporte, envio.destinatarios, pdf.pdf);
    if (!cuerpo) {
      return await fallar(envio, "El PDF pesa más de 3,2 MB y no se pudo subir a Supabase. Revisa la configuración de Supabase.");
    }

    let respuesta: Response;
    try {
      respuesta = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bitacora-token": process.env.NEXT_PUBLIC_BITACORA_TOKEN ?? "" },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout ? AbortSignal.timeout(ESPERA_RESPUESTA_MS) : undefined,
      });
    } catch (e) {
      // Se cayó la señal a mitad del envío: queda en cola. Si hay red, es un error real (CORS, DNS, tiempo).
      if (!(await hayRed())) {
        envio = { ...envio, estado: "en_cola", error: undefined };
        await db.envios.put(envio);
        return { estado: "en_cola", envio };
      }
      return await fallar(envio, `No se pudo contactar el servidor de correo (${mensaje(e)}).`);
    }

    const json = (await respuesta.json().catch(() => null)) as { ok?: boolean; mensajeId?: string; error?: string } | null;
    if (!respuesta.ok || !json?.ok) {
      return await fallar(envio, json?.error ?? `El servidor respondió ${respuesta.status} ${respuesta.statusText}.`);
    }

    const enviadoEn = ahoraISO();
    envio = { ...envio, estado: "enviado", enviadoEn, error: undefined, sincronizadoEn: undefined };
    await db.transaction("rw", [db.envios, db.reportes], async () => {
      await db.envios.put(envio);
      await db.reportes.update(envio.reporteId, { estado: "enviado", sincronizadoEn: undefined });
    });
    void sincronizar(); // deja la nube al día (en segundo plano; nunca lanza errores)
    return { estado: "enviado", envio };
  } catch (e) {
    return fallar(envio, mensaje(e));
  } finally {
    enProceso.delete(base.id);
  }
}

async function fallar(envio: Envio, error: string): Promise<ResultadoEnvio> {
  const e: Envio = { ...envio, estado: "fallido", error, sincronizadoEn: undefined };
  await db.envios.put(e).catch(() => undefined);
  return { estado: "fallido", envio: e, error };
}

/** URL de la función de correo: relativa en la web; la de Vercel (NEXT_PUBLIC_API_URL) en el APK. */
function urlApi(): string | null {
  const enApk = Capacitor.isNativePlatform() || process.env.NEXT_PUBLIC_BUILD_TARGET === "capacitor";
  if (!enApk) return "/api/enviar";
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
  return base ? `${base}/api/enviar` : null;
}

async function armarCuerpo(reporte: Reporte, destinatarios: string[], pdf: Blob): Promise<CuerpoEnvio | null> {
  const [contrato, autor, ats, regs, als] = await Promise.all([
    db.contratos.get(reporte.contratoId),
    db.usuarios.get(reporte.elaboradoPor),
    db.areasTurno.where("reporteId").equals(reporte.id).count(),
    db.registros.where("reporteId").equals(reporte.id).toArray(),
    db.alertas.where("reporteId").equals(reporte.id).toArray(),
  ]);
  const idsReg = regs.map((r) => r.id), idsAl = als.map((a) => a.id);
  const fotos =
    (idsReg.length ? await db.fotografias.where("registroId").anyOf(idsReg).count() : 0) +
    (idsAl.length ? await db.fotografias.where("alertaId").anyOf(idsAl).count() : 0);
  const numero = reporte.correlativo.split("-").pop() ?? reporte.correlativo;
  const nombre = `Reporte diario ${numero} ${reporte.fecha} turno ${reporte.turno === "dia" ? "día" : "noche"}.pdf`;

  const cuerpo: CuerpoEnvio = {
    destinatarios,
    reporte: {
      id: reporte.id,
      correlativo: reporte.correlativo,
      numero,
      fecha: reporte.fecha,
      turno: reporte.turno,
      elaboradoPor: autor?.nombre ?? "Inspector",
      contrato: contrato?.nombre,
      numeroContrato: contrato?.numero,
      mandante: contrato?.mandante,
      codigoProyecto: contrato?.codigoProyecto,
      resumen: reporte.resumenTurno?.trim() || undefined,
      areas: ats,
      registros: regs.filter((r) => !r.sinActividad).length,
      sinActividad: regs.filter((r) => r.sinActividad).length,
      alertas: als.length,
      alertasAltas: als.filter((a) => a.criticidad === "alta").length,
      fotos,
    },
    pdf: { nombre },
  };

  const ruta = await subirPdf(reporte.id); // null si no hay Supabase o falló la subida
  if (ruta) {
    cuerpo.pdf.ruta = ruta;
    return cuerpo;
  }
  if (pdf.size > MAX_PDF_EN_CUERPO) return null;
  cuerpo.pdf.base64 = await blobABase64(pdf);
  return cuerpo;
}

// ───────────────────────── Entrega al jefe de turno (semana 8) ─────────────────────────
//
// Pedido del profesor guía: cada inspector entrega su parte y el jefe de turno envía un solo
// reporte consolidado al mandante. El inspector ya no envía: «Entregar al jefe de turno» deja el
// reporte `entregado` (en Supabase: `aprobado` + `entregado_en`, ver sync.ts) y sube su parte
// (reporte, áreas, registros, alertas, fotos y el PDF parcial). Sin red queda en cola: la subida
// la repite `sincronizar()` cada vez que vuelve la señal (lib/sync.ts y components/Proveedor.tsx).

export type ResultadoEntrega =
  | { estado: "entregado"; entregadoEn: string } // ya está en la nube: el jefe de turno la ve
  | { estado: "en_cola"; entregadoEn: string; motivo: "sin_red" | "sin_nube" | "error"; error?: string }
  | { estado: "fallido"; error: string }; // no se pudo marcar (reporte sin aprobar, sin PDF…)

/** Marca la parte del inspector como entregada al jefe de turno y la sube a Supabase. */
export async function entregarAlJefe(reporteId: string): Promise<ResultadoEntrega> {
  const [reporte, pdf] = await Promise.all([db.reportes.get(reporteId), db.pdfs.get(reporteId)]);
  if (!reporte) return { estado: "fallido", error: "No se encontró el reporte del turno." };
  if (reporte.estado !== "aprobado" && reporte.estado !== "entregado") {
    return { estado: "fallido", error: "La parte debe aprobarse desde la vista previa antes de entregarla." };
  }
  if (!pdf) return { estado: "fallido", error: "Falta el PDF de tu parte. Vuelve a abrir la vista previa." };

  const entregadoEn = reporte.entregadoEn && reporte.estado === "entregado" ? reporte.entregadoEn : ahoraISO();
  if (reporte.estado !== "entregado") {
    await db.reportes.update(reporteId, { estado: "entregado", entregadoEn, sincronizadoEn: undefined });
    // Al entregar se sube la parte completa: lo sembrado como demostración (o algo que ya se hubiera
    // marcado como subido) se vuelve a enviar. El upsert por id no duplica nada.
    await db.transaction("rw", db.registros, db.alertas, db.fotografias, async () => {
      const regs = await db.registros.where("reporteId").equals(reporteId).toArray();
      const als = await db.alertas.where("reporteId").equals(reporteId).toArray();
      await db.registros.bulkUpdate(regs.map((r) => ({ key: r.id, changes: { sincronizadoEn: undefined } })));
      await db.alertas.bulkUpdate(als.map((a) => ({ key: a.id, changes: { sincronizadoEn: undefined } })));
      const fotos = [
        ...(await db.fotografias.where("registroId").anyOf(regs.map((r) => r.id)).toArray()),
        ...(await db.fotografias.where("alertaId").anyOf(als.map((a) => a.id)).toArray()),
      ];
      await db.fotografias.bulkUpdate(fotos.map((f) => ({ key: f.id, changes: { sincronizadoEn: undefined } })));
    });
  }
  return subirEntrega(reporteId, entregadoEn);
}

/** Vuelve a intentar subir una parte ya entregada (botón «Reintentar ahora»). */
export async function reintentarEntrega(reporteId: string): Promise<ResultadoEntrega> {
  const reporte = await db.reportes.get(reporteId);
  if (!reporte || reporte.estado !== "entregado") return { estado: "fallido", error: "La parte no está entregada." };
  return subirEntrega(reporteId, reporte.entregadoEn ?? ahoraISO());
}

async function subirEntrega(reporteId: string, entregadoEn: string): Promise<ResultadoEntrega> {
  if (!supabaseConfigurado) return { estado: "en_cola", entregadoEn, motivo: "sin_nube" };
  if (!(await hayRed())) return { estado: "en_cola", entregadoEn, motivo: "sin_red" };
  const r = await sincronizar(); // nunca lanza: si falla, deja el error y se reintenta después
  if ((await pendientesDeReporte(reporteId)) === 0) return { estado: "entregado", entregadoEn };
  if (!(await hayRed())) return { estado: "en_cola", entregadoEn, motivo: "sin_red" };
  return { estado: "en_cola", entregadoEn, motivo: "error", error: r.error };
}

// ───────────────────────── Envío del consolidado (jefe de turno) ─────────────────────────

export type RespuestaEnvio = { ok: true; mensajeId?: string } | { ok: false; error: string; sinRed?: boolean };

/**
 * Llama a la misma función /api/enviar que usaba el inspector, con el cuerpo ya armado
 * (el jefe de turno manda la ruta del PDF consolidado en el bucket `reportes`). La API no cambia.
 */
export async function enviarCuerpoAlMandante(cuerpo: CuerpoEnvio): Promise<RespuestaEnvio> {
  if (!(await hayRed())) return { ok: false, error: "Sin conexión. Vuelve a intentarlo cuando haya señal.", sinRed: true };
  const url = urlApi();
  if (!url) return { ok: false, error: "Falta configurar NEXT_PUBLIC_API_URL (dirección de Vercel) en el APK." };
  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bitacora-token": process.env.NEXT_PUBLIC_BITACORA_TOKEN ?? "" },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout ? AbortSignal.timeout(ESPERA_RESPUESTA_MS) : undefined,
    });
  } catch (e) {
    const sinRed = !(await hayRed());
    return { ok: false, sinRed, error: sinRed ? "Se cortó la señal durante el envío." : `No se pudo contactar el servidor de correo (${mensaje(e)}).` };
  }
  const json = (await respuesta.json().catch(() => null)) as { ok?: boolean; mensajeId?: string; error?: string } | null;
  if (!respuesta.ok || !json?.ok) return { ok: false, error: json?.error ?? `El servidor respondió ${respuesta.status} ${respuesta.statusText}.` };
  return { ok: true, mensajeId: json.mensajeId };
}

function mensaje(e: unknown): string {
  if (e instanceof Error) return e.name === "TimeoutError" ? "el servidor tardó demasiado en responder" : e.message;
  return String(e);
}

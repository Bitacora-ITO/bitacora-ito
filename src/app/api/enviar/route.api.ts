// POST /api/enviar: envía el reporte diario por correo (Gmail SMTP) con el PDF adjunto.
// Solo existe en la compilación web (Vercel). El APK la llama por NEXT_PUBLIC_API_URL.
//
// Protecciones contra el uso como relé de spam:
//  - encabezado x-bitacora-token igual a BITACORA_TOKEN;
//  - cada destinatario debe estar en MAIL_DESTINATARIOS_PERMITIDOS (correos o dominios);
//  - máximo de destinatarios, tamaño del PDF y solicitudes por IP.
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import type { CuerpoEnvio } from "@/lib/envio";
import { dentroDelLimite, destinatarioPermitido, esCorreo, json, listaPermitidos, opciones, tokenValido } from "../_servidor/comun";
import { asunto, html, textoPlano } from "../_servidor/correo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_DESTINATARIOS = 10;
const MAX_PDF_BYTES = 20 * 1024 * 1024; // Gmail acepta adjuntos de hasta 25 MB
const RUTA_VALIDA = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,200}\.pdf$/;

export function OPTIONS(req: Request) {
  return opciones(req);
}

export async function POST(req: Request) {
  const error = (status: number, mensaje: string) => json(req, { ok: false, error: mensaje }, status);

  if (!dentroDelLimite(req)) return error(429, "Demasiados envíos seguidos. Intenta de nuevo en unos minutos.");

  // 1. Configuración del servidor.
  const usuarioGmail = process.env.GMAIL_USER?.trim();
  const claveGmail = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!process.env.BITACORA_TOKEN) return error(500, "El servidor no tiene configurado BITACORA_TOKEN.");
  if (!usuarioGmail || !claveGmail) return error(500, "El servidor no tiene configurado GMAIL_USER o GMAIL_APP_PASSWORD.");
  const permitidos = listaPermitidos();
  if (!permitidos.length) return error(500, "El servidor no tiene configurado MAIL_DESTINATARIOS_PERMITIDOS.");

  // 2. Autorización.
  if (!tokenValido(req.headers.get("x-bitacora-token"))) return error(401, "Token de la aplicación inválido o ausente.");

  // 3. Validación del cuerpo.
  let cuerpo: CuerpoEnvio;
  try {
    cuerpo = (await req.json()) as CuerpoEnvio;
  } catch {
    return error(400, "El cuerpo de la solicitud no es JSON válido.");
  }
  const r = cuerpo?.reporte;
  if (!r || typeof r.numero !== "string" || typeof r.fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)) {
    return error(400, "Faltan los datos del reporte (número y fecha).");
  }
  const destinatarios = Array.isArray(cuerpo.destinatarios)
    ? [...new Set(cuerpo.destinatarios.map((d) => String(d).trim().toLowerCase()).filter(Boolean))]
    : [];
  if (!destinatarios.length) return error(400, "No hay destinatarios.");
  if (destinatarios.length > MAX_DESTINATARIOS) return error(400, `Máximo ${MAX_DESTINATARIOS} destinatarios por envío.`);
  const invalidos = destinatarios.filter((d) => !esCorreo(d));
  if (invalidos.length) return error(400, `Correo no válido: ${invalidos.join(", ")}.`);
  const noPermitidos = destinatarios.filter((d) => !destinatarioPermitido(d, permitidos));
  if (noPermitidos.length) {
    return error(403, `Destinatario no autorizado: ${noPermitidos.join(", ")}. Agrégalo a MAIL_DESTINATARIOS_PERMITIDOS en Vercel.`);
  }

  // 4. PDF: desde Supabase Storage (ruta) o en base64 dentro del cuerpo.
  let pdf: Buffer;
  try {
    pdf = await obtenerPdf(cuerpo.pdf);
  } catch (e) {
    return error(400, e instanceof Error ? e.message : "No se pudo obtener el PDF.");
  }
  if (pdf.length > MAX_PDF_BYTES) return error(413, "El PDF supera los 20 MB.");
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") return error(400, "El archivo adjunto no es un PDF.");

  // 5. Envío.
  try {
    const transporte = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: usuarioGmail, pass: claveGmail },
    });
    const info = await transporte.sendMail({
      from: { name: "Bitácora ITO", address: usuarioGmail },
      to: destinatarios,
      replyTo: usuarioGmail,
      subject: asunto(r),
      text: textoPlano(r),
      html: html(r),
      attachments: [{ filename: nombreArchivo(cuerpo.pdf?.nombre, r.numero), content: pdf, contentType: "application/pdf" }],
    });
    return json(req, { ok: true, mensajeId: info.messageId });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    const pista = /Invalid login|BadCredentials|535/i.test(m)
      ? " Revisa GMAIL_USER y GMAIL_APP_PASSWORD (debe ser una contraseña de aplicación de Google)."
      : "";
    return error(502, `Gmail rechazó el envío: ${m}.${pista}`);
  }
}

async function obtenerPdf(p: CuerpoEnvio["pdf"] | undefined): Promise<Buffer> {
  if (p?.ruta) {
    const ruta = p.ruta.replace(/^reportes\//, "");
    if (!RUTA_VALIDA.test(ruta) || ruta.includes("..")) throw new Error("Ruta del PDF no válida.");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !clave) {
      throw new Error("El PDF está en Supabase, pero el servidor no tiene NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
    }
    const sb = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.storage.from("reportes").download(ruta);
    if (error || !data) throw new Error(`No se pudo descargar el PDF de Supabase: ${error?.message ?? "sin datos"}.`);
    return Buffer.from(await data.arrayBuffer());
  }
  if (p?.base64) return Buffer.from(p.base64, "base64");
  throw new Error("Falta el PDF (ni ruta en Supabase ni base64).");
}

function nombreArchivo(nombre: string | undefined, numero: string): string {
  const limpio = (nombre ?? "").replace(/[\\/:*?"<>|\r\n]+/g, "-").trim().slice(0, 120);
  if (limpio) return /\.pdf$/i.test(limpio) ? limpio : `${limpio}.pdf`;
  return `Reporte diario ${numero}.pdf`;
}

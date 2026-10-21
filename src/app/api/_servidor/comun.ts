// Utilidades de las funciones de Vercel (solo servidor). La carpeta `_servidor` no genera rutas.
import { timingSafeEqual } from "node:crypto";

/** Orígenes que pueden llamar a la API desde otro dominio (el APK y el desarrollo local). */
function origenesPermitidos(): Set<string> {
  const s = new Set<string>([
    "https://localhost", // APK Android de Capacitor (androidScheme https)
    "capacitor://localhost", // APK iOS de Capacitor
    "http://localhost:3000",
    "http://localhost:3100",
  ]);
  // Dominio propio en Vercel (variables de sistema que Vercel define solo).
  for (const v of [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
    if (v) s.add(`https://${v.replace(/^https?:\/\//, "")}`);
  }
  if (process.env.NEXT_PUBLIC_API_URL) s.add(process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, ""));
  return s;
}

export function encabezadosCors(req: Request, metodos = "POST, OPTIONS"): Record<string, string> {
  const origen = req.headers.get("origin");
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": metodos,
    "Access-Control-Allow-Headers": "Content-Type, x-bitacora-token",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origen && origenesPermitidos().has(origen)) h["Access-Control-Allow-Origin"] = origen;
  return h;
}

export function json(req: Request, cuerpo: unknown, status = 200, metodos?: string): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...encabezadosCors(req, metodos) },
  });
}

export function opciones(req: Request, metodos?: string): Response {
  return new Response(null, { status: 204, headers: encabezadosCors(req, metodos) });
}

/** Compara el token sin filtrar información por el tiempo de respuesta. */
export function tokenValido(recibido: string | null): boolean {
  const esperado = process.env.BITACORA_TOKEN ?? "";
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

const CORREO = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;
export const esCorreo = (s: string) => CORREO.test(s);

/** Lista de MAIL_DESTINATARIOS_PERMITIDOS: correos exactos o dominios («empresa.cl» o «@empresa.cl»). */
export function listaPermitidos(): string[] {
  return (process.env.MAIL_DESTINATARIOS_PERMITIDOS ?? "")
    .split(/[,;\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export function destinatarioPermitido(correo: string, lista = listaPermitidos()): boolean {
  const c = correo.trim().toLowerCase();
  const dominio = c.slice(c.lastIndexOf("@") + 1);
  return lista.some((p) => (p.includes("@") && !p.startsWith("@") ? p === c : p.replace(/^@/, "") === dominio));
}

/** Límite simple por IP (por instancia de la función): frena el abuso sin depender de otro servicio. */
const visitas = new Map<string, number[]>();
export function dentroDelLimite(req: Request, maximo = 20, ventanaMs = 10 * 60_000): boolean {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconocida";
  const ahora = Date.now();
  const lista = (visitas.get(ip) ?? []).filter((t) => ahora - t < ventanaMs);
  lista.push(ahora);
  visitas.set(ip, lista);
  if (visitas.size > 5000) visitas.clear();
  return lista.length <= maximo;
}

export const escaparHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

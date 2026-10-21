// GET /api/salud: dice qué variables de entorno están configuradas en el servidor, sin mostrar sus valores.
// Sirve para revisar la configuración de Vercel después de cada despliegue.
import { json, listaPermitidos, opciones } from "../_servidor/comun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "MAIL_DESTINATARIOS_PERMITIDOS",
  "BITACORA_TOKEN",
  "NEXT_PUBLIC_BITACORA_TOKEN",
  "NEXT_PUBLIC_API_URL",
] as const;

export function OPTIONS(req: Request) {
  return opciones(req, "GET, OPTIONS");
}

export function GET(req: Request) {
  const variables = Object.fromEntries(VARIABLES.map((v) => [v, Boolean(process.env[v]?.trim())]));
  const correoListo = variables.GMAIL_USER && variables.GMAIL_APP_PASSWORD && variables.MAIL_DESTINATARIOS_PERMITIDOS && variables.BITACORA_TOKEN;
  const tokenCoincide = Boolean(process.env.BITACORA_TOKEN) && process.env.BITACORA_TOKEN === process.env.NEXT_PUBLIC_BITACORA_TOKEN;
  return json(
    req,
    {
      ok: true,
      servicio: "Bitácora ITO",
      entorno: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "desconocido",
      variables,
      resumen: {
        correo: Boolean(correoListo),
        supabase: variables.NEXT_PUBLIC_SUPABASE_URL && variables.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        pdfDesdeSupabase: variables.NEXT_PUBLIC_SUPABASE_URL && variables.SUPABASE_SERVICE_ROLE_KEY,
        destinatariosPermitidos: listaPermitidos().length,
        // Solo indica si los dos tokens son iguales; no muestra ninguno.
        tokenWebCoincide: tokenCoincide,
      },
    },
    200,
    "GET, OPTIONS",
  );
}

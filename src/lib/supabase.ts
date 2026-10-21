// Cliente de Supabase para el navegador y el APK (clave pública «anon»).
// Si faltan las variables, `obtenerSupabase()` devuelve null y la app sigue funcionando sin nube.
// La clave de servicio (SUPABASE_SERVICE_ROLE_KEY) NUNCA se usa aquí: es solo del servidor (src/app/api).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Next reemplaza estas referencias literales al compilar (también en la exportación del APK).
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CLAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const BUCKET_FOTOS = "fotos";
export const BUCKET_REPORTES = "reportes";

export const supabaseConfigurado = Boolean(URL_SUPABASE && CLAVE_ANON);

let cliente: SupabaseClient | null = null;

/** Cliente único de Supabase, o null si no está configurado. */
export function obtenerSupabase(): SupabaseClient | null {
  if (!supabaseConfigurado) return null;
  if (!cliente) {
    cliente = createClient(URL_SUPABASE, CLAVE_ANON, {
      // La maqueta no usa inicio de sesión: todo va con el rol anon (ver la migración y sus riesgos).
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return cliente;
}

/** Ruta del PDF de un reporte dentro del bucket `reportes`. Se sobrescribe si el PDF se vuelve a generar. */
export function rutaPdfReporte(r: { id: string; fecha: string; turno: string }): string {
  return `${r.fecha}/${r.id}-${r.turno}.pdf`;
}

/** Ruta de una fotografía dentro del bucket `fotos`. */
export function rutaFoto(fotoId: string, reporteId?: string): string {
  return `${reporteId ?? "sin-reporte"}/${fotoId}.jpg`;
}

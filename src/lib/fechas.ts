// Utilidades de fechas en hora local del teléfono. Los días se manejan como "YYYY-MM-DD".
import { hoyLocal } from "./db";

export { hoyLocal };

const z = (n: number) => String(n).padStart(2, "0");

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
/** Encabezado del calendario, de lunes a domingo. */
export const INICIALES_SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

/** "2026-10-14" → Date a las 12:00 locales (evita saltos por horario de verano). */
export function aFecha(dia: string): Date {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(a, m - 1, d, 12, 0, 0, 0);
}

export function sumarDias(dia: string, n: number): string {
  const f = aFecha(dia);
  f.setDate(f.getDate() + n);
  return hoyLocal(f);
}

/** Días entre dos fechas (b − a), sin importar la hora. */
export function diferenciaDias(a: string, b: string): number {
  return Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / 86_400_000);
}

/** "2026-10-14" → "14-10-2026", tal como se imprime en el reporte. */
export function fechaCorta(dia: string): string {
  const [a, m, d] = dia.split("-");
  return `${d}-${m}-${a}`;
}

/** "2026-10-14" → "14-10". */
export function diaMes(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}-${m}`;
}

/** "2026-10-08" → "jueves 08-10-2026". */
export function fechaConDia(dia: string): string {
  return `${DIAS_SEMANA[aFecha(dia).getDay()]} ${fechaCorta(dia)}`;
}

/** ISO → "17:58" en hora local. */
export function hora(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${z(d.getHours())}:${z(d.getMinutes())}`;
}

/** Instante ISO para un día local y una hora "HH:MM". */
export function instante(dia: string, hhmm: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(a, m - 1, d, h, mi, 0, 0).toISOString();
}

/** Día local ("YYYY-MM-DD") de un instante ISO. */
export function diaDe(iso: string): string {
  return hoyLocal(new Date(iso));
}

/** "hace 4 min", "hace 2 h", "recién". */
export function haceCuanto(iso?: string, ahora = Date.now()): string {
  if (!iso) return "";
  const min = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

/** Minutos → "2 h 02 min". */
export function duracion(min: number): string {
  const m = Math.abs(Math.round(min));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} h ${z(m % 60)} min` : `${m} min`;
}

/** Nombre corto para la interfaz: "Jorge Orellana S." → "J. Orellana". */
export function nombreCorto(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length < 2) return nombre;
  return `${partes[0][0]}. ${partes[1]}`;
}

/** Celdas de un mes para un calendario de lunes a domingo (null = celda vacía). */
export function celdasMes(anio: number, mes0: number): (string | null)[] {
  const primero = new Date(anio, mes0, 1, 12);
  const desfase = (primero.getDay() + 6) % 7; // lunes = 0
  const dias = new Date(anio, mes0 + 1, 0).getDate();
  const celdas: (string | null)[] = Array(desfase).fill(null);
  for (let d = 1; d <= dias; d++) celdas.push(`${anio}-${z(mes0 + 1)}-${z(d)}`);
  while (celdas.length % 7) celdas.push(null);
  return celdas;
}

export function nombreMes(mes0: number): string {
  return MESES[((mes0 % 12) + 12) % 12];
}

export function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

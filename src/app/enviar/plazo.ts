/** Minutos de `desde` a `hasta` (positivo si `desde` es anterior). */
export function diferenciaMin(desde: string, hasta: string): number {
  return Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 60_000);
}

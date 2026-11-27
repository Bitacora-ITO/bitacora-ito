// Reglas de validación del registro de avance: un solo lugar para los límites y los mensajes.
// Las usan el formulario (navegador) y repositorio.ts antes de guardar. La base de datos repite las mismas
// reglas en supabase/migrations/0003_reglas_registro.sql: si se cambia un número aquí, se cambia también allá.
// Detalle de cada regla: docs/robustecimiento.md (Parte 1 de la propuesta de reglas del 27-11-2026).

/** Largo de la descripción del avance, contado sin los espacios del inicio y del final. */
export const DESCRIPCION_MIN = 5;
export const DESCRIPCION_MAX = 500;

/** Fotografías por registro de avance (las alertas no tienen este tope). */
export const FOTOS_MAX_REGISTRO = 10;

/** Tolerancia para un reloj de teléfono adelantado: la hora del registro puede ir hasta 10 min en el futuro. */
export const HORA_FUTURA_TOLERANCIA_MIN = 10;

/** Cuenta caracteres como los ve la persona (una letra con tilde o un emoji cuentan como 1). */
export function largoTexto(texto: string): number {
  return [...texto.trim()].length;
}

export const MENSAJES = {
  descripcionVacia: "Dicta o escribe qué se avanzó.",
  descripcionCorta: `Escribe al menos ${DESCRIPCION_MIN} caracteres.`,
  descripcionLarga: (n: number) => `Máximo ${DESCRIPCION_MAX} caracteres (llevas ${n}).`,
  fotoFalta: "Toma al menos 1 fotografía del avance.",
  fotosMax: `Puedes adjuntar hasta ${FOTOS_MAX_REGISTRO} fotos por registro.`,
  empresaFalta: "Elige la empresa.",
} as const;

/**
 * Error de la descripción, o undefined si cumple. Sin actividad no se exige descripción.
 * Misma regla en el formulario y al guardar.
 */
export function errorDescripcion(descripcion: string, sinActividad: boolean): string | undefined {
  if (sinActividad) return undefined;
  const n = largoTexto(descripcion);
  if (n === 0) return MENSAJES.descripcionVacia;
  if (n < DESCRIPCION_MIN) return MENSAJES.descripcionCorta;
  if (n > DESCRIPCION_MAX) return MENSAJES.descripcionLarga(n);
  return undefined;
}

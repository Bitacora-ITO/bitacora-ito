// Medidas y colores del formato real del mandante (FRMCS-00001, REV1).
//
// El PDF real (exportado desde Excel) tiene una página de 1854,55 × 2400 pt, que es carta
// (8,5 × 11 in) a escala ×3,03. Todas las medidas de este archivo están en esas unidades
// originales, medidas con PyMuPDF sobre el informe del 27-09-2026, y `u()` las lleva a
// puntos de una hoja carta real (612 × 792 pt). Así el código se lee contra el original.

export const ANCHO_ORIGINAL = 1854.55;
export const K = 612 / ANCHO_ORIGINAL; // 0,33

/** Unidades del original → puntos de la hoja carta. */
export const u = (v: number): number => v * K;

export const PAGINA = { ancho: 612, alto: 792 } as const;

/** Márgenes de la página (unidades originales). */
export const MARGEN = {
  arriba: 162.2,
  abajo: 150,
  izquierda: 200.8,
  derecha: ANCHO_ORIGINAL - 1686.9,
} as const;

/** Origen del contenido: borde interior del marco izquierdo doble y borde superior del marco. */
export const ORIGEN = { x: 203.0, y: 162.2 } as const;

export const COLOR = {
  negro: "#000000",
  rojo: "#ff0000",
  blanco: "#ffffff",
  cabeceraAlertas: "#4471c4",
  tituloFotos: "#0070c0",
  bordeFoto: "#161ff1",
  climaMarcado: "#1620f2",
  climaX: "#321cfc",
  numeroPagina: "#595959",
} as const;

/** Grosor de las líneas de tabla del original (0,73 u ≈ 0,24 pt). */
export const LINEA = 0.73;

/** Tamaños de letra del original. */
export const TAM = {
  codigos: 10.91,
  titulo: 12,
  elaborador: 13.09,
  campo: 14.18,
  x: 18.18,
  alerta: 16,
  cuerpo: 17.09,
  tituloFotos: 20,
} as const;

/** Paso entre renglones (alto de fila de Excel) del cuerpo y de las alertas. */
export const RENGLON = 21.8;
export const RENGLON_ALERTA = 20.3;

/** Ascent de Carlito (hhea) por unidad de tamaño: react-pdf ubica la línea base en top + ascent. */
export const ASCENT = 0.9521484375;

export const FAMILIA = "Carlito";

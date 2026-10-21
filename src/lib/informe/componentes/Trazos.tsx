// Líneas del formato dibujadas como trazos vectoriales (como el original de Excel).
// Los bordes de <View> de react-pdf son trazos recortados: en pantalla, con 0,24 pt, salen grises.
// Un trazo sin recorte lo dibujan todos los visores con al menos un píxel: queda nítido y negro.
import { Canvas } from "@react-pdf/renderer";
import { COLOR, LINEA, ORIGEN, u } from "./medidas";

/** Subconjunto del «painter» de react-pdf (API de pdfkit) que se usa aquí. */
export interface Pintor {
  moveTo(x: number, y: number): Pintor;
  lineTo(x: number, y: number): Pintor;
  rect(x: number, y: number, w: number, h: number): Pintor;
  lineWidth(w: number): Pintor;
  strokeColor(c: string): Pintor;
  stroke(): Pintor;
  lineCap(c: "butt" | "round" | "square"): Pintor;
}

/** Lienzo que cubre a su padre; `dibujar` recibe el ancho y alto finales (en pt). */
export function Lienzo({ dibujar }: { dibujar: (p: Pintor, ancho: number, alto: number) => void }) {
  return (
    <Canvas
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      paint={(p: Pintor, ancho: number, alto: number) => {
        p.lineCap("butt");
        dibujar(p, ancho, alto);
        return null;
      }}
    />
  );
}

/** Ayudante en unidades originales con un origen dado (por defecto, el del contenido). */
export function trazador(p: Pintor, ox: number = ORIGEN.x, oy: number = ORIGEN.y, grosor: number = LINEA, color: string = COLOR.negro) {
  const X = (x: number) => u(x - ox);
  const Y = (y: number) => u(y - oy);
  const iniciar = () => p.lineWidth(u(grosor)).strokeColor(color);
  return {
    /** Línea horizontal centrada en y. */
    h(x0: number, x1: number, y: number) {
      iniciar().moveTo(X(x0), Y(y)).lineTo(X(x1), Y(y)).stroke();
    },
    /** Línea vertical centrada en x. */
    v(x: number, y0: number, y1: number) {
      iniciar().moveTo(X(x), Y(y0)).lineTo(X(x), Y(y1)).stroke();
    },
    /** Caja cuyo borde exterior es [x0,x1]×[y0,y1] (el trazo queda hacia adentro). */
    caja(x0: number, y0: number, x1: number, y1: number) {
      const m = grosor / 2;
      iniciar().rect(X(x0 + m), Y(y0 + m), u(x1 - x0 - grosor), u(y1 - y0 - grosor)).stroke();
    },
  };
}

// Marco izquierdo doble del original: líneas de 0,73 u en x = 200,8–201,5 y 202,2–203,0.
const MARCO_X = [200.8 + LINEA / 2, 202.2 + LINEA / 2];

/**
 * Tramo del marco izquierdo a lo alto del bloque que lo contiene. Cada bloque (encabezado, alertas,
 * secciones) dibuja su tramo, así el marco se corta limpio en los saltos de página.
 */
export function TramoMarco({ desde = 0, hasta = 0 }: { desde?: number; hasta?: number }) {
  return (
    <Lienzo
      dibujar={(p, _ancho, alto) => {
        for (const x of MARCO_X) {
          p.lineWidth(u(LINEA))
            .strokeColor(COLOR.negro)
            .moveTo(u(x - ORIGEN.x), u(desde))
            .lineTo(u(x - ORIGEN.x), alto + u(hasta))
            .stroke();
        }
      }}
    />
  );
}

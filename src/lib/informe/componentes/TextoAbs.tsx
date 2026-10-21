import type { ReactNode } from "react";
import { Text } from "@react-pdf/renderer";
import { ASCENT, COLOR, ORIGEN, u } from "./medidas";

interface Props {
  /** x del borde izquierdo del texto (o de la caja, si se centra), en unidades originales. */
  x: number;
  /** Línea base, en unidades originales. */
  base: number;
  tam: number;
  negrita?: boolean;
  color?: string;
  /** Si se indica, el texto se centra dentro de [x, x + ancho]. */
  ancho?: number;
  children: ReactNode;
}

/** Texto en posición absoluta, ubicado por su línea base igual que en el original. */
export default function TextoAbs({ x, base, tam, negrita, color = COLOR.negro, ancho, children }: Props) {
  const arriba = base - ASCENT * tam;
  return (
    <Text
      style={{
        position: "absolute",
        left: u(x - ORIGEN.x),
        top: u(arriba - ORIGEN.y),
        width: ancho !== undefined ? u(ancho) : undefined,
        textAlign: ancho !== undefined ? "center" : "left",
        fontSize: u(tam),
        lineHeight: 1.25,
        fontWeight: negrita ? "bold" : "normal",
        color,
      }}
    >
      {children}
    </Text>
  );
}

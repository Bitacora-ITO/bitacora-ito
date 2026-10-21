// «1. ALERTAS»: tabla de 4 columnas con cabecera azul y texto en rojo, más la línea que cierra el
// encabezado. Va en flujo (no absoluta) para que crezca si hay muchas alertas; el alto mínimo es el
// del original. Las líneas son trazos (Trazos.tsx).
import { Text, View } from "@react-pdf/renderer";
import type { ColumnaAlerta } from "../../types";
import type { AlertaInforme } from "../tipos";
import { Lienzo, TramoMarco, trazador } from "./Trazos";
import { ASCENT, COLOR, LINEA, ORIGEN, RENGLON_ALERTA, TAM, u } from "./medidas";

// Bordes de la tabla y de las columnas (unidades originales, medidos en el original).
const X0 = 214.6;
const X1 = 1547.2;
const SEPARADORES = [586.3, 998.7, 1314.1]; // borde izquierdo de cada separador de 0,73 u
const COLUMNAS: { clave: ColumnaAlerta; titulo: string }[] = [
  { clave: "construccion", titulo: "CONSTRUCCIÓN" },
  { clave: "laboratorio", titulo: "LABORATORIO" },
  { clave: "topografia", titulo: "TOPOGRAFIA" },
  { clave: "interferencia", titulo: "INTERFERENCIA / HECHO NOTABLE" },
];
const Y_TABLA = 369.1; // borde superior
const Y_CABECERA = 386.6; // línea bajo «1. ALERTAS» (y comienzo del azul)
const Y_CONTENIDO = 415.7; // línea bajo la cabecera azul
const Y_FIN_MIN = 522.2; // borde inferior (alto mínimo)
const Y_LINEA_CIERRE = 534.1; // línea que cierra el encabezado, de borde a borde
const Y_PRIMERA_SECCION = 552.5;
const DEBAJO = Y_PRIMERA_SECCION - Y_FIN_MIN; // espacio entre la tabla y la primera sección

/** Límites [x0, x1] del área de cada columna (entre líneas). */
function columna(i: number): [number, number] {
  const izq = i === 0 ? X0 : SEPARADORES[i - 1];
  const der = i === COLUMNAS.length - 1 ? X1 - LINEA : SEPARADORES[i];
  return [izq + LINEA, der];
}

function Alerta({ alerta, primera }: { alerta: AlertaInforme; primera: boolean }) {
  const estilo = { fontSize: u(TAM.alerta), lineHeight: RENGLON_ALERTA / TAM.alerta, color: COLOR.rojo };
  const cabecera = alerta.empresa ?? "";
  const criticidad = alerta.criticidad ? `Criticidad ${alerta.criticidad}` : "";
  return (
    <View wrap={false} style={{ marginTop: primera ? 0 : u(RENGLON_ALERTA * 0.5) }}>
      {cabecera || criticidad ? (
        <Text style={{ ...estilo, fontWeight: "bold" }}>
          {cabecera}
          {/* La criticidad (dato de la app, no del formato) va discreta: mismo rojo, sin negrita. */}
          {criticidad ? <Text style={{ fontWeight: "normal" }}>{cabecera ? ` · ${criticidad}` : criticidad}</Text> : null}
        </Text>
      ) : null}
      <Text style={{ ...estilo, fontWeight: "bold" }}>{alerta.texto}</Text>
    </View>
  );
}

export default function TablaAlertas({ alertas }: { alertas: Record<ColumnaAlerta, AlertaInforme[]> }) {
  // Primera línea base del texto en el original: 431,7.
  const rellenoArriba = 431.7 - (Y_CONTENIDO + LINEA) - ASCENT * TAM.alerta;
  return (
    <View wrap={false} style={{ paddingBottom: u(DEBAJO) }}>
      <TramoMarco />
      <Lienzo
        dibujar={(p, _ancho, alto) => {
          const yFin = alto / u(1) - DEBAJO + Y_TABLA; // borde inferior real de la tabla (y del original)
          const t = trazador(p, ORIGEN.x, Y_TABLA);
          const m = LINEA / 2;
          t.caja(X0, Y_TABLA, X1, yFin);
          t.h(X0, X1, Y_CABECERA + m);
          t.h(X0, X1, Y_CONTENIDO + m);
          for (const x of SEPARADORES) t.v(x + m, Y_CABECERA + LINEA, yFin);
          // Línea de cierre del encabezado (en el original, un trazo de 0,36 u de borde a borde)
          trazador(p, ORIGEN.x, Y_TABLA, 0.36).h(ORIGEN.x, 1686.9, yFin + (Y_LINEA_CIERRE - Y_FIN_MIN));
        }}
      />
      <View style={{ marginLeft: u(X0 - ORIGEN.x), width: u(X1 - X0) }}>
        {/* Fila «1. ALERTAS» */}
        <View style={{ height: u(Y_CABECERA + LINEA - Y_TABLA) }}>
          <Text
            style={{
              position: "absolute",
              left: u(217.1 - X0),
              top: u(383.3 - ASCENT * TAM.titulo - Y_TABLA),
              fontSize: u(TAM.titulo),
              lineHeight: 1.25,
              fontWeight: "bold",
            }}
          >
            1. ALERTAS
          </Text>
        </View>

        {/* Cabecera azul (entre las líneas 386,6 y 415,7) */}
        <View style={{ height: u(Y_CONTENIDO - Y_CABECERA - LINEA), backgroundColor: COLOR.cabeceraAlertas, marginHorizontal: u(LINEA) }}>
          {COLUMNAS.map((c, i) => {
            const [a, b] = columna(i);
            return (
              <Text
                key={c.clave}
                style={{
                  position: "absolute",
                  left: u(a - X0 - LINEA),
                  width: u(b - a),
                  top: u(405.2 - ASCENT * TAM.titulo - (Y_CABECERA + LINEA)),
                  textAlign: "center",
                  fontSize: u(TAM.titulo),
                  lineHeight: 1.25,
                  fontWeight: "bold",
                  color: COLOR.blanco,
                }}
              >
                {c.titulo}
              </Text>
            );
          })}
        </View>

        {/* Contenido: columnas en flujo, para que la fila crezca con el texto */}
        <View style={{ flexDirection: "row", minHeight: u(Y_FIN_MIN - Y_CONTENIDO), paddingTop: u(LINEA), paddingBottom: u(LINEA) }}>
          {COLUMNAS.map((c, i) => {
            const [a, b] = columna(i);
            return (
              <View
                key={c.clave}
                style={{
                  marginLeft: u(LINEA),
                  width: u(b - a),
                  paddingLeft: u(217.5 - 215.3),
                  paddingRight: u(2.2),
                  paddingTop: u(rellenoArriba),
                  paddingBottom: u(4),
                }}
              >
                {(alertas[c.clave] ?? []).map((al, j) => (
                  <Alerta key={j} alerta={al} primera={j === 0} />
                ))}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

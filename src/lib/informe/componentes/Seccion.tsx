// Una sección del cuerpo: caja de doble línea con el texto a la izquierda y columna de fotos a la derecha.
import { Image, Text, View } from "@react-pdf/renderer";
import type { LineaInforme, SeccionInforme, SubseccionInforme } from "../tipos";
import { Lienzo, TramoMarco, trazador } from "./Trazos";
import { ASCENT, COLOR, LINEA, MARGEN, ORIGEN, RENGLON, TAM, u } from "./medidas";

/** Foto ya cargada (data URL) con sus dimensiones naturales en píxeles. */
export interface FotoPreparada {
  src: string;
  ancho: number;
  alto: number;
  pie?: string;
}

export interface SeccionPreparada extends Omit<SeccionInforme, "fotos"> {
  fotos: FotoPreparada[];
}

// Geometría del original (unidades de medidas.ts)
const CAJA_X0 = 261.5; // borde exterior izquierdo de la caja doble
const CAJA_X1 = 1000.2; // borde exterior derecho
const SEPARACION_DOBLE = 0.75; // espacio entre las dos líneas
const TEXTO_X = 265.1; // inicio del texto
// Ancho útil del texto. Excel imprime ~0,5 % más ancho que la métrica nominal de Calibri/Carlito, así
// que corta antes que el ancho de la celda (731,5 u). Con 727 u se reproducen todos los cortes del original.
const ANCHO_TEXTO = 727;
const FOTOS_X = 1142.4; // borde exterior izquierdo del marco azul de las fotos
const BORDE_FOTO = 3;
const ANCHO_FOTO = 259; // con dos o más fotos (Muro Sotelo)
const ANCHO_FOTO_UNICA = 355.4; // con una sola foto (Morning Glory)
const SEPARACION_FOTOS = 12.3 - BORDE_FOTO; // entre marcos
const TITULO_FOTOS_BASE = 572.8 - 552.5; // línea base del título azul desde el borde superior de la sección
const TITULO_FOTOS_ALTO = 577.1 - 552.5; // el marco de la primera foto empieza aquí
const PROPORCION_MIN = 4 / 3; // fotos más altas se recortan a 4:3
const PROPORCION_MAX = 1.9; // fotos más anchas se recortan a 1,9:1

export const SEPARACION_SECCIONES = 14;

const ALTO_UTIL = 2400 - MARGEN.arriba - MARGEN.abajo;

const cuerpo = {
  fontSize: u(TAM.cuerpo),
  lineHeight: u(RENGLON) / u(TAM.cuerpo),
  color: COLOR.negro,
} as const;

export function medidasFoto(foto: FotoPreparada, unica: boolean): { ancho: number; alto: number } {
  const ancho = unica ? ANCHO_FOTO_UNICA : ANCHO_FOTO;
  const natural = foto.ancho > 0 && foto.alto > 0 ? foto.ancho / foto.alto : 1.75;
  const proporcion = Math.min(PROPORCION_MAX, Math.max(PROPORCION_MIN, natural));
  return { ancho, alto: ancho / proporcion };
}

function Linea({ linea }: { linea: LineaInforme }) {
  if (linea.tipo === "sin_actividad") {
    return <Text style={{ ...cuerpo, fontWeight: "bold", color: COLOR.rojo }}>{`- ${linea.texto}`}</Text>;
  }
  if (linea.destacado) {
    return (
      <Text style={cuerpo}>
        <Text style={{ fontWeight: "bold" }}>{`- ${linea.destacado}`}</Text>
        {linea.texto ? ` ${linea.texto}` : ""}
      </Text>
    );
  }
  return <Text style={cuerpo}>{`- ${linea.texto}`}</Text>;
}

function Subseccion({ sub, primera }: { sub: SubseccionInforme; primera: boolean }) {
  const titulo = [sub.numero, sub.titulo].filter(Boolean).join(" ");
  return (
    <View style={{ marginTop: primera ? 0 : u(RENGLON) }}>
      {titulo ? (
        <Text minPresenceAhead={u(RENGLON * 2)} style={{ ...cuerpo, fontWeight: "bold" }}>
          {titulo}
        </Text>
      ) : null}
      {sub.lineas.map((l, i) => (
        <Linea key={i} linea={l} />
      ))}
    </View>
  );
}

function ColumnaFotos({ seccion }: { seccion: SeccionPreparada }) {
  if (seccion.fotos.length === 0) return null;
  const unica = seccion.fotos.length === 1;
  const anchoMarco = (unica ? ANCHO_FOTO_UNICA : ANCHO_FOTO) + BORDE_FOTO;
  return (
    <View style={{ marginLeft: u(FOTOS_X - CAJA_X1), width: u(anchoMarco) }}>
      <View style={{ height: u(TITULO_FOTOS_ALTO) }}>
        {seccion.tituloFotos ? (
          <Text
            style={{
              position: "absolute",
              left: u(-60),
              right: u(-60),
              top: u(TITULO_FOTOS_BASE - ASCENT * TAM.tituloFotos),
              textAlign: "center",
              fontSize: u(TAM.tituloFotos),
              lineHeight: 1.25,
              fontWeight: "bold",
              color: COLOR.tituloFotos,
            }}
          >
            {seccion.tituloFotos}
          </Text>
        ) : null}
      </View>
      {seccion.fotos.map((f, i) => {
        const m = medidasFoto(f, unica);
        return (
          <View key={i} wrap={false} style={{ marginTop: i === 0 ? 0 : u(SEPARACION_FOTOS) }}>
            <View
              style={{
                width: u(m.ancho + BORDE_FOTO),
                height: u(m.alto + BORDE_FOTO),
                borderWidth: u(BORDE_FOTO),
                borderColor: COLOR.bordeFoto,
              }}
            >
              <Image src={f.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </View>
            {f.pie ? (
              <Text style={{ marginTop: u(3), fontSize: u(TAM.codigos * 1.2), lineHeight: 1.2, textAlign: "center", color: COLOR.negro }}>
                {f.pie}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Alto aproximado (unidades originales) para decidir si la sección cabe entera en una página. */
function altoEstimado(seccion: SeccionPreparada): { texto: number; fotos: number } {
  const caracteresPorRenglon = 88;
  let renglones = 1;
  seccion.subsecciones.forEach((s, i) => {
    if (i > 0) renglones += 1;
    if (s.numero || s.titulo) renglones += 1;
    for (const l of s.lineas) {
      const largo = 2 + (l.destacado ? l.destacado.length + 1 : 0) + l.texto.length;
      renglones += Math.max(1, Math.ceil(largo / caracteresPorRenglon));
    }
  });
  const unica = seccion.fotos.length === 1;
  let fotos = seccion.fotos.length ? TITULO_FOTOS_ALTO : 0;
  seccion.fotos.forEach((f, i) => {
    fotos += medidasFoto(f, unica).alto + BORDE_FOTO + (i ? SEPARACION_FOTOS : 0) + (f.pie ? 20 : 0);
  });
  return { texto: renglones * RENGLON + 6, fotos };
}

export default function Seccion({ seccion, primera }: { seccion: SeccionPreparada; primera: boolean }) {
  const alto = altoEstimado(seccion);
  // La sección no se parte salvo que sea más alta que una página completa.
  const cabeEntera = Math.max(alto.texto, alto.fotos) < ALTO_UTIL * 0.96;
  const tituloSeccion = [seccion.numero, seccion.titulo].filter(Boolean).join(" ");
  const grosorDoble = 2 * LINEA + SEPARACION_DOBLE; // dos líneas y el espacio entre ellas
  const rellenoIzq = TEXTO_X - CAJA_X0;
  const rellenoDer = CAJA_X1 - CAJA_X0 - rellenoIzq - ANCHO_TEXTO;
  return (
    <View
      wrap={!cabeEntera}
      style={{ flexDirection: "row", alignItems: "flex-start", paddingTop: primera ? 0 : u(SEPARACION_SECCIONES) }}
    >
      <TramoMarco />
      {/* Caja de doble línea: exterior e interior de 0,73 u separadas 0,75 u (trazos, como el original) */}
      <View
        style={{
          marginLeft: u(CAJA_X0 - ORIGEN.x),
          width: u(CAJA_X1 - CAJA_X0),
          paddingLeft: u(rellenoIzq),
          paddingRight: u(rellenoDer),
          paddingTop: u(grosorDoble + 1),
          paddingBottom: u(grosorDoble + 1.5),
        }}
      >
        <Lienzo
          dibujar={(p, ancho, altoCaja) => {
            const t = trazador(p, 0, 0);
            const a = ancho / u(1);
            const h = altoCaja / u(1);
            const d = LINEA + SEPARACION_DOBLE;
            t.caja(0, 0, a, h);
            t.caja(d, d, a - d, h - d);
          }}
        />
        {tituloSeccion ? (
          <Text minPresenceAhead={u(RENGLON * 2)} style={{ ...cuerpo, fontWeight: "bold" }}>
            {tituloSeccion}
          </Text>
        ) : null}
        {seccion.subsecciones.map((s, i) => (
          <Subseccion key={i} sub={s} primera={i === 0} />
        ))}
      </View>
      <ColumnaFotos seccion={seccion} />
    </View>
  );
}

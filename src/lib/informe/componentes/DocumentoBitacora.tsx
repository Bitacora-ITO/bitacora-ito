// Reporte diario con el diseño propio de Bitácora ITO: hoja carta, encabezado con el logo de la app,
// ficha del turno, resumen en cifras, alertas ordenadas por criticidad y actividades por área con sus
// fotografías. Usa los mismos datos (DatosInforme) que el formato del mandante.
// Prueba de usuarios (hallazgo 5): cada foto va justo después de la descripción de su registro y la foto de
// una alerta, junto a esa alerta. Las fotos sin registro conocido quedan al final de su área, como antes.
// La numeración «Foto N» sigue el orden en que aparecen en el documento.
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { Clima, ColumnaAlerta, Criticidad } from "../../types";
import type { AlertaInforme, DatosInforme, LineaInforme, SubseccionInforme } from "../tipos";
import type { FotoPreparada, SeccionPreparada } from "./Seccion";
import { FAMILIA } from "./medidas";

export interface PropsDocumentoBitacora {
  datos: DatosInforme;
  secciones: SeccionPreparada[];
  logo?: string;
  familia?: string;
}

const C = {
  tinta: "#1E2B38",
  texto: "#2B3742",
  gris: "#5B6875",
  grisSuave: "#8A96A3",
  borde: "#DDE3E8",
  fondo: "#F4F7F9",
  turquesa: "#35D2C3",
  turquesaOscuro: "#0F8F83",
  turquesaFondo: "#E3F7F4",
} as const;

const CRITICIDAD: Record<Criticidad, { texto: string; color: string; fondo: string; orden: number }> = {
  alta: { texto: "ALTA", color: "#C62828", fondo: "#FDECEC", orden: 0 },
  media: { texto: "MEDIA", color: "#9A6B00", fondo: "#FFF3D6", orden: 1 },
  baja: { texto: "BAJA", color: "#5B6875", fondo: "#EEF1F4", orden: 2 },
};
const COLUMNAS: ColumnaAlerta[] = ["construccion", "laboratorio", "topografia", "interferencia"];
const NOMBRE_COLUMNA: Record<ColumnaAlerta, string> = {
  construccion: "Construcción",
  laboratorio: "Laboratorio",
  topografia: "Topografía",
  interferencia: "Interferencia",
};
const CLIMA: Record<Clima, string> = { despejado: "Despejado", nublado: "Nublado", lluvia: "Lluvia" };

// Hoja carta (612 × 792 pt)
const MARGEN_X = 40;
const ANCHO = 612 - 2 * MARGEN_X;
const FOTOS_POR_FILA = 3;
const ESPACIO_FOTOS = 8;
const ANCHO_FOTO = (ANCHO - ESPACIO_FOTOS * (FOTOS_POR_FILA - 1)) / FOTOS_POR_FILA;
const ALTO_FOTO = ANCHO_FOTO * 0.72;

const numeroCorto = (correlativo: string) => correlativo.split("-").pop() || correlativo;
const nombreTurno = (t: string) => (t === "noche" ? "Noche" : "Día");
/** "VERTEDERO MORNING GLORY" → "Vertedero Morning Glory" (las siglas cortas quedan en mayúsculas). */
function nombrePropio(s: string): string {
  return s
    .toLocaleLowerCase("es-CL")
    .replace(/(^|[\s(/-])(\p{L})/gu, (_, a: string, b: string) => a + b.toLocaleUpperCase("es-CL"))
    .replace(/(?<=\s)(De|Del|La|Las|Los|El|Y|E|A|En|Para|Por|Con)(?=\s)/g, (m) => m.toLocaleLowerCase("es-CL"))
    .replace(/(?<![\p{L}])(Sma|Oocc|Pamo|Idiem|Zcf|Pk|Cag)(?![\p{L}])/gu, (m) => (m === "Pamo" ? "PAMo" : m.toUpperCase()));
}

function TituloBloque({ children, extra }: { children: string; extra?: string }) {
  return (
    <View minPresenceAhead={60} style={{ flexDirection: "row", alignItems: "center", marginTop: 18, marginBottom: 8 }}>
      <View style={{ width: 3, height: 11, backgroundColor: C.turquesa, marginRight: 6 }} />
      <Text style={{ fontSize: 10, fontWeight: "bold", color: C.tinta, letterSpacing: 0.8 }}>{children.toUpperCase()}</Text>
      {extra ? <Text style={{ fontSize: 8.5, color: C.gris, marginLeft: 6 }}>{extra}</Text> : null}
    </View>
  );
}

function Encabezado({ datos, logo }: { datos: DatosInforme; logo?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: C.turquesa }}>
      {logo ? <Image src={logo} style={{ width: 38, height: 38, marginRight: 10 }} /> : null}
      <View style={{ flexGrow: 1, flexShrink: 1 }}>
        <Text style={{ fontSize: 7.5, fontWeight: "bold", color: C.turquesaOscuro, letterSpacing: 1.4 }}>BITÁCORA ITO</Text>
        <Text style={{ fontSize: 16, fontWeight: "bold", color: C.tinta, marginTop: 1 }}>Reporte diario de inspección</Text>
        <Text style={{ fontSize: 8.5, color: C.gris, marginTop: 2 }}>
          {datos.contrato.nombreServicio} · Contrato N.º {datos.contrato.numero}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", marginLeft: 12 }}>
        <Text style={{ fontSize: 7, color: C.gris, letterSpacing: 1 }}>REPORTE N.º</Text>
        <Text style={{ fontSize: 20, fontWeight: "bold", color: C.tinta, lineHeight: 1.1 }}>{numeroCorto(datos.correlativo)}</Text>
        <Text style={{ fontSize: 8.5, color: C.gris }}>
          {datos.fecha} · Turno {nombreTurno(datos.turno).toLowerCase()}
        </Text>
      </View>
    </View>
  );
}

function Dato({ etiqueta, valor, ancho }: { etiqueta: string; valor: string; ancho: string }) {
  return (
    <View style={{ width: ancho, paddingVertical: 6, paddingHorizontal: 8 }}>
      <Text style={{ fontSize: 7, color: C.gris, letterSpacing: 0.6 }}>{etiqueta.toUpperCase()}</Text>
      <Text style={{ fontSize: 9, color: C.tinta, fontWeight: "bold", marginTop: 2 }}>{valor || "—"}</Text>
    </View>
  );
}

function Ficha({ datos }: { datos: DatosInforme }) {
  const fila: Style = { flexDirection: "row" };
  return (
    <View style={{ marginTop: 12, backgroundColor: C.fondo, borderRadius: 4, paddingVertical: 2 }}>
      <View style={fila}>
        <Dato etiqueta="Elaborado por" valor={datos.elaboradoPor} ancho="35%" />
        <Dato etiqueta="Fecha" valor={datos.fecha} ancho="33%" />
        <Dato etiqueta="Turno" valor={nombreTurno(datos.turno)} ancho="17%" />
        <Dato etiqueta="Revisión" valor={datos.contrato.revision} ancho="15%" />
      </View>
      <View style={fila}>
        <Dato etiqueta="Clima del turno" valor={CLIMA[datos.climaTurno]} ancho="17%" />
        <Dato etiqueta="Proyección mañana" valor={CLIMA[datos.climaProyeccion]} ancho="18%" />
        <Dato etiqueta="Correlativo" valor={datos.correlativo} ancho="33%" />
        <Dato etiqueta="Código de proyecto" valor={datos.contrato.codigoProyecto} ancho="32%" />
      </View>
    </View>
  );
}

function Cifra({ valor, etiqueta, nota, alerta }: { valor: number; etiqueta: string; nota?: string; alerta?: boolean }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 0, borderWidth: 0.75, borderColor: C.borde, borderRadius: 4, paddingVertical: 7, paddingHorizontal: 9 }}>
      <Text style={{ fontSize: 17, fontWeight: "bold", color: alerta ? CRITICIDAD.alta.color : C.tinta, lineHeight: 1.1 }}>{valor}</Text>
      <Text style={{ fontSize: 8, color: C.gris }}>{etiqueta}</Text>
      {nota ? <Text style={{ fontSize: 7.5, color: alerta ? CRITICIDAD.alta.color : C.grisSuave, marginTop: 1 }}>{nota}</Text> : null}
    </View>
  );
}

interface FotosDocumento {
  /** ref → foto preparada (las fotos viven en las secciones; ahí se cargan y miden). */
  porRef: Map<string, FotoPreparada>;
  /** Número «Foto N» según el orden de aparición. */
  numero: Map<FotoPreparada, number>;
  /** Dónde se imprime cada foto ubicada: junto a su alerta o a su línea (el objeto de datos). */
  duenio: Map<FotoPreparada, AlertaInforme | LineaInforme>;
}

const ordenarAlertas = (datos: DatosInforme) =>
  COLUMNAS.flatMap((columna) => datos.alertas[columna].map((alerta) => ({ alerta, columna }))).sort(
    (a, b) => (a.alerta.criticidad ? CRITICIDAD[a.alerta.criticidad].orden : 3) - (b.alerta.criticidad ? CRITICIDAD[b.alerta.criticidad].orden : 3),
  );

const deRefs = (refs: string[] | undefined, f: FotosDocumento) =>
  (refs ?? []).map((r) => f.porRef.get(r)).filter((x): x is FotoPreparada => !!x);

/** Fotos de la sección que no quedaron junto a una línea ni a una alerta. */
const sueltas = (s: SeccionPreparada, f: FotosDocumento) => s.fotos.filter((x) => !f.duenio.has(x));

/** Fotos que se imprimen justo después de esta línea o alerta. */
const propiasDe = (d: AlertaInforme | LineaInforme, f: FotosDocumento) => deRefs(d.fotos, f).filter((x) => f.duenio.get(x) === d);

function prepararFotos(datos: DatosInforme, secciones: SeccionPreparada[]): FotosDocumento {
  const porRef = new Map<string, FotoPreparada>();
  for (const s of secciones) for (const x of s.fotos) if (x.ref) porRef.set(x.ref, x);
  const f: FotosDocumento = { porRef, numero: new Map(), duenio: new Map() };
  const numerar = (lista: FotoPreparada[]) => {
    for (const x of lista) if (!f.numero.has(x)) f.numero.set(x, f.numero.size + 1);
  };
  for (const { alerta } of ordenarAlertas(datos)) {
    const fotos = deRefs(alerta.fotos, f).filter((x) => !f.duenio.has(x));
    fotos.forEach((x) => f.duenio.set(x, alerta));
    numerar(fotos);
  }
  for (const s of secciones) {
    for (const sub of s.subsecciones) for (const l of sub.lineas) {
      const fotos = deRefs(l.fotos, f).filter((x) => !f.duenio.has(x));
      fotos.forEach((x) => f.duenio.set(x, l));
      numerar(fotos);
    }
    numerar(sueltas(s, f));
  }
  return f;
}

const esSinActividad = (s: SeccionPreparada) =>
  s.subsecciones.length > 0 && s.subsecciones.every((sub) => sub.lineas.length > 0 && sub.lineas.every((l) => l.tipo === "sin_actividad"));

function Resumen({ datos, secciones }: { datos: DatosInforme; secciones: SeccionPreparada[] }) {
  const actividades = secciones.reduce(
    (n, s) => n + s.subsecciones.reduce((m, sub) => m + sub.lineas.filter((l) => l.tipo === "normal").length, 0),
    0,
  );
  const sinActividad = secciones.filter(esSinActividad).length;
  const alertas = COLUMNAS.flatMap((c) => datos.alertas[c]);
  const altas = alertas.filter((a) => a.criticidad === "alta").length;
  const fotos = secciones.reduce((n, s) => n + s.fotos.length, 0);
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
      <Cifra valor={secciones.length} etiqueta={secciones.length === 1 ? "área" : "áreas"} nota={sinActividad ? `${sinActividad} sin actividad` : undefined} />
      <Cifra valor={actividades} etiqueta={actividades === 1 ? "actividad registrada" : "actividades registradas"} />
      <Cifra
        valor={alertas.length}
        etiqueta={alertas.length === 1 ? "alerta" : "alertas"}
        nota={altas ? `${altas} de criticidad alta` : undefined}
        alerta={altas > 0}
      />
      <Cifra valor={fotos} etiqueta={fotos === 1 ? "fotografía" : "fotografías"} />
    </View>
  );
}

function Alerta({ alerta, columna, fotos }: { alerta: AlertaInforme; columna: ColumnaAlerta; fotos: FotosDocumento }) {
  const propias = propiasDe(alerta, fotos);
  return (
    <View wrap={false} style={{ marginBottom: 6 }}>
      <TarjetaAlerta alerta={alerta} columna={columna} />
      {propias.length ? <FilasFotos fotos={propias} numeros={fotos.numero} area={NOMBRE_COLUMNA[columna]} margen={6} /> : null}
    </View>
  );
}

function TarjetaAlerta({ alerta, columna }: { alerta: AlertaInforme; columna: ColumnaAlerta }) {
  const c = alerta.criticidad ? CRITICIDAD[alerta.criticidad] : null;
  return (
    <View style={{ flexDirection: "row", backgroundColor: C.fondo, borderRadius: 3 }}>
      <View style={{ width: 3, backgroundColor: c?.color ?? C.grisSuave, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }} />
      <View style={{ flexGrow: 1, flexShrink: 1, paddingVertical: 6, paddingHorizontal: 9 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
          {c ? (
            <View style={{ backgroundColor: c.fondo, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2, marginRight: 6 }}>
              <Text style={{ fontSize: 7, fontWeight: "bold", color: c.color, letterSpacing: 0.5 }}>{c.texto}</Text>
            </View>
          ) : null}
          <Text style={{ fontSize: 8, color: C.gris }}>{NOMBRE_COLUMNA[columna]}</Text>
          {alerta.empresa ? <Text style={{ fontSize: 8, color: C.grisSuave, marginHorizontal: 4 }}>·</Text> : null}
          {alerta.empresa ? <Text style={{ fontSize: 8, color: C.tinta, fontWeight: "bold" }}>{alerta.empresa}</Text> : null}
        </View>
        <Text style={{ fontSize: 9.5, color: C.texto, lineHeight: 1.35 }}>{alerta.texto}</Text>
      </View>
    </View>
  );
}

function Alertas({ datos, fotos }: { datos: DatosInforme; fotos: FotosDocumento }) {
  const lista = ordenarAlertas(datos);
  return (
    <View>
      <TituloBloque extra={lista.length ? "ordenadas por criticidad" : undefined}>Alertas del turno</TituloBloque>
      {lista.length ? (
        lista.map((a, i) => <Alerta key={i} alerta={a.alerta} columna={a.columna} fotos={fotos} />)
      ) : (
        <Text style={{ fontSize: 9.5, color: C.gris }}>No se registraron alertas en este turno.</Text>
      )}
    </View>
  );
}

function Linea({ linea }: { linea: LineaInforme }) {
  if (linea.tipo === "sin_actividad") {
    return (
      <View style={{ flexDirection: "row", marginTop: 3 }}>
        <View style={{ backgroundColor: "#E6EAEE", paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 2 }}>
          <Text style={{ fontSize: 8, fontWeight: "bold", color: C.gris }}>{linea.texto.replace(/\.$/, "")}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", marginTop: 2 }}>
      <Text style={{ width: 10, fontSize: 9.5, color: C.turquesaOscuro, lineHeight: 1.4 }}>•</Text>
      <Text style={{ flexGrow: 1, flexShrink: 1, fontSize: 9.5, color: C.texto, lineHeight: 1.4 }}>
        {linea.destacado ? <Text style={{ fontWeight: "bold" }}>{`${linea.destacado} `}</Text> : null}
        {linea.texto}
      </Text>
    </View>
  );
}

function Subseccion({ sub, fotos, area }: { sub: SubseccionInforme; fotos: FotosDocumento; area: string }) {
  const titulo = [sub.numero, sub.titulo].filter(Boolean).join("  ");
  return (
    <View style={{ marginTop: 6 }}>
      {titulo ? (
        <Text minPresenceAhead={28} style={{ fontSize: 8.5, fontWeight: "bold", color: C.gris, letterSpacing: 0.4, marginBottom: 1 }}>
          {titulo}
        </Text>
      ) : null}
      {sub.lineas.map((l, i) => {
        const propias = propiasDe(l, fotos);
        return (
          <View key={i}>
            <Linea linea={l} />
            {propias.length ? <FilasFotos fotos={propias} numeros={fotos.numero} area={area} margen={6} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function FilasFotos({ fotos, numeros, area, margen }: { fotos: FotoPreparada[]; numeros: Map<FotoPreparada, number>; area: string; margen: number }) {
  const filas: FotoPreparada[][] = [];
  for (let i = 0; i < fotos.length; i += FOTOS_POR_FILA) filas.push(fotos.slice(i, i + FOTOS_POR_FILA));
  return (
    <>
      {filas.map((fila, f) => (
        <View key={f} wrap={false} style={{ flexDirection: "row", gap: ESPACIO_FOTOS, marginTop: f === 0 ? margen : 8 }}>
          {fila.map((foto, i) => (
            <Foto key={i} foto={foto} numero={numeros.get(foto) ?? 0} area={area} />
          ))}
        </View>
      ))}
    </>
  );
}

function Foto({ foto, numero, area }: { foto: FotoPreparada; numero: number; area: string }) {
  return (
    <View style={{ width: ANCHO_FOTO }}>
      <View style={{ width: ANCHO_FOTO, height: ALTO_FOTO, borderRadius: 3, overflow: "hidden", backgroundColor: C.fondo }}>
        {/* contain: la foto se ve completa (una vertical no se corta); el fondo gris rellena el resto. */}
        <Image src={foto.src} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </View>
      <Text style={{ fontSize: 7.5, color: C.gris, marginTop: 3, lineHeight: 1.25 }}>
        <Text style={{ fontWeight: "bold", color: C.tinta }}>{`Foto ${numero}`}</Text>
        {` · ${foto.pie ?? area}`}
      </Text>
    </View>
  );
}

function Seccion({ seccion, numero, fotos }: { seccion: SeccionPreparada; numero: number; fotos: FotosDocumento }) {
  const area = nombrePropio(seccion.titulo);
  const resto = sueltas(seccion, fotos);
  const filas: FotoPreparada[][] = [];
  for (let i = 0; i < resto.length; i += FOTOS_POR_FILA) filas.push(resto.slice(i, i + FOTOS_POR_FILA));
  // Fotos que se imprimen en esta área: las de sus líneas y las sueltas (las de alertas van con la alerta).
  const enLineas = seccion.subsecciones.reduce((n, sub) => n + sub.lineas.reduce((m, l) => m + propiasDe(l, fotos).length, 0), 0);
  const cuantas = enLineas + resto.length;
  const sinActividad = esSinActividad(seccion);
  const renglones = seccion.subsecciones.reduce((n, s) => n + 1 + s.lineas.reduce((m, l) => m + Math.ceil((l.texto.length + 1) / 105), 0), 0);
  // Una sección corta (texto breve y una fila de fotos) no se parte entre páginas.
  const corta = renglones <= 10 && cuantas <= FOTOS_POR_FILA && (filas.length === 0 || enLineas === 0);
  return (
    <View wrap={!corta} style={{ marginTop: numero === 1 ? 0 : 14, paddingTop: numero === 1 ? 0 : 12, borderTopWidth: numero === 1 ? 0 : 0.75, borderTopColor: C.borde }}>
      <View minPresenceAhead={70} style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ backgroundColor: C.turquesaFondo, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1.5, marginRight: 8 }}>
          <Text style={{ fontSize: 9, fontWeight: "bold", color: C.turquesaOscuro }}>{seccion.numero}</Text>
        </View>
        <Text style={{ fontSize: 11.5, fontWeight: "bold", color: C.tinta, flexGrow: 1 }}>{area}</Text>
        {cuantas ? (
          <Text style={{ fontSize: 8, color: C.grisSuave }}>
            {cuantas} {cuantas === 1 ? "foto" : "fotos"}
          </Text>
        ) : sinActividad ? (
          <Text style={{ fontSize: 8, color: C.grisSuave }}>sin actividad</Text>
        ) : null}
      </View>
      <View style={{ paddingLeft: 2 }}>
        {seccion.subsecciones.map((s, i) => (
          <Subseccion key={i} sub={s} fotos={fotos} area={area} />
        ))}
      </View>
      {resto.length ? <FilasFotos fotos={resto} numeros={fotos.numero} area={area} margen={10} /> : null}
    </View>
  );
}

export default function DocumentoBitacora({ datos, secciones, logo, familia = FAMILIA }: PropsDocumentoBitacora) {
  const fotos = prepararFotos(datos, secciones);
  return (
    <Document
      title={`Reporte diario de inspección N.º ${numeroCorto(datos.correlativo)} · ${datos.fecha}`}
      author={datos.elaboradoPor}
      subject={`${datos.contrato.nombreServicio} N.º ${datos.contrato.numero} · ${datos.correlativo}`}
      creator="Bitácora ITO"
      producer="Bitácora ITO"
      language="es-CL"
    >
      <Page
        size="LETTER"
        style={{ fontFamily: familia, fontSize: 9.5, color: C.texto, paddingTop: 36, paddingBottom: 54, paddingHorizontal: MARGEN_X }}
      >
        <Encabezado datos={datos} logo={logo} />
        <Ficha datos={datos} />
        <Resumen datos={datos} secciones={secciones} />
        <Alertas datos={datos} fotos={fotos} />
        <TituloBloque extra={secciones.length ? `${secciones.length} ${secciones.length === 1 ? "área" : "áreas"}` : undefined}>
          Actividades por área
        </TituloBloque>
        {secciones.length ? (
          secciones.map((s, i) => <Seccion key={i} seccion={s} numero={i + 1} fotos={fotos} />)
        ) : (
          <Text style={{ fontSize: 9.5, color: C.gris }}>No hay áreas registradas en este turno.</Text>
        )}

        <View
          fixed
          style={{
            position: "absolute",
            left: MARGEN_X,
            right: MARGEN_X,
            bottom: 24,
            flexDirection: "row",
            justifyContent: "space-between",
            borderTopWidth: 0.75,
            borderTopColor: C.borde,
            paddingTop: 6,
          }}
        >
          <Text style={{ fontSize: 7, color: C.grisSuave }}>
            {`Bitácora ITO · Reporte N.º ${numeroCorto(datos.correlativo)} · ${datos.fecha} · ${datos.contrato.codigoInterno}`}
          </Text>
          <Text style={{ fontSize: 7, color: C.grisSuave }} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// Documento completo del reporte diario: hoja carta, encabezado solo en la página 1 y cuerpo que fluye.
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { DatosInforme } from "../tipos";
import Encabezado from "./Encabezado";
import Seccion, { type SeccionPreparada } from "./Seccion";
import TablaAlertas from "./TablaAlertas";
import { COLOR, FAMILIA, MARGEN, ORIGEN, PAGINA, TAM, u } from "./medidas";

export interface PropsDocumento {
  datos: DatosInforme;
  secciones: SeccionPreparada[];
  logo?: string;
  familia?: string;
}

export default function DocumentoInforme({ datos, secciones, logo, familia = FAMILIA }: PropsDocumento) {
  return (
    <Document
      title={`Reporte diario de inspección de construcción ${datos.fecha}`}
      author={datos.elaboradoPor}
      subject={`${datos.contrato.nombreServicio} N°${datos.contrato.numero} · ${datos.correlativo}`}
      creator="Bitácora ITO"
      producer="Bitácora ITO"
      language="es-CL"
    >
      <Page
        size={[PAGINA.ancho, PAGINA.alto]}
        style={{
          fontFamily: familia,
          // Excel exporta sin interletrado (kerning) ni ligaduras: sin esto las líneas cortan distinto.
          fontFeatureSettings: { kern: false, liga: false },
          fontSize: u(TAM.cuerpo),
          color: COLOR.negro,
          paddingTop: u(MARGEN.arriba),
          paddingBottom: u(MARGEN.abajo),
          paddingLeft: u(ORIGEN.x),
          paddingRight: u(MARGEN.derecha),
        }}
      >
        {/* Cada bloque dibuja su tramo del marco izquierdo doble (Trazos.tsx). */}
        <Encabezado datos={datos} logo={logo} />
        <TablaAlertas alertas={datos.alertas} />
        {secciones.map((s, i) => (
          <Seccion key={i} seccion={s} primera={i === 0} />
        ))}

        <Text
          fixed
          style={{
            position: "absolute",
            right: u(MARGEN.derecha),
            bottom: u(MARGEN.abajo - 70),
            fontSize: u(TAM.codigos * 1.25),
            color: COLOR.numeroPagina,
          }}
          render={({ pageNumber, totalPages }) => (totalPages && totalPages > 1 ? `Página ${pageNumber} de ${totalPages}` : "")}
        />
      </Page>
    </Document>
  );
}

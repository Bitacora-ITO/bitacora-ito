// Encabezado de la página 1: logo, título, servicio, códigos, elaborador, fecha, correlativo y clima.
// Todo va en posición absoluta con las coordenadas del original (unidades de medidas.ts).
import { Image, View } from "@react-pdf/renderer";
import type { Clima } from "../../types";
import type { DatosInforme } from "../tipos";
import TextoAbs from "./TextoAbs";
import { Lienzo, TramoMarco, trazador } from "./Trazos";
import { COLOR, LINEA, ORIGEN, TAM, u } from "./medidas";

/** Alto del bloque absoluto: desde el borde superior del marco hasta la fila «1. ALERTAS». */
export const ALTO_ENCABEZADO = 369.1 - ORIGEN.y;

const DERECHA = 1686.9; // fin de las líneas horizontales del encabezado

const OPCIONES_CLIMA: { clima: Clima; etiqueta: string; x0: number; x1: number }[] = [
  { clima: "despejado", etiqueta: "Despejado", x0: 998.7, x1: 1105.3 },
  { clima: "nublado", etiqueta: "Nublado", x0: 1221.3, x1: 1314.8 },
  { clima: "lluvia", etiqueta: "Lluvia", x0: 1388.3, x1: 1547.2 },
];

function FilaClima({ titulo, valor, base, baseX }: { titulo: string; valor: Clima; base: number; baseX: number }) {
  return (
    <>
      <TextoAbs x={670.7} base={base} tam={TAM.campo} negrita>
        {titulo}
      </TextoAbs>
      {OPCIONES_CLIMA.map((o) => {
        const marcado = o.clima === valor;
        return (
          <View key={o.clima}>
            {marcado ? (
              <TextoAbs x={o.x0} ancho={o.x1 - o.x0} base={baseX} tam={TAM.x} negrita color={COLOR.climaX}>
                X
              </TextoAbs>
            ) : null}
            <TextoAbs x={o.x1 + 1.8} base={base} tam={TAM.campo} negrita color={marcado ? COLOR.climaMarcado : COLOR.negro}>
              {o.etiqueta}
            </TextoAbs>
          </View>
        );
      })}
    </>
  );
}

export default function Encabezado({ datos, logo }: { datos: DatosInforme; logo?: string }) {
  const { contrato } = datos;
  const turno = datos.turno === "noche" ? "noche" : "día";
  return (
    <View style={{ position: "relative", height: u(ALTO_ENCABEZADO) }}>
      <TramoMarco />
      <Lienzo
        dibujar={(p) => {
          const t = trazador(p);
          const m = LINEA / 2;
          // Marco superior doble (el izquierdo lo dibuja TramoMarco)
          t.h(200.8, DERECHA, 162.2 + m);
          t.h(202.2, DERECHA, 163.7 + m);
          // Celdas del encabezado
          t.v(348.1 + m, 164.4, 250.6);
          t.v(1388.3 + m, 164.4, 250.6);
          t.h(348.8, 1389.0, 211.3 + m);
          t.h(ORIGEN.x, DERECHA, 249.9 + m);
          // Casillas: fecha, correlativo y clima
          t.caja(998.7, 259.7, 1105.3, 287.3);
          t.caja(214.6, 297.9, 491.7, 325.5);
          for (const [y0, y1] of [
            [297.9, 325.5],
            [336.1, 363.7],
          ]) {
            for (const o of OPCIONES_CLIMA) t.caja(o.x0, y0, o.x1, y1);
          }
        }}
      />

      {logo ? (
        <Image
          src={logo}
          style={{
            position: "absolute",
            left: u(222.2 - ORIGEN.x),
            top: u(178.1 - ORIGEN.y),
            width: u(101.3),
            height: u(58.4),
          }}
        />
      ) : null}

      <TextoAbs x={348.8} ancho={1388.3 - 348.8} base={190.9} tam={TAM.titulo} negrita>
        REPORTE DIARIO DE INSPECCIÓN DE CONSTRUCCIÓN
      </TextoAbs>
      <TextoAbs x={348.8} ancho={1388.3 - 348.8} base={234.6} tam={TAM.titulo} negrita>
        {`${contrato.nombreServicio} N°${contrato.numero}`}
      </TextoAbs>

      <TextoAbs x={1390.4} base={180.0} tam={TAM.codigos}>{`Código Interno: ${contrato.codigoInterno}`}</TextoAbs>
      <TextoAbs x={1390.4} base={204.4} tam={TAM.codigos}>{`Código Proyecto: ${contrato.codigoProyecto}`}</TextoAbs>
      <TextoAbs x={1390.4} base={225.1} tam={TAM.codigos}>{`Revisión: ${contrato.revision}`}</TextoAbs>
      <TextoAbs x={1390.4} base={244.4} tam={TAM.codigos}>{`Fecha: ${contrato.fechaFormato}`}</TextoAbs>

      {/* Elaborador, fecha y correlativo */}
      <TextoAbs x={217.1} base={272.8} tam={TAM.elaborador} negrita>
        Elaborador Por:
      </TextoAbs>
      <TextoAbs x={350.6} base={272.8} tam={TAM.elaborador} negrita>
        {datos.elaboradoPor}
      </TextoAbs>
      <TextoAbs x={794.7} base={278.2} tam={TAM.campo} negrita>
        Fecha
      </TextoAbs>
      <TextoAbs x={998.7} ancho={1105.3 - 998.7} base={278.2} tam={TAM.campo} negrita>
        {datos.fecha}
      </TextoAbs>

      <TextoAbs x={217.1} base={315.7} tam={TAM.elaborador} negrita>
        {`Correlativo ${datos.correlativo}`}
      </TextoAbs>

      <FilaClima titulo={`Condición Climática hoy turno ${turno}`} valor={datos.climaTurno} base={316.4} baseX={317.8} />
      <FilaClima titulo={`Proyección de mañana turno ${turno}`} valor={datos.climaProyeccion} base={354.6} baseX={356.0} />
    </View>
  );
}

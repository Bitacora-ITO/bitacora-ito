// Datos del informe real del 27-09-2026 (turno día, correlativo 01972), transcritos del PDF
// «FORMATO REPORTE DIARIO CONSTRUCCIÓN_REV1_27.09.26 (Turno día)». Sirven para reproducirlo y
// compararlo con el original (scripts/pdf). Las fotos son las mismas del original, extraídas a
// public/demo/fotos/real-0N.jpg en su orden de aparición.
import type { DatosInforme } from "./tipos";

export const datosInforme2709: DatosInforme = {
  contrato: {
    nombreServicio: "Servicio de Inspección Técnica de Obras y Apoyo a la Construcción de Carén",
    numero: "4600026893",
    codigoInterno: "JEJ-664-CT-INF-002",
    codigoProyecto: "4600026893-8211-FRMCS-00001",
    revision: "1",
    fechaFormato: "02-07-2024",
  },
  fecha: "27-09-2026",
  turno: "dia",
  correlativo: "4600026893-8211-INDCS-01972",
  elaboradoPor: "Jorge Orellana S. / Alberto Castillo / Arnoldi Díaz",
  climaTurno: "despejado",
  climaProyeccion: "despejado",
  alertas: {
    construccion: [
      {
        empresa: "TECNASIC",
        texto: "Sin actividades en Túnel PAMo, cámara de carga y Piscina SMA.",
      },
    ],
    laboratorio: [],
    topografia: [],
    interferencia: [],
  },
  secciones: [
    {
      numero: "1.0",
      titulo: "MURO SOTELO",
      tituloFotos: "Muro Sotelo",
      fotos: [{ src: "/demo/fotos/real-01.jpg" }, { src: "/demo/fotos/real-02.jpg" }],
      subsecciones: [
        {
          numero: "1.1",
          titulo: "GEOMEMBRANA",
          // En el original esta línea va en negro (no en rojo), por eso es "normal".
          lineas: [{ texto: "Sin actividad", tipo: "normal" }],
        },
        {
          numero: "1.2",
          titulo: "EXCAVACIÓN Y RELLENOS DE 1A ZANJA CORTAFUGA.",
          lineas: [
            {
              texto:
                "Se realiza preparación y extendido de material 1A en sector zanja cortafuga 4ta capa 30cm entre los Pk 89 al Pk 110 cota 233,70",
              tipo: "normal",
            },
            {
              texto:
                "Se realiza extendido y compactación de material 1A en sector zanja cortafuga 5ta capa 30cm entre los Pk 89 al Pk 110 cota 234,00 liberada por parte de calidad, topografía y laboratorio.",
              tipo: "normal",
            },
          ],
        },
        {
          numero: "1.3",
          titulo: "MURO SOTELO",
          lineas: [
            {
              texto: "Se realiza corte de talud y carguío en muro Sotelo para posterior endentado 1A atraque izquierdo.",
              tipo: "normal",
            },
            { texto: "Se realiza liberación de capa 16 cota 252,8m entre los Pk 17 al Pk 29 total 12m.", tipo: "normal" },
            {
              texto:
                "Se realiza extendido y compactación de material 1A capa 17 cota 253,1m entre los Pk 18 al Pk 30 total 12m liberada por parte de calidad, topografía y laboratorio.",
              tipo: "normal",
            },
            {
              texto:
                "Se realiza extendido y compactación de material 1A capa 18 cota 253,4m entre los Pk 18 al Pk 30 total 12m liberada por parte de calidad, topografía y laboratorio.",
              tipo: "normal",
            },
            {
              texto: "Se realiza excavación de zanja anclaje pata muro Sotelo entre los Pk 160 al Pk 133 total 27m.",
              tipo: "normal",
            },
          ],
        },
      ],
    },
    {
      numero: "2.0",
      titulo: "MORNING GLORY ETAPA N° 9",
      tituloFotos: "Morning Glory Etapa N°9",
      fotos: [{ src: "/demo/fotos/real-03.jpg" }],
      subsecciones: [
        {
          numero: "2.1",
          titulo: "SUPERFICIE",
          lineas: [{ texto: "Se realiza orden y aseo sector pique.", tipo: "normal" }],
        },
        {
          numero: "2.2",
          titulo: "TÚNEL EVACUADOR /  GEOINYECTA",
          lineas: [
            {
              texto:
                "Se realiza perforación de pozos de consolidación de las corrida E (2-6-7), y la D(1-2-3-4-5-10-11-12) con 11 pozos, total de metros perforados 88m.",
              tipo: "normal",
            },
          ],
        },
      ],
    },
    {
      numero: "3.0",
      titulo: "TECNASIC",
      fotos: [],
      subsecciones: [
        {
          numero: "3.1",
          titulo: "TORRE CAPTACIÓN 8-9",
          lineas: [
            { texto: "Verticalización de estructuras entre ejes de la torre.", tipo: "normal" },
            { texto: "Montaje de soporte y tablero 3531-TDF-801.", tipo: "normal" },
            { texto: "Touchut de pintura de soporte eléctrico.", tipo: "normal" },
            { texto: 'Montaje CAG de 1" en TDF-801.', tipo: "normal" },
            { texto: "Soldadura y esmerilado de ventanas de soporte SP-015 bastidor.", tipo: "normal" },
          ],
        },
        {
          numero: "3.2",
          titulo: "TUNEL PAMo",
          lineas: [{ texto: "Sin actividades.", tipo: "sin_actividad" }],
        },
        {
          numero: "3.3",
          titulo: "CÁMARA DE CARGA- SMA",
          lineas: [{ texto: "Sin actividades.", tipo: "sin_actividad" }],
        },
        {
          numero: "3.4",
          titulo: "PISCINA SMA",
          lineas: [
            { texto: "Sin actividades relevantes.", tipo: "sin_actividad" },
            { texto: "Hormigonado de pedestal fundación F5.", tipo: "normal" },
          ],
        },
        {
          numero: "3.5",
          titulo: "RECORRIDO DE CAÑERÍAS Y CRUCES DE CAMINO.",
          lineas: [
            { texto: 'Excavación y emplantillado para fundacion de machones M1a, M1b y M1c de cañería de 6".', tipo: "normal" },
            { texto: "Fabricación de camellones en recorrido de cañería de 6″.", tipo: "normal" },
          ],
        },
      ],
    },
    {
      numero: "4.0",
      titulo: "IDIEM",
      fotos: [],
      subsecciones: [
        {
          // En el original las líneas de IDIEM cuelgan directo de la sección (sin subtítulo n.1).
          numero: "",
          titulo: "",
          lineas: [
            {
              destacado: "Calicatas OA-13 (Macrogranulometría):",
              texto: "Se alcanza 1,40m de profunidad, se realiza muestreo, descripción y cierre de prospección.",
              tipo: "normal",
            },
            { destacado: "Sondaje S3-MP:", texto: "Ensayo SCPTu.", tipo: "normal" },
          ],
        },
      ],
    },
  ],
};

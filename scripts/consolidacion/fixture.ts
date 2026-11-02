// Datos de prueba de la consolidación (inventados): 3 inspectores entregan su parte del mismo turno.
// - Orellana y Castillo registran la misma área (Peralte Muro Sotelo) con la misma empresa → se juntan.
// - Castillo agrega IDIEM en Peralte Muro Sotelo → subsección 1.2.
// - Castillo declara Túnel PAMo sin actividad, pero Díaz registra actividad ahí → no se imprime «Sin actividad».
// - Alertas en las cuatro columnas, dos altas con foto; una sin área.
// - Rojas tiene su parte en la nube sin entregar (PDF generado) y Soto está de descanso según su 7x7.
// Se usa en Node (probar.ts) y en el navegador (window.__bitacoraDemoConsolidacion) para las capturas.
import type { DatosEnMemoria } from "../../src/lib/consolidacion-remota";

export const CONTRATO_DEMO = "c-4600026893"; // el mismo id del contrato de la semilla de la app

export function datosDemo(fecha: string): DatosEnMemoria {
  const t = (hhmm: string) => new Date(`${fecha}T${hhmm}:00-03:00`).toISOString();
  const foto = (n: number) => `/demo/fotos/real-0${((n - 1) % 3) + 1}.jpg`;
  const menos = (dias: number) => {
    const d = new Date(`${fecha}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - dias);
    return d.toISOString().slice(0, 10);
  };
  return {
    contrato: {
      id: CONTRATO_DEMO,
      nombre: "Servicio de Inspección Técnica de Obras y Apoyo a la Construcción de Carén",
      numero: "4600026893", mandante: "Mandante de prueba",
      codigo_proyecto: "4600026893-8211-FRMCS-00001", codigo_interno: "JEJ-664-CT-INF-002",
      revision_formato: "1", fecha_formato: "02-07-2024",
      prefijo_correlativo: "4600026893-8211-INDCS-", ultimo_correlativo: 1973,
      destinatarios: ["inspeccion@mandante.cl"],
    },
    usuarios: [
      { id: "u-orellana", nombre: "Jorge Orellana S.", correo: "jorellana@empresa.cl", rol: "inspector", activo: true, contrato_id: CONTRATO_DEMO },
      { id: "u-castillo", nombre: "Alberto Castillo", correo: "acastillo@empresa.cl", rol: "inspector", activo: true, contrato_id: CONTRATO_DEMO },
      { id: "u-diaz", nombre: "Arnoldi Díaz", correo: "adiaz@empresa.cl", rol: "inspector", activo: true, contrato_id: CONTRATO_DEMO },
      { id: "u-rojas", nombre: "Marcela Rojas", correo: "mrojas@empresa.cl", rol: "inspector", activo: true, contrato_id: CONTRATO_DEMO },
      { id: "u-soto", nombre: "Pedro Soto", correo: "psoto@empresa.cl", rol: "inspector", activo: true, contrato_id: CONTRATO_DEMO },
      { id: "u-munoz", nombre: "Carolina Muñoz", correo: "cmunoz@empresa.cl", rol: "jefatura", activo: true, contrato_id: CONTRATO_DEMO },
    ],
    roles: [
      // Soto empezó su turno hace 9 días: hoy es su día 9 del ciclo de 14 → descanso.
      { usuario_id: "u-soto", contrato_id: CONTRATO_DEMO, dias_trabajo: 7, dias_descanso: 7, fecha_inicio: menos(9) },
    ],
    reportes: [
      { id: "r-orellana", contrato_id: CONTRATO_DEMO, fecha, turno: "dia", correlativo: "4600026893-8211-INDCS-01972", elaborado_por: "u-orellana",
        clima_turno: "despejado", clima_proyeccion: "despejado", estado: "aprobado", entregado_en: t("17:42") },
      { id: "r-castillo", contrato_id: CONTRATO_DEMO, fecha, turno: "dia", correlativo: "4600026893-8211-INDCS-01972", elaborado_por: "u-castillo",
        clima_turno: "nublado", clima_proyeccion: "despejado", estado: "aprobado", entregado_en: t("17:55") },
      { id: "r-diaz", contrato_id: CONTRATO_DEMO, fecha, turno: "dia", correlativo: "4600026893-8211-INDCS-01973", elaborado_por: "u-diaz",
        clima_turno: "despejado", clima_proyeccion: "nublado", estado: "aprobado", entregado_en: t("18:03") },
      { id: "r-rojas", contrato_id: CONTRATO_DEMO, fecha, turno: "dia", correlativo: "4600026893-8211-INDCS-01973", elaborado_por: "u-rojas",
        clima_turno: "despejado", clima_proyeccion: "despejado", estado: "generado", entregado_en: null },
    ],
    areasTurno: [
      { id: "at-o1", reporte_id: "r-orellana", frente_id: "a-04", empresa_id: "e1-tecnasic", orden: 1 },
      { id: "at-o2", reporte_id: "r-orellana", frente_id: "a-01", empresa_id: "e2-geoinyecta", orden: 2 },
      { id: "at-c1", reporte_id: "r-castillo", frente_id: "a-04", empresa_id: "e1-tecnasic", orden: 1 },
      { id: "at-c2", reporte_id: "r-castillo", frente_id: "a-04", empresa_id: "e3-idiem", orden: 2 },
      { id: "at-c3", reporte_id: "r-castillo", frente_id: "a-07", empresa_id: "e4-oocc", orden: 3 },
      { id: "at-d1", reporte_id: "r-diaz", frente_id: "a-01", empresa_id: "e2-geoinyecta", orden: 1 },
      { id: "at-d2", reporte_id: "r-diaz", frente_id: "a-03", empresa_id: "e2-geoinyecta", orden: 2 },
      { id: "at-d3", reporte_id: "r-diaz", frente_id: "a-07", empresa_id: "e4-oocc", orden: 3 },
      { id: "at-r1", reporte_id: "r-rojas", frente_id: "a-02", empresa_id: "e4-oocc", orden: 1 },
    ],
    registros: [
      { id: "g-o1", reporte_id: "r-orellana", area_turno_id: "at-o1", sin_actividad: false, registrado_en: t("09:12"),
        descripcion: "Se realiza extendido y compactación de material 1A, 17.ª capa de 30 cm entre Pk 0+080 y 0+140." },
      { id: "g-o2", reporte_id: "r-orellana", area_turno_id: "at-o1", sin_actividad: false, registrado_en: t("11:40"),
        descripcion: "Control de densidad in situ en capa 17: 4 puntos, todos sobre el 95 % del Proctor modificado." },
      { id: "g-o3", reporte_id: "r-orellana", area_turno_id: "at-o2", sin_actividad: false, registrado_en: t("13:05"),
        descripcion: "Perforación de pozos de consolidación corrida E (2-6-7), 3 pozos; total 24 m." },
      { id: "g-c1", reporte_id: "r-castillo", area_turno_id: "at-c1", sin_actividad: false, registrado_en: t("10:30"),
        descripcion: "Topografía libera la capa 16 para el extendido de la capa 17 en el Pk 0+140 al 0+200." },
      { id: "g-c2", reporte_id: "r-castillo", area_turno_id: "at-c2", sin_actividad: false, registrado_en: t("12:15"),
        descripcion: "IDIEM toma muestras de material 1A para granulometría y Proctor (2 sacos, capa 17)." },
      { id: "g-c3", reporte_id: "r-castillo", area_turno_id: "at-c3", sin_actividad: true, registrado_en: t("08:20"), descripcion: "" },
      { id: "g-d1", reporte_id: "r-diaz", area_turno_id: "at-d1", sin_actividad: false, registrado_en: t("15:20"),
        descripcion: "Inyección de lechada en pozos de la corrida D (10-11-12), presión de cierre 6 bar." },
      { id: "g-d2", reporte_id: "r-diaz", area_turno_id: "at-d2", sin_actividad: false, registrado_en: t("09:45"),
        descripcion: "- Instalación de pernos helicoidales de 2,4 m en caja derecha, Pk 1+215 al 1+228 (22 pernos).\n- Proyección de shotcrete de 5 cm con fibra en bóveda, Pk 1+228 al 1+236." },
      { id: "g-d3", reporte_id: "r-diaz", area_turno_id: "at-d3", sin_actividad: false, registrado_en: t("16:10"),
        descripcion: "Retiro de marina del frente de avance, 3 camiones tolva a botadero autorizado." },
      { id: "g-r1", reporte_id: "r-rojas", area_turno_id: "at-r1", sin_actividad: false, registrado_en: t("10:00"),
        descripcion: "Perfilado de base granular en camino de acceso." },
    ],
    alertas: [
      { id: "al-o1", reporte_id: "r-orellana", columna: "construccion", empresa_id: "e1-tecnasic", area_turno_id: "at-o1", criticidad: "media", registrado_en: t("11:50"),
        descripcion: "En zanja de anclaje las últimas 2 capas no presentan la misma consistencia; se pide reacondicionar antes de la capa 18." },
      { id: "al-c1", reporte_id: "r-castillo", columna: "laboratorio", empresa_id: "e3-idiem", area_turno_id: "at-c2", criticidad: "alta", registrado_en: t("12:30"),
        descripcion: "Ensayo de densidad de la capa 16 bajo el 95 %: no se libera el sector Pk 0+150 hasta repetir el ensayo." },
      { id: "al-c2", reporte_id: "r-castillo", columna: "topografia", empresa_id: "e1-tecnasic", area_turno_id: null, criticidad: "baja", registrado_en: t("14:00"),
        descripcion: "Estaca de referencia del Pk 120 removida; se solicita reponer antes del control de capa." },
      { id: "al-d1", reporte_id: "r-diaz", columna: "interferencia", empresa_id: "e4-oocc", area_turno_id: "at-d3", criticidad: "alta", registrado_en: t("16:30"),
        descripcion: "Corte del camino al Túnel PAMo por tronadura entre 13:00 y 13:30; camiones detenidos 40 min." },
    ],
    fotografias: [
      { id: "f-o1", reporte_id: "r-orellana", registro_id: "g-o1", alerta_id: null, ruta: "r-orellana/f-o1.jpg", url: foto(1), orden: 1, pie_foto: null, capturada_en: t("09:10") },
      { id: "f-o2", reporte_id: "r-orellana", registro_id: "g-o2", alerta_id: null, ruta: "r-orellana/f-o2.jpg", url: foto(2), orden: 1, pie_foto: null, capturada_en: t("11:38") },
      { id: "f-o3", reporte_id: "r-orellana", registro_id: "g-o3", alerta_id: null, ruta: "r-orellana/f-o3.jpg", url: foto(3), orden: 1, pie_foto: null, capturada_en: t("13:02") },
      { id: "f-c1", reporte_id: "r-castillo", registro_id: "g-c2", alerta_id: null, ruta: "r-castillo/f-c1.jpg", url: foto(2), orden: 1, pie_foto: null, capturada_en: t("12:14") },
      { id: "f-c2", reporte_id: "r-castillo", registro_id: null, alerta_id: "al-c1", ruta: "r-castillo/f-c2.jpg", url: foto(1), orden: 1, pie_foto: null, capturada_en: t("12:29") },
      { id: "f-d1", reporte_id: "r-diaz", registro_id: "g-d2", alerta_id: null, ruta: "r-diaz/f-d1.jpg", url: foto(3), orden: 1, pie_foto: null, capturada_en: t("09:44") },
      { id: "f-d2", reporte_id: "r-diaz", registro_id: null, alerta_id: "al-d1", ruta: "r-diaz/f-d2.jpg", url: foto(1), orden: 1, pie_foto: null, capturada_en: t("13:15") },
    ],
    frentes: [
      { id: "a-01", nombre: "Vertedero Morning Glory", orden: 1 },
      { id: "a-02", nombre: "Acceso a obra de captación", orden: 2 },
      { id: "a-03", nombre: "Fortificación Tramo B", orden: 3 },
      { id: "a-04", nombre: "Peralte Muro Sotelo", orden: 4 },
      { id: "a-07", nombre: "Túnel PAMo", orden: 7 },
    ],
    empresas: [
      { id: "e1-tecnasic", nombre: "TECNASIC" },
      { id: "e2-geoinyecta", nombre: "GEOINYECTA" },
      { id: "e3-idiem", nombre: "IDIEM" },
      { id: "e4-oocc", nombre: "OOCC" },
    ],
  };
}

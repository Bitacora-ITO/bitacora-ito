// Datos de demostración: contrato 4600026893, 14 áreas, 4 empresas, 5 usuarios, rol 7x7 relativo a hoy,
// unas 6 semanas de reportes enviados (con 2 días no entregados) y el reporte de hoy como en 01a.
//
// El catálogo (contrato, áreas, empresas y usuarios) sale de `catalogoBase()` con ids estables
// (UUID derivados del nombre): todos los teléfonos comparten los mismos ids, como lo necesitan la
// consolidación del jefe de turno y las llaves foráneas de Supabase.
import { ahoraISO, db, hoyLocal, nuevoId } from "./db";
import type {
  Alerta, Area, AreaTurno, Clima, ColumnaAlerta, Contrato, Criticidad, Empresa, Envio,
  Fotografia, Registro, Reporte, RolTurno, Usuario,
} from "./types";
import { CLAVES, formatoCorrelativo } from "./repositorio";
import { instante, sumarDias } from "./fechas";
import { esDiaTrabajo } from "./rol";
import { catalogoBase, idEstable } from "./catalogo-excel";

/**
 * Si cambia, la app borra y vuelve a sembrar al abrirse, salvo desde las versiones de
 * `VERSIONES_MIGRABLES`: esas solo cambian los ids del catálogo y conservan lo registrado.
 */
export const SEMILLA_VERSION = "2026-10-30.1";
/** Versiones con los ids antiguos («u-orellana», «a-01»…) que se migran sin borrar el historial. */
const VERSIONES_MIGRABLES = ["2026-10-20.2"];

const CATALOGO = catalogoBase();
const CONTRATO_ID = CATALOGO.contrato.id;
const usuarioId = (nombre: string) => CATALOGO.usuarios.find((u) => u.nombre === nombre)!.id;
const USUARIO_ID = usuarioId("Jorge Orellana S.");
const CORRELATIVO_HOY = CATALOGO.contrato.ultimoCorrelativo;
const DESTINATARIO_DEFECTO = CATALOGO.contrato.destinatarios[0];
const GPS = { latitud: -22.4512, longitud: -68.9231 };

const empresaId = (nombre: string) => CATALOGO.empresas.find((e) => e.nombre === nombre)!.id;
const E = {
  tecnasic: empresaId("TECNASIC"), geoinyecta: empresaId("GEOINYECTA"), idiem: empresaId("IDIEM"), oocc: empresaId("OOCC"),
} as const;

const EMPRESAS: Empresa[] = CATALOGO.empresas;

/** Id del área n.º `n` (1 a 14) del catálogo, en el orden de otrosdoc/Áreas.xlsx. */
const A = (n: number) => CATALOGO.areas[n - 1].id;

/** Id estable del rol 7x7 de un usuario. */
const idRol = (usuario: string) => idEstable("rol", CONTRATO_ID, usuario);

interface AreaSemilla { id: string; empresa: string; textos: string[] }

// Textos en el estilo del reporte real REV1 del 27-09-2026 (Pk, cotas, capas y liberaciones dentro del texto).
const AREAS: AreaSemilla[] = [
  { id: A(1), empresa: E.geoinyecta, textos: [
    "Se realiza perforación de pozos de consolidación de las corridas E (2-6-7) y D (1-2-3-4-5), con 8 pozos; total de metros perforados 64 m.",
    "Inyección de lechada en pozos de consolidación corrida D (10-11-12), presión de cierre 6 bar.\nSe realiza orden y aseo sector pique.",
    "Perforación de pozos de drenaje en túnel evacuador, corrida F (1 al 4), total 36 m.",
    "Se realiza lavado de pozos y prueba de agua Lugeon en corrida E, tramos 1 a 3.",
  ] },
  { id: A(2), empresa: E.oocc, textos: [
    "Perfilado y compactación de base granular en camino de acceso entre Pk 0+040 y 0+120.",
    "Instalación de barrera de contención tipo New Jersey en curva del Pk 0+210, 14 unidades.",
    "Riego de supresión de polvo y bacheo de carpeta en acceso a obra de captación.",
  ] },
  { id: A(3), empresa: E.geoinyecta, textos: [
    "Instalación de pernos helicoidales de 2,4 m en caja derecha entre Pk 1+215 y 1+228, 22 pernos.",
    "Proyección de shotcrete de 5 cm con fibra en bóveda entre Pk 1+228 y 1+236; se toman probetas para IDIEM.",
    "Colocación de malla bizcocho y segunda capa de shotcrete en sector de sobreexcavación Pk 1+240.",
  ] },
  { id: A(4), empresa: E.tecnasic, textos: [
    "Se realiza extendido y compactación de material 1A capa 17 cota 253,1 m entre los Pk 18 al Pk 30, total 12 m, liberada por parte de calidad, topografía y laboratorio.",
    "Se realiza liberación de capa 16 cota 252,8 m entre los Pk 17 al Pk 29, total 12 m.\nSe realiza corte de talud y carguío en muro Sotelo para posterior endentado 1A atraque izquierdo.",
    "Se realiza preparación y extendido de material 1A en sector zanja cortafuga 4ta capa 30 cm entre los Pk 89 al Pk 110 cota 233,70.",
    "Se realiza excavación de zanja anclaje pata muro Sotelo entre los Pk 160 al Pk 133, total 27 m.",
  ] },
  { id: A(5), empresa: E.idiem, textos: [
    "Lectura de piezómetros de cuerda vibrante PZ-03 a PZ-07; sin variaciones relevantes respecto de la lectura anterior.",
    "Instalación de inclinómetro INC-04 en Pk 0+120, profundidad 18 m, y lectura de referencia.",
    "Control topográfico de prismas de monitoreo P-01 a P-09; desplazamientos dentro de rango.",
  ] },
  { id: A(6), empresa: E.tecnasic, textos: [
    "Verticalización de estructuras entre ejes 8-9 de la torre.\nMontaje de soporte y tablero 3531-TDF-801.",
    "Montaje CAG de 1\" en TDF-801.\nSoldadura y esmerilado de ventanas de soporte SP-015 bastidor.",
    "Touch up de pintura de soporte eléctrico.\nTorque de pernos de anclaje en plataforma nivel 3.",
  ] },
  { id: A(7), empresa: E.tecnasic, textos: [
    "Limpieza de saca en frente de avance y acuñadura mecanizada entre Pk 0+310 y 0+318.",
    "Instalación de ventilación secundaria, ducto de 900 mm, 30 m.",
  ] },
  { id: A(8), empresa: E.oocc, textos: [
    "Excavación y emplantillado para fundación de machones M1a, M1b y M1c de cañería de 6\".",
    "Hormigonado de pedestal fundación F5 en piscina SMA, 2,4 m³ H-30.",
    "Fabricación de camellones en recorrido de cañería de 6\" y cruce de camino Pk 0+060.",
  ] },
  { id: A(9), empresa: E.oocc, textos: [
    "Construcción de cuneta revestida en sector Mentidero, 18 m.",
    "Relleno y compactación de zanja de cañería en capas de 20 cm, 3 capas liberadas.",
  ] },
  { id: A(10), empresa: E.oocc, textos: [
    "Recepción y acopio de cañería HDPE de 6\" en patio de La Bodega, 24 tiras.",
    "Ordenamiento de acopios y señalización de zona de materiales peligrosos.",
  ] },
  { id: A(11), empresa: E.geoinyecta, textos: [
    "Perforación de barrenos de drenaje en caja izquierda Tramo A, 6 barrenos de 6 m.",
    "Inyección de contacto en Pk 0+880 a 0+896, consumo 1,2 m³ de lechada.",
  ] },
  { id: A(12), empresa: E.geoinyecta, textos: [
    "Mapeo geológico del frente Pk 1+236 y definición de soporte tipo III.",
    "Instalación de marcos reticulados en zona de falla Pk 1+242, 3 marcos.",
  ] },
  { id: A(13), empresa: E.tecnasic, textos: [
    "Hormigonado de losa de fundación de cámara Traucalén, 6,5 m³ H-30.",
    "Moldaje y enfierradura de muros de cámara, eje A al C.",
  ] },
  { id: A(14), empresa: E.idiem, textos: [
    "Sondaje S3-MP: ensayo SCPTu hasta 14 m.",
    "Calicatas OA-13 (Macrogranulometría): se alcanza 1,40 m de profundidad, se realiza muestreo, descripción y cierre de prospección.",
    "Sondaje S5-MS: recuperación de testigos entre 22 y 31 m, RQD 64 %.",
  ] },
];

const ALERTAS_TEXTO: { columna: ColumnaAlerta; empresa: string; criticidad: Criticidad; texto: string; area?: string }[] = [
  { columna: "construccion", empresa: E.tecnasic, criticidad: "media", area: A(6), texto: "Acopio de material sin señalética en el acceso a la torre." },
  { columna: "laboratorio", empresa: E.idiem, criticidad: "media", area: A(4), texto: "Densidad in situ de capa 17 bajo el 95 % del Proctor modificado en Pk 24. Se solicita reprocesar y repetir el ensayo." },
  { columna: "construccion", empresa: E.tecnasic, criticidad: "alta", area: A(4), texto: "En zanja de anclaje ZCF los rellenos de las últimas 2 capas no presentan la misma consistencia." },
  { columna: "topografia", empresa: E.tecnasic, criticidad: "baja", area: A(4), texto: "Estaca de referencia del Pk 120 removida; se solicita reponer antes del control de capa." },
  { columna: "interferencia", empresa: E.oocc, criticidad: "media", area: A(8), texto: "Camión aljibe interfiere el frente de excavación de machones; se coordina horario de riego." },
  { columna: "construccion", empresa: E.geoinyecta, criticidad: "alta", area: A(3), texto: "Desprendimiento de roca en caja derecha Pk 1+230 tras la tronadura. Se aísla el sector y se refuerza con pernos." },
  { columna: "laboratorio", empresa: E.idiem, criticidad: "baja", area: A(3), texto: "Probetas de shotcrete del Pk 1+228 sin rotular; se rotulan en terreno." },
  { columna: "interferencia", empresa: E.tecnasic, criticidad: "baja", texto: "Sin actividades en Túnel PAMo, cámara de carga y piscina SMA por corte de energía programado." },
];

// ───────────────────────── Fotos de demostración ─────────────────────────

/** Redimensiona; con `variante` recorta y refleja para tener más fotos distintas de la misma faena. */
async function redimensionar(blob: Blob, ladoMax: number, variante = false): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const sx = variante ? bmp.width * 0.18 : 0, sy = variante ? bmp.height * 0.1 : 0;
  const sw = variante ? bmp.width * 0.72 : bmp.width, sh = variante ? bmp.height * 0.85 : bmp.height;
  const k = Math.min(1, ladoMax / Math.max(sw, sh));
  const c = document.createElement("canvas");
  c.width = Math.round(sw * k);
  c.height = Math.round(sh * k);
  const g = c.getContext("2d")!;
  if (variante) { g.translate(c.width, 0); g.scale(-1, 1); }
  g.drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  bmp.close();
  return aBlob(c);
}

function aBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo crear la imagen."))), "image/jpeg", 0.78));
}

/** Foto sintética con tonos de faena (cielo, cerro y terreno) y un rótulo. */
async function fotoSintetica(n: number): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = 960; c.height = 720;
  const g = c.getContext("2d")!;
  const cielo = g.createLinearGradient(0, 0, 0, 360);
  cielo.addColorStop(0, ["#9fb8c9", "#b7c4cc", "#a9bccb"][n % 3]);
  cielo.addColorStop(1, "#d9dcd6");
  g.fillStyle = cielo; g.fillRect(0, 0, 960, 360);
  g.fillStyle = ["#8c7b66", "#7d6f5d", "#937f68"][n % 3];
  g.beginPath(); g.moveTo(0, 330); g.lineTo(260, 210 + n * 20); g.lineTo(520, 300); g.lineTo(760, 190); g.lineTo(960, 290); g.lineTo(960, 400); g.lineTo(0, 400); g.fill();
  const suelo = g.createLinearGradient(0, 360, 0, 720);
  suelo.addColorStop(0, "#b9a07a"); suelo.addColorStop(1, "#8f7655");
  g.fillStyle = suelo; g.fillRect(0, 380, 960, 340);
  g.strokeStyle = "rgba(60,45,30,.25)"; g.lineWidth = 6;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 450 + i * 45); g.lineTo(960, 430 + i * 50); g.stroke(); }
  g.fillStyle = "#e0a31a"; g.fillRect(560 - n * 120, 440, 170, 70); g.fillRect(600 - n * 120, 405, 70, 40);
  g.fillStyle = "#333"; g.beginPath(); g.arc(590 - n * 120, 515, 22, 0, 7); g.arc(700 - n * 120, 515, 22, 0, 7); g.fill();
  g.fillStyle = "rgba(30,43,56,.78)"; g.fillRect(24, 640, 430, 52);
  g.fillStyle = "#fff"; g.font = "600 26px sans-serif"; g.fillText(`Foto de demostración ${n + 1}`, 40, 675);
  return aBlob(c);
}

/**
 * Fotos de la semilla: [0] real-01 y [1] real-02 (faena), [2] real-03 (tabla de perforaciones del
 * Vertedero Morning Glory, como en el informe real), [3] y [4] variantes recortadas de las dos primeras.
 */
async function fotosBase(): Promise<Blob[]> {
  const originales: (Blob | null)[] = [];
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`/demo/fotos/real-0${i + 1}.jpg`);
      if (!r.ok) throw new Error(String(r.status));
      originales.push(await r.blob());
    } catch {
      originales.push(null);
    }
  }
  const una = async (i: number, variante: boolean) => {
    const o = originales[i];
    if (o) { try { return await redimensionar(o, 960, variante); } catch { /* imagen dañada: sintética */ } }
    return fotoSintetica(i + (variante ? 3 : 0));
  };
  return Promise.all([una(0, false), una(1, false), una(2, false), una(0, true), una(1, true)]);
}

/** Fotos de faena (sin la tabla) para elegir al azar. */
const FOTOS_CAMPO = [0, 1, 3, 4];

// ───────────────────────── Generador ─────────────────────────

function aleatorio(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

interface Lote {
  reportes: Reporte[]; areasTurno: AreaTurno[]; registros: Registro[]; alertas: Alerta[];
  fotografias: Fotografia[]; envios: Envio[];
}

interface DiaPlan {
  fecha: string;
  tipo: "enviado" | "borrador" | "sin_reporte";
}

let sembrando: Promise<void> | null = null;

/** Siembra si la base está vacía o si cambió la versión de la semilla. */
export function sembrarSiFalta(): Promise<void> {
  if (!sembrando) sembrando = sembrarSiFaltaInterno().finally(() => { sembrando = null; });
  return sembrando;
}

async function sembrarSiFaltaInterno() {
  const version = (await db.ajustes.get(CLAVES.semilla))?.valor;
  if (version === SEMILLA_VERSION && (await db.contratos.count()) > 0) return;
  if (version && VERSIONES_MIGRABLES.includes(version) && (await db.contratos.count()) > 0) {
    await migrarIdsCatalogo();
    return;
  }
  const destinatario = (await db.ajustes.get(CLAVES.destinatario))?.valor;
  await db.transaction("rw", db.tables, async () => { await Promise.all(db.tables.map((t) => t.clear())); });
  await sembrar(destinatario);
}

export async function sembrar(destinatario?: string): Promise<void> {
  const hoy = hoyLocal();
  const ahora = ahoraISO();
  const fotos = await fotosBase();
  const rnd = aleatorio(20261020);

  // Rol 7x7: hoy es el 3.er día de trabajo.
  const rol: RolTurno = { id: idRol("Jorge Orellana S."), usuarioId: USUARIO_ID, contratoId: CONTRATO_ID, diasTrabajo: 7, diasDescanso: 7, fechaInicio: sumarDias(hoy, -2) };
  const roles = rolesDeTerreno(rol);

  // Días de trabajo de las últimas ~6 semanas (3 ciclos anteriores completos + 2 días del actual).
  const plan: DiaPlan[] = [];
  for (let d = -44; d < 0; d++) {
    const fecha = sumarDias(hoy, d);
    if (esDiaTrabajo(fecha, rol)) plan.push({ fecha, tipo: "enviado" });
  }
  // Dos días no entregados: uno con borrador sin aprobar y otro sin reporte.
  const trabajo = plan.length;
  if (trabajo > 10) {
    plan[trabajo - 6].tipo = "borrador"; // 4.º día del ciclo anterior
    plan[Math.min(9, trabajo - 1)].tipo = "sin_reporte";
  }

  const conReporte = plan.filter((p) => p.tipo !== "sin_reporte").length;
  let correlativo = CORRELATIVO_HOY - conReporte; // el de hoy queda en CORRELATIVO_HOY

  const contrato: Contrato = { ...CATALOGO.contrato, ultimoCorrelativo: CORRELATIVO_HOY, destinatarios: [destinatario ?? DESTINATARIO_DEFECTO] };
  const usuarios: Usuario[] = CATALOGO.usuarios;
  const areas: Area[] = CATALOGO.areas;

  const lote: Lote = { reportes: [], areasTurno: [], registros: [], alertas: [], fotografias: [], envios: [] };
  const climas: Clima[] = ["despejado", "despejado", "despejado", "nublado", "despejado", "nublado", "lluvia"];
  const fijas = [A(4), A(6), A(1)];
  const resto = AREAS.map((a) => a.id).filter((id) => !fijas.includes(id));

  for (const dia of plan) {
    if (dia.tipo === "sin_reporte") continue;
    correlativo++;
    const enviado = dia.tipo === "enviado";
    const clima = climas[Math.floor(rnd() * climas.length)];
    const envioMin = 17 * 60 + 15 + Math.floor(rnd() * 100); // 17:15 a 18:55
    const reporte: Reporte = {
      id: nuevoId(), contratoId: CONTRATO_ID, fecha: dia.fecha, turno: "dia",
      correlativo: formatoCorrelativo(contrato.prefijoCorrelativo, correlativo),
      elaboradoPor: USUARIO_ID, climaTurno: clima, climaProyeccion: climas[Math.floor(rnd() * climas.length)],
      estado: enviado ? "enviado" : "borrador",
      horaGeneracion: enviado ? instante(dia.fecha, hhmm(envioMin - 7)) : undefined,
      horaAprobacion: enviado ? instante(dia.fecha, hhmm(envioMin - 2)) : undefined,
      aprobadoPor: enviado ? USUARIO_ID : undefined,
      sincronizadoEn: ahora,
    };
    lote.reportes.push(reporte);

    // 3 a 5 áreas: las tres frecuentes más una o dos del resto.
    const extra = [...resto].sort(() => rnd() - 0.5).slice(0, dia.tipo === "borrador" ? 0 : 1 + Math.floor(rnd() * 2));
    const ids = [...fijas, ...extra];
    let minuto = 8 * 60 + 10;
    ids.forEach((areaId, i) => {
      const a = AREAS.find((x) => x.id === areaId)!;
      const at: AreaTurno = { id: nuevoId(), reporteId: reporte.id, areaId, empresaId: a.empresa, orden: i + 1, agregadaEn: instante(dia.fecha, "07:50") };
      lote.areasTurno.push(at);
      const sinActividad = enviado && i > 0 && rnd() < 0.18;
      minuto += 50 + Math.floor(rnd() * 70);
      const reg: Registro = {
        id: nuevoId(), reporteId: reporte.id, areaTurnoId: at.id, sinActividad,
        descripcion: sinActividad ? "" : a.textos[Math.floor(rnd() * a.textos.length)],
        origenDescripcion: rnd() < 0.8 ? "dictado" : "escrito",
        latitud: GPS.latitud + (rnd() - 0.5) * 0.004, longitud: GPS.longitud + (rnd() - 0.5) * 0.004,
        registradoEn: instante(dia.fecha, hhmm(Math.min(minuto, 16 * 60 + 40))), sincronizadoEn: ahora,
      };
      lote.registros.push(reg);
      if (!sinActividad) {
        const nFotos = rnd() < 0.3 ? 2 : 1;
        for (let k = 0; k < nFotos; k++) {
          lote.fotografias.push({
            id: nuevoId(), registroId: reg.id, orden: k + 1,
            imagen: fotos[areaId === A(1) && k === 0 && rnd() < 0.5 ? 2 : FOTOS_CAMPO[Math.floor(rnd() * FOTOS_CAMPO.length)]],
            capturadaEn: reg.registradoEn, latitud: reg.latitud, longitud: reg.longitud, sincronizadoEn: ahora,
          });
        }
      }
    });

    // 0 a 2 alertas por día enviado.
    const nAlertas = enviado ? Math.floor(rnd() * 3) : 0;
    for (let k = 0; k < nAlertas; k++) {
      const t = ALERTAS_TEXTO[Math.floor(rnd() * ALERTAS_TEXTO.length)];
      const at = lote.areasTurno.find((x) => x.reporteId === reporte.id && x.areaId === t.area);
      const al: Alerta = {
        id: nuevoId(), reporteId: reporte.id, columna: t.columna, empresaId: t.empresa, areaTurnoId: at?.id,
        descripcion: t.texto, criticidad: t.criticidad, registradoEn: instante(dia.fecha, hhmm(10 * 60 + k * 150)), sincronizadoEn: ahora,
      };
      lote.alertas.push(al);
      if (t.criticidad === "alta") {
        lote.fotografias.push({ id: nuevoId(), alertaId: al.id, imagen: fotos[FOTOS_CAMPO[k % FOTOS_CAMPO.length]], orden: 1, capturadaEn: al.registradoEn, sincronizadoEn: ahora });
      }
    }

    if (enviado) {
      lote.envios.push({
        id: nuevoId(), reporteId: reporte.id, enviadoPor: USUARIO_ID, destinatarios: contrato.destinatarios,
        estado: "enviado", creadoEn: instante(dia.fecha, hhmm(envioMin - 1)), enviadoEn: instante(dia.fecha, hhmm(envioMin)),
        intentos: 1, sincronizadoEn: ahora,
      });
    }
  }

  sembrarHoy(lote, hoy, contrato, fotos, ahora);

  await db.transaction("rw", db.tables, async () => {
    await db.usuarios.bulkAdd(usuarios);
    await db.contratos.add(contrato);
    await db.empresas.bulkAdd(EMPRESAS);
    await db.areas.bulkAdd(areas);
    await db.rolesTurno.bulkAdd(roles);
    await db.reportes.bulkAdd(lote.reportes);
    await db.areasTurno.bulkAdd(lote.areasTurno);
    await db.registros.bulkAdd(lote.registros);
    await db.alertas.bulkAdd(lote.alertas);
    await db.fotografias.bulkAdd(lote.fotografias);
    await db.envios.bulkAdd(lote.envios);
    await db.ajustes.bulkPut([
      { clave: CLAVES.usuario, valor: USUARIO_ID },
      { clave: CLAVES.contrato, valor: CONTRATO_ID },
      { clave: CLAVES.destinatario, valor: contrato.destinatarios[0] },
      { clave: CLAVES.semilla, valor: SEMILLA_VERSION },
    ]);
  });
}

/** Reporte de hoy como 01a: 3 áreas con registro, 1 sin actividad, Peralte Muro Sotelo pendiente y 2 alertas. */
function sembrarHoy(lote: Lote, hoy: string, contrato: Contrato, fotos: Blob[], ahora: string) {
  const reporte: Reporte = {
    id: nuevoId(), contratoId: CONTRATO_ID, fecha: hoy, turno: "dia",
    correlativo: formatoCorrelativo(contrato.prefijoCorrelativo, CORRELATIVO_HOY),
    elaboradoPor: USUARIO_ID, climaTurno: "despejado", climaProyeccion: "despejado", estado: "borrador", sincronizadoEn: ahora,
  };
  lote.reportes.push(reporte);
  const filas: { area: string; empresa: string; hora?: string; texto?: string; fotos?: number[] }[] = [
    { area: A(1), empresa: E.geoinyecta, hora: "08:40", fotos: [2, 0],
      texto: "Se realiza perforación de pozos de consolidación de las corridas E (2-6-7) y D (1-2-3-4-5-10-11-12) con 11 pozos; total de metros perforados 88 m." },
    { area: A(4), empresa: E.tecnasic },
    { area: A(6), empresa: E.tecnasic, hora: "11:15", fotos: [3],
      texto: "Verticalización de estructuras entre ejes 8-9 de la torre.\nMontaje de soporte y tablero 3531-TDF-801.\nMontaje CAG de 1\" en TDF-801." },
    { area: A(8), empresa: E.oocc, hora: "14:02", fotos: [1, 4],
      texto: "Excavación y emplantillado para fundación de machones M1a, M1b y M1c de cañería de 6\".\nFabricación de camellones en recorrido de cañería de 6\"." },
    { area: A(14), empresa: E.idiem, hora: "15:30" },
  ];
  const ats: Record<string, string> = {};
  filas.forEach((f, i) => {
    const at: AreaTurno = { id: nuevoId(), reporteId: reporte.id, areaId: f.area, empresaId: f.empresa, orden: i + 1, agregadaEn: instante(hoy, "07:45") };
    ats[f.area] = at.id;
    lote.areasTurno.push(at);
    if (!f.hora) return; // Peralte Muro Sotelo queda pendiente
    const sinActividad = !f.texto;
    const reg: Registro = {
      id: nuevoId(), reporteId: reporte.id, areaTurnoId: at.id, sinActividad, descripcion: f.texto ?? "",
      origenDescripcion: "dictado", latitud: GPS.latitud, longitud: GPS.longitud, registradoEn: instante(hoy, f.hora), sincronizadoEn: ahora,
    };
    lote.registros.push(reg);
    (f.fotos ?? []).forEach((n, k) => lote.fotografias.push({
      id: nuevoId(), registroId: reg.id, imagen: fotos[n], orden: k + 1, capturadaEn: reg.registradoEn,
      latitud: GPS.latitud, longitud: GPS.longitud, sincronizadoEn: ahora,
    }));
  });
  const alta: Alerta = {
    id: nuevoId(), reporteId: reporte.id, columna: "construccion", empresaId: E.tecnasic, areaTurnoId: ats[A(6)],
    descripcion: "Trabajos en altura en eje 8-9 de la torre sin línea de vida instalada en el tramo superior. Se detiene la actividad hasta regularizar.",
    criticidad: "alta", registradoEn: instante(hoy, "11:30"), sincronizadoEn: ahora,
  };
  const media: Alerta = {
    id: nuevoId(), reporteId: reporte.id, columna: "laboratorio", empresaId: E.idiem,
    descripcion: "Densidad in situ de capa 17 de Muro Sotelo bajo el 95 % del Proctor modificado en Pk 24. Se solicita reprocesar y repetir el ensayo.",
    criticidad: "media", registradoEn: instante(hoy, "12:10"), sincronizadoEn: ahora,
  };
  lote.alertas.push(alta, media);
  lote.fotografias.push({ id: nuevoId(), alertaId: alta.id, imagen: fotos[4], orden: 1, capturadaEn: alta.registradoEn, sincronizadoEn: ahora });
}

/** Rol 7x7 de los usuarios de terreno (inspectores y jefe de turno), copiando el del inspector principal. */
function rolesDeTerreno(base: RolTurno): RolTurno[] {
  return [base, ...CATALOGO.usuarios
    .filter((u) => u.id !== base.usuarioId && u.rol !== "admin")
    .map((u) => ({ ...base, id: idRol(u.nombre), usuarioId: u.id }))];
}

/**
 * Pasa el catálogo de la semilla anterior («u-orellana», «c-4600026893», «e1-tecnasic», «a-01»…)
 * a los ids estables y actualiza las referencias: lo registrado en el teléfono se conserva.
 */
async function migrarIdsCatalogo(): Promise<void> {
  const mapa: Record<string, string> = {
    "u-orellana": USUARIO_ID, "c-4600026893": CONTRATO_ID, "rol-orellana": idRol("Jorge Orellana S."),
    "e1-tecnasic": E.tecnasic, "e2-geoinyecta": E.geoinyecta, "e3-idiem": E.idiem, "e4-oocc": E.oocc,
  };
  for (let n = 1; n <= 14; n++) mapa[`a-${String(n).padStart(2, "0")}`] = A(n);
  const m = <T extends string | undefined>(id: T): T => (id && mapa[id] ? mapa[id] : id) as T;
  const viejos = Object.keys(mapa);

  await db.transaction("rw", db.tables, async () => {
    const contratoViejo = await db.contratos.get("c-4600026893");
    const rolViejo = await db.rolesTurno.get("rol-orellana");
    await Promise.all([
      db.usuarios.bulkDelete(viejos), db.contratos.bulkDelete(viejos), db.empresas.bulkDelete(viejos),
      db.areas.bulkDelete(viejos), db.rolesTurno.bulkDelete(viejos),
    ]);
    await db.usuarios.bulkPut(CATALOGO.usuarios);
    await db.contratos.put({
      ...CATALOGO.contrato,
      ultimoCorrelativo: Math.max(contratoViejo?.ultimoCorrelativo ?? 0, CORRELATIVO_HOY),
      destinatarios: contratoViejo?.destinatarios?.length ? contratoViejo.destinatarios : CATALOGO.contrato.destinatarios,
    });
    await db.empresas.bulkPut(EMPRESAS);
    await db.areas.bulkPut(CATALOGO.areas);
    const base: RolTurno = rolViejo
      ? { ...rolViejo, id: idRol("Jorge Orellana S."), usuarioId: USUARIO_ID, contratoId: CONTRATO_ID }
      : { id: idRol("Jorge Orellana S."), usuarioId: USUARIO_ID, contratoId: CONTRATO_ID, diasTrabajo: 7, diasDescanso: 7, fechaInicio: sumarDias(hoyLocal(), -2) };
    await db.rolesTurno.bulkPut(rolesDeTerreno(base));

    await db.reportes.toCollection().modify((r) => {
      r.contratoId = m(r.contratoId); r.elaboradoPor = m(r.elaboradoPor); r.aprobadoPor = m(r.aprobadoPor);
    });
    await db.areasTurno.toCollection().modify((a) => { a.areaId = m(a.areaId); a.empresaId = m(a.empresaId); });
    await db.alertas.toCollection().modify((a) => { a.empresaId = m(a.empresaId); });
    await db.envios.toCollection().modify((e) => { e.enviadoPor = m(e.enviadoPor); });
    await db.consolidados.toCollection().modify((c) => { c.contratoId = m(c.contratoId); c.consolidadoPor = m(c.consolidadoPor); });
    for (const clave of [CLAVES.usuario, CLAVES.contrato]) {
      const a = await db.ajustes.get(clave);
      if (a) await db.ajustes.put({ clave, valor: m(a.valor) });
    }
    await db.ajustes.put({ clave: CLAVES.semilla, valor: SEMILLA_VERSION });
  });
}

/** «Reiniciar datos de demostración»: borra todo y vuelve a sembrar, conservando el destinatario de prueba. */
export async function reiniciarDemostracion(): Promise<void> {
  const destinatario = (await db.ajustes.get(CLAVES.destinatario))?.valor;
  await db.transaction("rw", db.tables, async () => { await Promise.all(db.tables.map((t) => t.clear())); });
  await sembrar(destinatario);
}

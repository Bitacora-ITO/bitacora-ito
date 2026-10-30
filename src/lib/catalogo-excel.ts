// Catálogo del contrato en Excel: plantilla, lectura, validación y cambios frente al catálogo actual.
//
// Módulo puro: no usa Dexie, Supabase ni el navegador. Así lo usan la pantalla /admin, la semilla
// (ids estables) y los scripts de prueba de scripts/catalogo/ (que lo ejecutan con Node).
// Las librerías de Excel (write-excel-file / read-excel-file) se llaman desde fuera: aquí entran
// y salen solo filas y celdas.
import type { Area, Contrato, Empresa, RolApp, TipoEmpresa, Usuario } from "./types";

// ───────────────────────── Ids estables ─────────────────────────

/** Clave de comparación: sin tildes, en minúsculas y con los espacios normalizados. */
export function claveNombre(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Hash de 128 bits (cyrb128). No es criptográfico: solo da un id estable a partir de un texto. */
function hash128(s: string): number[] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < s.length; i++) {
    const k = s.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/**
 * UUID estable derivado del tipo, el contrato y el nombre: todos los teléfonos que siembran o
 * descargan el mismo catálogo obtienen los mismos ids (necesario para consolidar partes de varios
 * teléfonos y para las llaves foráneas de Supabase, que son `uuid`).
 */
export function idEstable(tipo: "contrato" | "area" | "empresa" | "usuario" | "rol", contexto: string, nombre: string): string {
  const hex = hash128(`bitacora-ito|${tipo}|${contexto}|${claveNombre(nombre)}`).map((n) => n.toString(16).padStart(8, "0")).join("");
  const variante = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variante}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export const idContrato = (numero: string) => idEstable("contrato", "", numero);
export const idArea = (contratoId: string, nombre: string) => idEstable("area", contratoId, nombre);
export const idEmpresa = (contratoId: string, nombre: string) => idEstable("empresa", contratoId, nombre);
export const idUsuario = (contratoId: string, nombre: string) => idEstable("usuario", contratoId, nombre);

// ───────────────────────── Catálogo base (semilla y plantilla) ─────────────────────────

export interface CatalogoDatos {
  contrato: Contrato;
  areas: Area[];
  empresas: Empresa[];
  usuarios: Usuario[];
}

/** Las 14 áreas del contrato, tal como vienen en otrosdoc/Áreas.xlsx. */
export const AREAS_CONTRATO = [
  "Vertedero Morning Glory",
  "Acceso a obra de captación",
  "Fortificación Tramo B",
  "Peralte Muro Sotelo",
  "Instrumentación geotécnica Muro Sotelo",
  "Torre de Captación",
  "Túnel PAMo",
  "Sistema de Manejo de Aguas",
  "Mentidero",
  "La Bodega",
  "Tramo A",
  "Tramo B",
  "Traucalén",
  "Sondajes",
] as const;

export const NUMERO_CONTRATO = "4600026893";
export const CONTRATO_BASE_ID = idContrato(NUMERO_CONTRATO);

const EMPRESAS_BASE: { nombre: string; tipo: TipoEmpresa }[] = [
  { nombre: "TECNASIC", tipo: "contratista" },
  { nombre: "GEOINYECTA", tipo: "contratista" },
  { nombre: "IDIEM", tipo: "laboratorio" },
  { nombre: "OOCC", tipo: "obras_civiles" },
];

const USUARIOS_BASE: { nombre: string; correo: string; rol: RolApp }[] = [
  { nombre: "Jorge Orellana S.", correo: "jorellana@ejemplo.cl", rol: "inspector" },
  { nombre: "Alberto Castillo", correo: "acastillo@ejemplo.cl", rol: "inspector" },
  { nombre: "Arnoldi Díaz", correo: "adiaz@ejemplo.cl", rol: "inspector" },
  { nombre: "Paula Rojas", correo: "projas@ejemplo.cl", rol: "jefatura" },
  { nombre: "Administrador Bitácora", correo: "admin@ejemplo.cl", rol: "admin" },
];

/** Catálogo con que parte cada teléfono (semilla) y con que viene llena la plantilla publicada. */
export function catalogoBase(opciones: { destinatarios?: string[]; ultimoCorrelativo?: number } = {}): CatalogoDatos {
  const cid = CONTRATO_BASE_ID;
  return {
    contrato: {
      id: cid,
      nombre: "Servicio de Inspección Técnica de Obras y Apoyo a la Construcción de Carén",
      numero: NUMERO_CONTRATO,
      mandante: "Mandante del contrato",
      codigoProyecto: "4600026893-8211-FRMCS-00001",
      codigoInterno: "JEJ-664-CT-INF-002",
      revisionFormato: "1",
      fechaFormato: "02-07-2024",
      prefijoCorrelativo: "4600026893-8211-INDCS-",
      ultimoCorrelativo: opciones.ultimoCorrelativo ?? 1972,
      destinatarios: opciones.destinatarios ?? ["inspeccion@mandante.cl"],
      horaCierreTurnoDia: "19:00",
    },
    areas: AREAS_CONTRATO.map((nombre, i) => ({ id: idArea(cid, nombre), contratoId: cid, nombre, orden: i + 1, vigente: true })),
    empresas: EMPRESAS_BASE.map((e) => ({ id: idEmpresa(cid, e.nombre), contratoId: cid, nombre: e.nombre, tipo: e.tipo })),
    usuarios: USUARIOS_BASE.map((u) => ({ id: idUsuario(cid, u.nombre), contratoId: cid, activo: true, ...u })),
  };
}

// ───────────────────────── Formato del Excel ─────────────────────────

export const HOJAS = { contrato: "Contrato", areas: "Áreas", empresas: "Empresas", usuarios: "Usuarios" } as const;

export const ENCABEZADOS = {
  contrato: [
    "Número de contrato", "Nombre del servicio", "Mandante", "Código de proyecto", "Código interno",
    "Revisión de formato", "Fecha de formato", "Prefijo de correlativo", "Último correlativo",
    "Destinatarios (separados por ;)", "Hora de cierre turno día",
  ],
  areas: ["Nombre", "Orden", "Vigente"],
  empresas: ["Nombre", "Tipo"],
  usuarios: ["Nombre", "Correo", "Rol", "Activo"],
} as const;

export const TIPOS_EMPRESA: { valor: TipoEmpresa; etiqueta: string }[] = [
  { valor: "contratista", etiqueta: "Contratista" },
  { valor: "laboratorio", etiqueta: "Laboratorio" },
  { valor: "topografia", etiqueta: "Topografía" },
  { valor: "obras_civiles", etiqueta: "Obras civiles" },
  { valor: "otro", etiqueta: "Otro" },
];

export const ROLES: { valor: RolApp; etiqueta: string }[] = [
  { valor: "inspector", etiqueta: "Inspector" },
  { valor: "jefatura", etiqueta: "Jefe de turno" },
  { valor: "admin", etiqueta: "Administrador" },
];

export const etiquetaRol = (r: RolApp) => ROLES.find((x) => x.valor === r)?.etiqueta ?? r;
export const etiquetaTipo = (t: TipoEmpresa) => TIPOS_EMPRESA.find((x) => x.valor === t)?.etiqueta ?? t;

export const NOMBRE_PLANTILLA = "catalogo-bitacora-ito.xlsx";
export const NOMBRE_PLANTILLA_EN_BLANCO = "catalogo-bitacora-ito-en-blanco.xlsx";

/**
 * Las filas cuya primera celda empieza con esta marca son de ejemplo: la app las omite al cargar.
 * La plantilla en blanco trae una por hoja (en gris y cursiva) para mostrar cómo se llena.
 */
export const MARCA_EJEMPLO = "(Ejemplo)";

// ───────────────────────── Plantilla (escritura) ─────────────────────────

/** Celda en el formato de write-excel-file (sin importar sus tipos, para que el módulo siga puro). */
export interface CeldaExcel {
  value?: string | number;
  type?: StringConstructor | NumberConstructor;
  fontWeight?: "bold";
  fontStyle?: "italic";
  backgroundColor?: string;
  textColor?: string;
  wrap?: boolean;
  columnSpan?: number;
  height?: number;
  alignVertical?: "top" | "center" | "bottom";
}

export interface HojaExcel {
  sheet: string;
  data: (CeldaExcel | null)[][];
  columns: { width: number }[];
  stickyRowsCount?: number;
}

const enc = (value: string): CeldaExcel => ({ value, type: String, fontWeight: "bold", backgroundColor: "#DCEFEC", textColor: "#0B3B36" });
const txt = (value: string): CeldaExcel => ({ value, type: String });
const num = (value: number): CeldaExcel => ({ value, type: Number });
const siNo = (v: boolean | undefined) => txt(v === false ? "No" : "Sí");

/** Hojas de la plantilla llenas con el catálogo indicado (las 4 hojas de datos y una de instrucciones). */
export function construirHojas(cat: CatalogoDatos): HojaExcel[] {
  const c = cat.contrato;
  const areas = [...cat.areas].sort((a, b) => a.orden - b.orden);
  return [
    {
      sheet: HOJAS.contrato,
      stickyRowsCount: 1,
      columns: [18, 60, 26, 30, 22, 12, 14, 26, 14, 40, 14].map((width) => ({ width })),
      data: [
        ENCABEZADOS.contrato.map(enc),
        [
          txt(c.numero), txt(c.nombre), txt(c.mandante), txt(c.codigoProyecto), txt(c.codigoInterno),
          txt(c.revisionFormato), txt(c.fechaFormato), txt(c.prefijoCorrelativo), num(c.ultimoCorrelativo),
          txt(c.destinatarios.join("; ")), txt(c.horaCierreTurnoDia),
        ],
      ],
    },
    {
      sheet: HOJAS.areas,
      stickyRowsCount: 1,
      columns: [44, 10, 10].map((width) => ({ width })),
      data: [ENCABEZADOS.areas.map(enc), ...areas.map((a) => [txt(a.nombre), num(a.orden), siNo(a.vigente)])],
    },
    {
      sheet: HOJAS.empresas,
      stickyRowsCount: 1,
      columns: [30, 18].map((width) => ({ width })),
      data: [ENCABEZADOS.empresas.map(enc), ...cat.empresas.map((e) => [txt(e.nombre), txt(etiquetaTipo(e.tipo))])],
    },
    {
      sheet: HOJAS.usuarios,
      stickyRowsCount: 1,
      columns: [30, 30, 18, 10].map((width) => ({ width })),
      data: [ENCABEZADOS.usuarios.map(enc), ...cat.usuarios.map((u) => [txt(u.nombre), txt(u.correo), txt(etiquetaRol(u.rol)), siNo(u.activo)])],
    },
    {
      sheet: "Instrucciones",
      columns: [{ width: 110 }],
      data: [
        [enc("Cómo llenar el catálogo de Bitácora ITO")],
        [txt("1. No cambie el nombre de las hojas ni los encabezados de la fila 1.")],
        [txt("2. Hoja «Contrato»: una sola fila. Destinatarios separados por punto y coma (;). Hora de cierre como 19:00.")],
        [txt("3. Hoja «Áreas»: nombre, orden (número entero) y Vigente con Sí o No. Un área que ya no se usa se marca «No»: no se borra, porque hay reportes que la usan.")],
        [txt(`4. Hoja «Empresas»: nombre y tipo (${TIPOS_EMPRESA.map((t) => t.etiqueta).join(" / ")}). Una empresa que no aparezca se conserva en los reportes antiguos, pero deja de ofrecerse en los teléfonos.`)],
        [txt(`5. Hoja «Usuarios»: nombre, correo, rol (${ROLES.map((r) => r.etiqueta).join(" / ")}) y Activo con Sí o No. Un usuario que no aparezca queda inactivo.`)],
        [txt("6. Los nombres no se pueden repetir dentro de una hoja. Para renombrar un área, agregue la nueva y marque la antigua con Vigente = No.")],
        [txt("7. En la app: Ajustes → Administrar catálogo → Cargar Excel → revisar la vista previa → Publicar catálogo. Los teléfonos verán «Hay un catálogo nuevo · Actualizar».")],
      ],
    },
  ];
}

const ej = (value: string | number): CeldaExcel => ({ value, type: typeof value === "number" ? Number : String, fontStyle: "italic", textColor: "#7A8A94" });
const marca = (texto: string) => ej(`${MARCA_EJEMPLO} ${texto}`);

/**
 * Plantilla en blanco «solo llenar»: hoja de instrucciones al inicio y, en cada hoja, el encabezado fijo
 * y una fila de ejemplo marcada con «(Ejemplo)» que la app omite al cargar (se puede dejar o borrar).
 */
export function construirPlantillaEnBlanco(): HojaExcel[] {
  const tipos = TIPOS_EMPRESA.map((t) => t.etiqueta).join(" / ");
  const roles = ROLES.map((r) => r.etiqueta).join(" / ");
  const fila = (hoja: string, columna: string, que: string, valores: string) =>
    [txt(hoja), txt(columna), { ...txt(que), wrap: true }, { ...txt(valores), wrap: true }];
  return [
    {
      sheet: "Instrucciones",
      stickyRowsCount: 3,
      columns: [14, 32, 60, 40].map((width) => ({ width })),
      data: [
        [{ ...enc("Catálogo de Bitácora ITO · plantilla en blanco"), columnSpan: 4 }, null, null, null],
        [{ ...txt(`Llene las hojas Contrato, Áreas, Empresas y Usuarios desde la fila 3. No cambie los nombres de las hojas ni los encabezados de la fila 1. La fila 2 de cada hoja es un ejemplo marcado con «${MARCA_EJEMPLO}»: la app la omite, puede dejarla o borrarla.`), columnSpan: 4, wrap: true, height: 48, alignVertical: "top" }, null, null, null],
        ["Hoja", "Columna", "Qué escribir", "Valores permitidos"].map(enc),
        fila("Contrato", "Número de contrato", "Número del contrato (una sola fila de datos en esta hoja). Debe ser el mismo contrato de la app.", "Texto, p. ej. 4600026893"),
        fila("Contrato", "Nombre del servicio", "Nombre del servicio tal como sale en el reporte.", "Texto"),
        fila("Contrato", "Mandante", "Nombre del mandante.", "Texto"),
        fila("Contrato", "Código de proyecto", "Código del formato del reporte.", "Texto, p. ej. 4600026893-8211-FRMCS-00001"),
        fila("Contrato", "Código interno", "Código interno del informe (opcional).", "Texto"),
        fila("Contrato", "Revisión de formato", "Revisión del formato.", "Texto, p. ej. 1"),
        fila("Contrato", "Fecha de formato", "Fecha del formato tal como se imprime (opcional).", "Texto, p. ej. 02-07-2024"),
        fila("Contrato", "Prefijo de correlativo", "Parte fija del correlativo del reporte.", "Texto, p. ej. 4600026893-8211-INDCS-"),
        fila("Contrato", "Último correlativo", "Último número usado; el siguiente reporte usa este + 1.", "Número entero, p. ej. 1972"),
        fila("Contrato", "Destinatarios (separados por ;)", "Correos que reciben el reporte.", "Correos separados por punto y coma"),
        fila("Contrato", "Hora de cierre turno día", "Hora de cierre del turno día.", "HH:MM, p. ej. 19:00"),
        fila("Áreas", "Nombre", "Nombre del área (sin repetir).", "Texto"),
        fila("Áreas", "Orden", "Posición en la lista de la app.", "Número entero mayor que 0"),
        fila("Áreas", "Vigente", "Si se ofrece a los inspectores. Un área que ya no va se marca No: no se borra.", "Sí / No"),
        fila("Empresas", "Nombre", "Nombre de la empresa (sin repetir).", "Texto"),
        fila("Empresas", "Tipo", "Tipo de empresa.", tipos),
        fila("Usuarios", "Nombre", "Nombre como se imprime en «Elaborado por» (sin repetir).", "Texto"),
        fila("Usuarios", "Correo", "Correo del usuario (sin repetir).", "Correo válido"),
        fila("Usuarios", "Rol", "Lo que ve en la app.", roles),
        fila("Usuarios", "Activo", "Si puede usar la app. Quien no aparezca queda inactivo.", "Sí / No"),
      ],
    },
    {
      sheet: HOJAS.contrato,
      stickyRowsCount: 1,
      columns: [18, 60, 26, 30, 22, 12, 14, 26, 14, 40, 14].map((width) => ({ width })),
      data: [
        ENCABEZADOS.contrato.map(enc),
        [marca("4600026893"), ej("Servicio de Inspección Técnica de Obras"), ej("Mandante del contrato"), ej("4600026893-8211-FRMCS-00001"),
          ej("JEJ-664-CT-INF-002"), ej("1"), ej("02-07-2024"), ej("4600026893-8211-INDCS-"), ej(1972), ej("inspeccion@mandante.cl; jefatura@mandante.cl"), ej("19:00")],
      ],
    },
    {
      sheet: HOJAS.areas,
      stickyRowsCount: 1,
      columns: [44, 10, 10].map((width) => ({ width })),
      data: [ENCABEZADOS.areas.map(enc), [marca("Peralte Muro Sotelo"), ej(1), ej("Sí")]],
    },
    {
      sheet: HOJAS.empresas,
      stickyRowsCount: 1,
      columns: [30, 18].map((width) => ({ width })),
      data: [ENCABEZADOS.empresas.map(enc), [marca("TECNASIC"), ej("Contratista")]],
    },
    {
      sheet: HOJAS.usuarios,
      stickyRowsCount: 1,
      columns: [30, 30, 18, 10].map((width) => ({ width })),
      data: [ENCABEZADOS.usuarios.map(enc), [marca("Jorge Orellana S."), ej("jorellana@ejemplo.cl"), ej("Inspector"), ej("Sí")]],
    },
  ];
}

// ───────────────────────── Lectura y validación ─────────────────────────

/** Valor de celda tal como lo entrega read-excel-file. */
export type ValorCelda = string | number | boolean | Date | null | undefined;
export interface HojaLeida {
  sheet: string;
  data: ValorCelda[][];
}

export type HojaCatalogo = (typeof HOJAS)[keyof typeof HOJAS];

export interface Problema {
  hoja: HojaCatalogo | "Libro";
  fila?: number; // número de fila en Excel (la 1 es el encabezado)
  mensaje: string;
}

export interface ResultadoLectura {
  errores: Problema[];
  avisos: Problema[];
  /** Solo si no hay errores. */
  catalogo?: CatalogoPublicable;
  cambios?: ResumenCambios;
}

/** Lo que se publica: incluye las áreas y usuarios que salen del Excel (vigente / activo = false). */
export interface CatalogoPublicable extends CatalogoDatos {
  /** Ids de las empresas que vienen en el Excel (las demás se conservan pero no se ofrecen). */
  empresasVigentes: string[];
}

export interface ResumenCambios {
  contrato: string[]; // campos que cambian
  areas: { nuevas: string[]; dejanDeEstarVigentes: string[]; vuelvenAEstarVigentes: string[]; cambianOrden: string[]; total: number; vigentes: number };
  empresas: { nuevas: string[]; cambianTipo: string[]; seMantienen: string[]; total: number };
  usuarios: { nuevos: string[]; desactivados: string[]; reactivados: string[]; cambianRol: string[]; cambianCorreo: string[]; total: number; activos: number };
  hayCambios: boolean;
}

const CORREO = /^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/;
const letra = (i: number) => String.fromCharCode(65 + i);

/** Texto de una celda, sin espacios sobrantes. Fechas como dd-mm-aaaa; horas de Excel (fracción del día) como HH:MM. */
export function textoCelda(v: ValorCelda): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.replace(/\s+/g, " ").trim();
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (v instanceof Date) {
    const z = (n: number) => String(n).padStart(2, "0");
    return `${z(v.getUTCDate())}-${z(v.getUTCMonth() + 1)}-${v.getUTCFullYear()}`;
  }
  return String(v);
}

function horaCelda(v: ValorCelda): string {
  const z = (n: number) => String(n).padStart(2, "0");
  if (typeof v === "number" && v >= 0 && v < 1) {
    const min = Math.round(v * 24 * 60);
    return `${z(Math.floor(min / 60))}:${z(min % 60)}`;
  }
  if (v instanceof Date) return `${z(v.getUTCHours())}:${z(v.getUTCMinutes())}`;
  const t = textoCelda(v);
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(t);
  return m ? `${z(Number(m[1]))}:${m[2]}` : t;
}

function leerSiNo(v: ValorCelda): boolean | null {
  if (typeof v === "boolean") return v;
  const k = claveNombre(textoCelda(v));
  if (k === "si") return true;
  if (k === "no") return false;
  return null;
}

function buscarHoja(hojas: HojaLeida[], nombre: string): HojaLeida | undefined {
  return hojas.find((h) => h.sheet === nombre) ?? hojas.find((h) => claveNombre(h.sheet) === claveNombre(nombre));
}

/** Revisa la fila de encabezados. Devuelve false si no coincide (y deja los errores anotados). */
function revisarEncabezados(hoja: HojaCatalogo, fila: ValorCelda[] | undefined, esperados: readonly string[], errores: Problema[]): boolean {
  if (!fila || fila.every((c) => textoCelda(c) === "")) {
    errores.push({ hoja, fila: 1, mensaje: `La fila 1 debe tener los encabezados: ${esperados.map((e) => `«${e}»`).join(", ")}.` });
    return false;
  }
  let ok = true;
  esperados.forEach((esperado, i) => {
    const real = textoCelda(fila[i]);
    if (real !== esperado) {
      ok = false;
      errores.push({
        hoja, fila: 1,
        mensaje: real
          ? `La columna ${letra(i)} debe llamarse «${esperado}», pero dice «${real}».`
          : `Falta la columna ${letra(i)} «${esperado}».`,
      });
    }
  });
  for (let i = esperados.length; i < fila.length; i++) {
    const real = textoCelda(fila[i]);
    if (real) {
      ok = false;
      errores.push({ hoja, fila: 1, mensaje: `Sobra la columna ${letra(i)} «${real}»: la plantilla solo tiene ${esperados.length} columnas.` });
    }
  }
  return ok;
}

interface FilaDatos {
  n: number; // número de fila en Excel
  celdas: ValorCelda[];
}

/** La fila es de ejemplo si su primera celda empieza con «(Ejemplo)» (sin importar mayúsculas). */
export function esFilaEjemplo(celdas: ValorCelda[]): boolean {
  return claveNombre(textoCelda(celdas[0])).startsWith(claveNombre(MARCA_EJEMPLO));
}

/**
 * Filas de datos (desde la 2). Se omiten las filas de ejemplo y las completamente vacías
 * (con un aviso si la vacía queda entre filas con datos).
 */
function filasDeDatos(hoja: HojaCatalogo, data: ValorCelda[][], columnas: number, avisos: Problema[]): FilaDatos[] {
  const filas: FilaDatos[] = [];
  const vacias: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const celdas = (data[i] ?? []).slice(0, columnas);
    if (celdas.every((c) => textoCelda(c) === "") || esFilaEjemplo(celdas)) {
      if (!esFilaEjemplo(celdas)) vacias.push(i + 1);
      continue;
    }
    filas.push({ n: i + 1, celdas });
  }
  const ultima = filas.length ? filas[filas.length - 1].n : 0;
  const intermedias = vacias.filter((n) => n < ultima);
  if (intermedias.length) {
    avisos.push({ hoja, mensaje: `${intermedias.length === 1 ? "La fila" : "Las filas"} ${intermedias.join(", ")} ${intermedias.length === 1 ? "está vacía y se omite" : "están vacías y se omiten"}.` });
  }
  return filas;
}

/** Marca nombres repetidos (sin distinguir mayúsculas ni tildes). */
function revisarRepetidos(hoja: HojaCatalogo, filas: { n: number; nombre: string }[], que: string, femenino: boolean, errores: Problema[]): Set<number> {
  const vistos = new Map<string, number>();
  const malas = new Set<number>();
  for (const f of filas) {
    if (!f.nombre) continue;
    const k = claveNombre(f.nombre);
    const previa = vistos.get(k);
    if (previa !== undefined) {
      errores.push({ hoja, fila: f.n, mensaje: `${que} «${f.nombre}» está ${femenino ? "repetida" : "repetido"}: ya aparece en la fila ${previa}.` });
      malas.add(f.n);
    } else {
      vistos.set(k, f.n);
    }
  }
  return malas;
}

interface Leido {
  contrato?: Omit<Contrato, "id">;
  areas: { n: number; nombre: string; orden: number; vigente: boolean }[];
  empresas: { n: number; nombre: string; tipo: TipoEmpresa }[];
  usuarios: { n: number; nombre: string; correo: string; rol: RolApp; activo: boolean }[];
}

function leerContrato(h: HojaLeida | undefined, errores: Problema[], avisos: Problema[]): Leido["contrato"] {
  const hoja = HOJAS.contrato;
  if (!h) { errores.push({ hoja: "Libro", mensaje: `Falta la hoja «${hoja}».` }); return; }
  if (!revisarEncabezados(hoja, h.data[0], ENCABEZADOS.contrato, errores)) return;
  const filas = filasDeDatos(hoja, h.data, ENCABEZADOS.contrato.length, avisos);
  if (filas.length === 0) { errores.push({ hoja, fila: 2, mensaje: "Falta la fila con los datos del contrato." }); return; }
  if (filas.length > 1) errores.push({ hoja, fila: filas[1].n, mensaje: "La hoja «Contrato» debe tener una sola fila de datos." });
  const { n, celdas } = filas[0];
  const t = (i: number) => textoCelda(celdas[i]);
  const obligatorio = (i: number) => {
    if (!t(i)) errores.push({ hoja, fila: n, mensaje: `Falta «${ENCABEZADOS.contrato[i]}».` });
    return t(i);
  };
  const numero = obligatorio(0), nombre = obligatorio(1), mandante = obligatorio(2), codigoProyecto = obligatorio(3);
  const revisionFormato = obligatorio(5), prefijoCorrelativo = obligatorio(7);
  const correlativoTexto = t(8);
  const ultimoCorrelativo = Number(correlativoTexto);
  if (!correlativoTexto || !Number.isInteger(ultimoCorrelativo) || ultimoCorrelativo < 0) {
    errores.push({ hoja, fila: n, mensaje: `«Último correlativo» debe ser un número entero (por ejemplo 1972)${correlativoTexto ? `, y dice «${correlativoTexto}»` : ""}.` });
  }
  const destinatarios = t(9).split(/[;,]/).map((d) => d.trim()).filter(Boolean);
  if (!destinatarios.length) errores.push({ hoja, fila: n, mensaje: "Falta al menos un destinatario en «Destinatarios (separados por ;)»." });
  for (const d of destinatarios) {
    if (!CORREO.test(d)) errores.push({ hoja, fila: n, mensaje: `El destinatario «${d}» no es un correo válido.` });
  }
  const hora = horaCelda(celdas[10]);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    errores.push({ hoja, fila: n, mensaje: `«Hora de cierre turno día» debe tener el formato HH:MM (por ejemplo 19:00)${hora ? `, y dice «${hora}»` : ""}.` });
  }
  return {
    numero, nombre, mandante, codigoProyecto, codigoInterno: t(4), revisionFormato, fechaFormato: t(6),
    prefijoCorrelativo, ultimoCorrelativo, destinatarios, horaCierreTurnoDia: hora,
  };
}

function leerAreas(h: HojaLeida | undefined, errores: Problema[], avisos: Problema[]): Leido["areas"] {
  const hoja = HOJAS.areas;
  if (!h) { errores.push({ hoja: "Libro", mensaje: `Falta la hoja «${hoja}».` }); return []; }
  if (!revisarEncabezados(hoja, h.data[0], ENCABEZADOS.areas, errores)) return [];
  const filas = filasDeDatos(hoja, h.data, ENCABEZADOS.areas.length, avisos);
  if (!filas.length) errores.push({ hoja, fila: 2, mensaje: "La hoja no tiene áreas." });
  const out: Leido["areas"] = [];
  for (const { n, celdas } of filas) {
    const nombre = textoCelda(celdas[0]);
    const ordenTexto = textoCelda(celdas[1]);
    const orden = Number(ordenTexto);
    const vigente = leerSiNo(celdas[2]);
    if (!nombre) errores.push({ hoja, fila: n, mensaje: "Falta el nombre del área." });
    if (!ordenTexto || !Number.isInteger(orden) || orden < 1) {
      errores.push({ hoja, fila: n, mensaje: `«Orden» debe ser un número entero mayor que 0${ordenTexto ? `, y dice «${ordenTexto}»` : ""}.` });
    }
    if (vigente === null) {
      const v = textoCelda(celdas[2]);
      errores.push({ hoja, fila: n, mensaje: v ? `«Vigente» debe ser Sí o No, y dice «${v}».` : "Falta «Vigente»: escriba Sí o No." });
    }
    out.push({ n, nombre, orden, vigente: vigente ?? true });
  }
  revisarRepetidos(hoja, out, "El área", true, errores);
  if (out.length && out.every((a) => !a.vigente)) avisos.push({ hoja, mensaje: "Ninguna área quedó vigente: los inspectores no tendrán áreas para elegir." });
  return out;
}

function leerEmpresas(h: HojaLeida | undefined, errores: Problema[], avisos: Problema[]): Leido["empresas"] {
  const hoja = HOJAS.empresas;
  if (!h) { errores.push({ hoja: "Libro", mensaje: `Falta la hoja «${hoja}».` }); return []; }
  if (!revisarEncabezados(hoja, h.data[0], ENCABEZADOS.empresas, errores)) return [];
  const filas = filasDeDatos(hoja, h.data, ENCABEZADOS.empresas.length, avisos);
  if (!filas.length) errores.push({ hoja, fila: 2, mensaje: "La hoja no tiene empresas." });
  const out: Leido["empresas"] = [];
  for (const { n, celdas } of filas) {
    const nombre = textoCelda(celdas[0]);
    const tipoTexto = textoCelda(celdas[1]);
    const tipo = TIPOS_EMPRESA.find((x) => claveNombre(x.etiqueta) === claveNombre(tipoTexto) || x.valor === claveNombre(tipoTexto))?.valor;
    if (!nombre) errores.push({ hoja, fila: n, mensaje: "Falta el nombre de la empresa." });
    if (!tipo) {
      errores.push({
        hoja, fila: n,
        mensaje: `${tipoTexto ? `El tipo «${tipoTexto}» no es válido` : "Falta el tipo"}: use ${TIPOS_EMPRESA.map((x) => x.etiqueta).join(", ")}.`,
      });
    }
    out.push({ n, nombre, tipo: tipo ?? "otro" });
  }
  revisarRepetidos(hoja, out, "La empresa", true, errores);
  return out;
}

function leerUsuarios(h: HojaLeida | undefined, errores: Problema[], avisos: Problema[]): Leido["usuarios"] {
  const hoja = HOJAS.usuarios;
  if (!h) { errores.push({ hoja: "Libro", mensaje: `Falta la hoja «${hoja}».` }); return []; }
  if (!revisarEncabezados(hoja, h.data[0], ENCABEZADOS.usuarios, errores)) return [];
  const filas = filasDeDatos(hoja, h.data, ENCABEZADOS.usuarios.length, avisos);
  if (!filas.length) errores.push({ hoja, fila: 2, mensaje: "La hoja no tiene usuarios." });
  const out: Leido["usuarios"] = [];
  const correos = new Map<string, number>();
  for (const { n, celdas } of filas) {
    const nombre = textoCelda(celdas[0]);
    const correo = textoCelda(celdas[1]).toLowerCase();
    const rolTexto = textoCelda(celdas[2]);
    const rol = ROLES.find((x) => claveNombre(x.etiqueta) === claveNombre(rolTexto) || x.valor === claveNombre(rolTexto))?.valor;
    const activo = leerSiNo(celdas[3]);
    if (!nombre) errores.push({ hoja, fila: n, mensaje: "Falta el nombre del usuario." });
    if (!correo) errores.push({ hoja, fila: n, mensaje: "Falta el correo." });
    else if (!CORREO.test(correo)) errores.push({ hoja, fila: n, mensaje: `El correo «${correo}» no es válido.` });
    else if (correos.has(correo)) errores.push({ hoja, fila: n, mensaje: `El correo «${correo}» está repetido: ya aparece en la fila ${correos.get(correo)}.` });
    else correos.set(correo, n);
    if (!rol) {
      errores.push({
        hoja, fila: n,
        mensaje: `${rolTexto ? `El rol «${rolTexto}» no es válido` : "Falta el rol"}: use ${ROLES.map((x) => x.etiqueta).join(", ")}.`,
      });
    }
    if (activo === null) {
      const v = textoCelda(celdas[3]);
      errores.push({ hoja, fila: n, mensaje: v ? `«Activo» debe ser Sí o No, y dice «${v}».` : "Falta «Activo»: escriba Sí o No." });
    }
    out.push({ n, nombre, correo, rol: rol ?? "inspector", activo: activo ?? true });
  }
  revisarRepetidos(hoja, out, "El usuario", false, errores);
  if (out.length && !out.some((u) => u.activo && u.rol === "admin")) {
    avisos.push({ hoja, mensaje: "No queda ningún Administrador activo: nadie podrá volver a cargar el catálogo desde la app." });
  }
  return out;
}

/**
 * Lee el libro (hojas tal como las entrega read-excel-file), lo valida y, si no hay errores,
 * arma el catálogo a publicar conservando los ids del catálogo actual por nombre.
 */
export function interpretarLibro(hojas: HojaLeida[], actual: CatalogoDatos): ResultadoLectura {
  const errores: Problema[] = [];
  const avisos: Problema[] = [];
  const leido: Leido = {
    contrato: leerContrato(buscarHoja(hojas, HOJAS.contrato), errores, avisos),
    areas: leerAreas(buscarHoja(hojas, HOJAS.areas), errores, avisos),
    empresas: leerEmpresas(buscarHoja(hojas, HOJAS.empresas), errores, avisos),
    usuarios: leerUsuarios(buscarHoja(hojas, HOJAS.usuarios), errores, avisos),
  };
  if (leido.contrato?.numero && leido.contrato.numero !== actual.contrato.numero) {
    errores.push({
      hoja: HOJAS.contrato, fila: 2,
      mensaje: `El Excel es del contrato ${leido.contrato.numero}, pero la app trabaja con el contrato ${actual.contrato.numero}. Descargue la plantilla de este contrato.`,
    });
  }
  const orden: string[] = ["Libro", HOJAS.contrato, HOJAS.areas, HOJAS.empresas, HOJAS.usuarios];
  errores.sort((a, b) => orden.indexOf(a.hoja) - orden.indexOf(b.hoja) || (a.fila ?? 0) - (b.fila ?? 0));
  if (errores.length || !leido.contrato) return { errores, avisos };
  const catalogo = armarCatalogo(leido as Required<Leido>, actual);
  return { errores, avisos, catalogo, cambios: calcularCambios(actual, catalogo) };
}

/** Une lo leído con el catálogo actual: conserva ids por nombre y no borra nada. */
function armarCatalogo(leido: Required<Leido>, actual: CatalogoDatos): CatalogoPublicable {
  const cid = actual.contrato.id;
  const porNombre = <T extends { nombre: string }>(l: T[]) => new Map(l.map((x) => [claveNombre(x.nombre), x]));

  const contrato: Contrato = { id: cid, ...leido.contrato };

  const areasActuales = porNombre(actual.areas);
  const vistasA = new Set<string>();
  const areas: Area[] = leido.areas.map((a) => {
    const previa = areasActuales.get(claveNombre(a.nombre));
    const id = previa?.id ?? idArea(cid, a.nombre);
    vistasA.add(id);
    return { id, contratoId: cid, nombre: a.nombre, orden: a.orden, vigente: a.vigente };
  });
  // Las áreas que no vienen en el Excel no se borran (hay reportes que las usan): quedan no vigentes.
  for (const a of actual.areas) if (!vistasA.has(a.id)) areas.push({ ...a, vigente: false });

  const empresasActuales = porNombre(actual.empresas);
  const empresas: Empresa[] = leido.empresas.map((e) => {
    const previa = empresasActuales.get(claveNombre(e.nombre));
    return { id: previa?.id ?? idEmpresa(cid, e.nombre), contratoId: cid, nombre: e.nombre, tipo: e.tipo };
  });

  const usuariosActuales = porNombre(actual.usuarios);
  const vistosU = new Set<string>();
  const usuarios: Usuario[] = leido.usuarios.map((u) => {
    const previo = usuariosActuales.get(claveNombre(u.nombre));
    const id = previo?.id ?? idUsuario(cid, u.nombre);
    vistosU.add(id);
    return { id, nombre: u.nombre, correo: u.correo, rol: u.rol, contratoId: cid, activo: u.activo };
  });
  // Los usuarios que no vienen en el Excel quedan inactivos (firmaron reportes: no se borran).
  for (const u of actual.usuarios) if (!vistosU.has(u.id)) usuarios.push({ ...u, contratoId: cid, activo: false });

  return { contrato, areas, empresas, usuarios, empresasVigentes: empresas.map((e) => e.id) };
}

const CAMPOS_CONTRATO: [keyof Contrato, string][] = [
  ["nombre", "nombre del servicio"], ["mandante", "mandante"], ["codigoProyecto", "código de proyecto"],
  ["codigoInterno", "código interno"], ["revisionFormato", "revisión de formato"], ["fechaFormato", "fecha de formato"],
  ["prefijoCorrelativo", "prefijo de correlativo"], ["ultimoCorrelativo", "último correlativo"],
  ["destinatarios", "destinatarios"], ["horaCierreTurnoDia", "hora de cierre"],
];

/** Resumen de lo que cambia al publicar `nuevo` sobre `actual`. */
export function calcularCambios(actual: CatalogoDatos, nuevo: CatalogoPublicable): ResumenCambios {
  const contrato = CAMPOS_CONTRATO
    .filter(([k]) => JSON.stringify(actual.contrato[k] ?? "") !== JSON.stringify(nuevo.contrato[k] ?? ""))
    .map(([, etiqueta]) => etiqueta);

  const aPrev = new Map(actual.areas.map((a) => [a.id, a]));
  const areas: ResumenCambios["areas"] = {
    nuevas: [], dejanDeEstarVigentes: [], vuelvenAEstarVigentes: [], cambianOrden: [],
    total: nuevo.areas.length, vigentes: nuevo.areas.filter((a) => a.vigente).length,
  };
  for (const a of nuevo.areas) {
    const p = aPrev.get(a.id);
    if (!p) { areas.nuevas.push(a.nombre); continue; }
    if (p.vigente && !a.vigente) areas.dejanDeEstarVigentes.push(a.nombre);
    else if (!p.vigente && a.vigente) areas.vuelvenAEstarVigentes.push(a.nombre);
    if (a.vigente && p.orden !== a.orden) areas.cambianOrden.push(a.nombre);
  }

  const ePrev = new Map(actual.empresas.map((e) => [e.id, e]));
  const vigentes = new Set(nuevo.empresasVigentes);
  const empresas: ResumenCambios["empresas"] = { nuevas: [], cambianTipo: [], seMantienen: [], total: nuevo.empresas.length };
  for (const e of nuevo.empresas) {
    const p = ePrev.get(e.id);
    if (!p) empresas.nuevas.push(e.nombre);
    else if (p.tipo !== e.tipo) empresas.cambianTipo.push(e.nombre);
  }
  for (const e of actual.empresas) if (!vigentes.has(e.id)) empresas.seMantienen.push(e.nombre);

  const uPrev = new Map(actual.usuarios.map((u) => [u.id, u]));
  const usuarios: ResumenCambios["usuarios"] = {
    nuevos: [], desactivados: [], reactivados: [], cambianRol: [], cambianCorreo: [],
    total: nuevo.usuarios.length, activos: nuevo.usuarios.filter((u) => u.activo !== false).length,
  };
  for (const u of nuevo.usuarios) {
    const p = uPrev.get(u.id);
    if (!p) { usuarios.nuevos.push(u.nombre); continue; }
    const antes = p.activo !== false, ahora = u.activo !== false;
    if (antes && !ahora) usuarios.desactivados.push(u.nombre);
    else if (!antes && ahora) usuarios.reactivados.push(u.nombre);
    if (p.rol !== u.rol) usuarios.cambianRol.push(`${u.nombre} (${etiquetaRol(p.rol)} → ${etiquetaRol(u.rol)})`);
    if (p.correo.toLowerCase() !== u.correo.toLowerCase()) usuarios.cambianCorreo.push(u.nombre);
  }

  const hayCambios = contrato.length > 0
    || [areas.nuevas, areas.dejanDeEstarVigentes, areas.vuelvenAEstarVigentes, areas.cambianOrden].some((l) => l.length > 0)
    || [empresas.nuevas, empresas.cambianTipo, empresas.seMantienen].some((l) => l.length > 0)
    || [usuarios.nuevos, usuarios.desactivados, usuarios.reactivados, usuarios.cambianRol, usuarios.cambianCorreo].some((l) => l.length > 0);

  return { contrato, areas, empresas, usuarios, hayCambios };
}

/** Frases cortas del resumen para la vista previa y la nota de la versión publicada. */
export function frasesCambios(c: ResumenCambios): string[] {
  const n = (k: number, uno: string, varios: string) => `${k} ${k === 1 ? uno : varios}`;
  const f: string[] = [];
  if (c.contrato.length) f.push(`Contrato: cambia ${c.contrato.join(", ")}`);
  if (c.areas.nuevas.length) f.push(n(c.areas.nuevas.length, "área nueva", "áreas nuevas"));
  if (c.areas.dejanDeEstarVigentes.length) f.push(n(c.areas.dejanDeEstarVigentes.length, "área deja de estar vigente", "áreas dejan de estar vigentes"));
  if (c.areas.vuelvenAEstarVigentes.length) f.push(n(c.areas.vuelvenAEstarVigentes.length, "área vuelve a estar vigente", "áreas vuelven a estar vigentes"));
  if (c.areas.cambianOrden.length) f.push(n(c.areas.cambianOrden.length, "área cambia de orden", "áreas cambian de orden"));
  if (c.empresas.nuevas.length) f.push(n(c.empresas.nuevas.length, "empresa nueva", "empresas nuevas"));
  if (c.empresas.cambianTipo.length) f.push(n(c.empresas.cambianTipo.length, "empresa cambia de tipo", "empresas cambian de tipo"));
  if (c.empresas.seMantienen.length) f.push(n(c.empresas.seMantienen.length, "empresa no viene en el Excel: se mantiene en los reportes, pero no se ofrece", "empresas no vienen en el Excel: se mantienen en los reportes, pero no se ofrecen"));
  if (c.usuarios.nuevos.length) f.push(n(c.usuarios.nuevos.length, "usuario nuevo", "usuarios nuevos"));
  if (c.usuarios.desactivados.length) f.push(n(c.usuarios.desactivados.length, "usuario queda inactivo", "usuarios quedan inactivos"));
  if (c.usuarios.reactivados.length) f.push(n(c.usuarios.reactivados.length, "usuario vuelve a estar activo", "usuarios vuelven a estar activos"));
  if (c.usuarios.cambianRol.length) f.push(n(c.usuarios.cambianRol.length, "usuario cambia de rol", "usuarios cambian de rol"));
  if (c.usuarios.cambianCorreo.length) f.push(n(c.usuarios.cambianCorreo.length, "usuario cambia de correo", "usuarios cambian de correo"));
  return f;
}

// Genera la plantilla del catálogo y los Excel de prueba con el mismo código que usa la app.
// Uso (desde bitacora-ito/, Node 24 ejecuta TypeScript sin compilar):
//   node scripts/catalogo/generar.mts
// Escribe:
//   public/plantillas/catalogo-bitacora-ito.xlsx            plantilla llena con el catálogo base
//   public/plantillas/catalogo-bitacora-ito-en-blanco.xlsx  plantilla en blanco «solo llenar»
//   ../para-marcela/plantillas/                              copia de las dos para Marcela
//   scripts/catalogo/catalogo-en-blanco-llenado.xlsx         la en blanco llenada (con su fila de ejemplo)
//   scripts/catalogo/catalogo-con-errores.xlsx        errores a propósito en las 4 hojas
//   scripts/catalogo/catalogo-con-cambios.xlsx        válido, con altas, bajas y cambios
import { mkdir } from "node:fs/promises";
import path from "node:path";
import writeXlsxFile from "write-excel-file/node";
import {
  catalogoBase, construirHojas, construirPlantillaEnBlanco, etiquetaRol, etiquetaTipo, NOMBRE_PLANTILLA, NOMBRE_PLANTILLA_EN_BLANCO,
  type CeldaExcel, type HojaExcel,
} from "../../src/lib/catalogo-excel.ts";

const raiz = process.cwd();
const t = (value: string): CeldaExcel => ({ value, type: String });

async function escribir(hojas: HojaExcel[], destino: string) {
  await mkdir(path.dirname(destino), { recursive: true });
  // write-excel-file recibe las hojas con sus opciones (sheet, columns, stickyRowsCount).
  await writeXlsxFile(hojas as never, { fontFamily: "Calibri", fontSize: 11 } as never).toFile(destino);
  console.log("✓", path.relative(raiz, destino));
}

const hoja = (hojas: HojaExcel[], nombre: string) => hojas.find((h) => h.sheet === nombre)!;

// 1. Plantilla con el catálogo actual (las 14 áreas reales, 4 empresas y 5 usuarios de la semilla).
const plantilla = construirHojas(catalogoBase());
await escribir(plantilla, path.join(raiz, "public", "plantillas", NOMBRE_PLANTILLA));
await escribir(plantilla, path.join(raiz, "..", "para-marcela", "plantillas", NOMBRE_PLANTILLA));

// 1b. Plantilla en blanco, y la misma llenada con el catálogo base (se deja la fila de ejemplo).
const blanco = construirPlantillaEnBlanco();
await escribir(blanco, path.join(raiz, "public", "plantillas", NOMBRE_PLANTILLA_EN_BLANCO));
await escribir(blanco, path.join(raiz, "..", "para-marcela", "plantillas", NOMBRE_PLANTILLA_EN_BLANCO));
const llenada = construirPlantillaEnBlanco();
{
  const b = catalogoBase();
  const c = b.contrato;
  const n = (value: number): CeldaExcel => ({ value, type: Number });
  hoja(llenada, "Contrato").data.push([t(c.numero), t(c.nombre), t(c.mandante), t(c.codigoProyecto), t(c.codigoInterno), t(c.revisionFormato),
    t(c.fechaFormato), t(c.prefijoCorrelativo), n(c.ultimoCorrelativo), t(c.destinatarios.join("; ")), t(c.horaCierreTurnoDia)]);
  // Valores escritos «a mano»: SI/no sin tilde, tipos y roles en minúsculas y sin tilde.
  b.areas.forEach((a, i) => hoja(llenada, "Áreas").data.push([t(a.nombre), n(a.orden), t(i % 2 ? "SI" : "si")]));
  b.empresas.forEach((e) => hoja(llenada, "Empresas").data.push([t(e.nombre), t(etiquetaTipo(e.tipo).toLowerCase())]));
  b.usuarios.forEach((u) => hoja(llenada, "Usuarios").data.push([t(u.nombre), t(u.correo), t(etiquetaRol(u.rol).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")), t("SI")]));
}
await escribir(llenada, path.join(raiz, "scripts", "catalogo", "catalogo-en-blanco-llenado.xlsx"));

// 2. Versión con errores a propósito.
const errores = construirHojas(catalogoBase());
{
  const c = hoja(errores, "Contrato").data[1];
  c[8] = t("mil novecientos");            // correlativo no numérico
  c[9] = t("inspeccion@mandante.cl; correo-malo"); // destinatario inválido
  c[10] = t("7 pm");                      // hora sin formato HH:MM
  const a = hoja(errores, "Áreas").data;
  a[3] = [t("tramo a"), { value: 3, type: Number }, t("Sí")]; // repetida (sin distinguir mayúsculas)
  a[5][2] = t("Quizás");                  // vigente distinto de Sí/No
  a[6][1] = t("uno");                     // orden no numérico
  a.splice(8, 0, [null, null, null]);     // fila vacía en medio
  a.push([null, { value: 20, type: Number }, t("Sí")]); // falta el nombre
  const e = hoja(errores, "Empresas").data;
  e[2][1] = t("Subcontrato");             // tipo inválido
  e.push([t("IDIEM"), t("Laboratorio")]);  // repetida
  const u = hoja(errores, "Usuarios").data;
  u[2][1] = t("acastillo@");              // correo inválido
  u[3][2] = t("Supervisor");              // rol inválido
  u[4][3] = t("Tal vez");                 // activo distinto de Sí/No
  u.push([t("Jorge Orellana S."), t("otro@ejemplo.cl"), t("Inspector"), t("Sí")]); // nombre repetido
}
await escribir(errores, path.join(raiz, "scripts", "catalogo", "catalogo-con-errores.xlsx"));

// 3. Versión válida con cambios: 1 área nueva, 1 que sale del Excel, 1 no vigente, empresa nueva,
//    empresa ausente, usuario nuevo, usuario ausente y un cambio de rol.
const cambios = construirHojas(catalogoBase());
{
  const a = hoja(cambios, "Áreas").data;
  const mentidero = a.findIndex((f) => f[0]?.value === "Mentidero");
  a[mentidero][2] = t("No");
  const bodega = a.findIndex((f) => f[0]?.value === "La Bodega");
  a.splice(bodega, 1);
  a.push([t("Muro de contención Pk 2+100"), { value: 15, type: Number }, t("Sí")]);
  const e = hoja(cambios, "Empresas").data;
  e.splice(e.findIndex((f) => f[0]?.value === "OOCC"), 1);
  e.push([t("GEOSUR"), t("Topografía")]);
  const u = hoja(cambios, "Usuarios").data;
  u.splice(u.findIndex((f) => f[0]?.value === "Arnoldi Díaz"), 1);
  u.push([t("Camila Fuentes"), t("cfuentes@ejemplo.cl"), t("Inspector"), t("Sí")]);
  const castillo = u.findIndex((f) => f[0]?.value === "Alberto Castillo");
  u[castillo][2] = t("Jefe de turno");
}
await escribir(cambios, path.join(raiz, "scripts", "catalogo", "catalogo-con-cambios.xlsx"));

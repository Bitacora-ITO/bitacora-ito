// Prueba la lectura, la validación y el cálculo de cambios del catálogo con archivos locales
// (sin Supabase). Uso, desde bitacora-ito/ y después de `node scripts/catalogo/generar.mts`:
//   node scripts/catalogo/probar.mts
// Sale con código 1 si alguna comprobación falla.
import path from "node:path";
import readXlsxFile from "read-excel-file/node";
import {
  AREAS_CONTRATO, catalogoBase, CONTRATO_BASE_ID, frasesCambios, idArea, interpretarLibro,
  type HojaLeida, type ResultadoLectura,
} from "../../src/lib/catalogo-excel.ts";

const raiz = process.cwd();
const actual = catalogoBase();
let fallas = 0;

function comprobar(cond: boolean, texto: string) {
  console.log(`${cond ? "  ✓" : "  ✗"} ${texto}`);
  if (!cond) fallas++;
}

async function leer(rel: string): Promise<HojaLeida[]> {
  return (await readXlsxFile(path.join(raiz, rel))) as unknown as HojaLeida[];
}

function mostrar(r: ResultadoLectura) {
  for (const e of r.errores) console.log(`    error · ${e.hoja}${e.fila ? ` · fila ${e.fila}` : ""}: ${e.mensaje}`);
  for (const a of r.avisos) console.log(`    aviso · ${a.hoja}${a.fila ? ` · fila ${a.fila}` : ""}: ${a.mensaje}`);
  if (r.cambios) for (const f of frasesCambios(r.cambios)) console.log(`    cambio · ${f}`);
}

const tiene = (r: ResultadoLectura, hoja: string, fila: number | undefined, parte: string) =>
  r.errores.some((e) => e.hoja === hoja && (fila === undefined || e.fila === fila) && e.mensaje.includes(parte));

// 1. La plantilla generada vuelve a leerse sin errores ni cambios.
console.log("\n1. Plantilla (public/plantillas/catalogo-bitacora-ito.xlsx)");
const p = interpretarLibro(await leer("public/plantillas/catalogo-bitacora-ito.xlsx"), actual);
mostrar(p);
comprobar(p.errores.length === 0, "sin errores");
comprobar(p.catalogo?.areas.length === 14, "14 áreas");
comprobar(p.catalogo?.areas.every((a, i) => a.nombre === AREAS_CONTRATO[i] && a.id === actual.areas[i].id) === true, "áreas con los nombres del Excel real y los mismos ids");
comprobar(p.catalogo?.empresas.length === 4 && p.catalogo.usuarios.length === 5, "4 empresas y 5 usuarios");
comprobar(p.cambios?.hayCambios === false, "sin cambios frente al catálogo actual");

// 2. La versión con errores a propósito.
console.log("\n2. Con errores (scripts/catalogo/catalogo-con-errores.xlsx)");
const e = interpretarLibro(await leer("scripts/catalogo/catalogo-con-errores.xlsx"), actual);
mostrar(e);
comprobar(!e.catalogo, "no se puede publicar");
comprobar(tiene(e, "Contrato", 2, "Último correlativo"), "Contrato: correlativo no numérico");
comprobar(tiene(e, "Contrato", 2, "correo-malo"), "Contrato: destinatario inválido");
comprobar(tiene(e, "Contrato", 2, "HH:MM"), "Contrato: hora de cierre inválida");
comprobar(tiene(e, "Áreas", undefined, "repetid"), "Áreas: nombre repetido");
comprobar(tiene(e, "Áreas", undefined, "«Vigente» debe ser Sí o No"), "Áreas: vigente distinto de Sí/No");
comprobar(tiene(e, "Áreas", undefined, "«Orden»"), "Áreas: orden no numérico");
comprobar(tiene(e, "Áreas", undefined, "Falta el nombre"), "Áreas: fila sin nombre");
comprobar(e.avisos.some((a) => a.hoja === "Áreas" && a.mensaje.includes("vacía")), "Áreas: aviso de fila vacía");
comprobar(tiene(e, "Empresas", undefined, "Subcontrato"), "Empresas: tipo inválido");
comprobar(tiene(e, "Empresas", undefined, "repetid"), "Empresas: nombre repetido");
comprobar(tiene(e, "Usuarios", undefined, "acastillo@"), "Usuarios: correo inválido");
comprobar(tiene(e, "Usuarios", undefined, "Supervisor"), "Usuarios: rol inválido");
comprobar(tiene(e, "Usuarios", undefined, "«Activo» debe ser Sí o No"), "Usuarios: activo distinto de Sí/No");
comprobar(tiene(e, "Usuarios", undefined, "repetid"), "Usuarios: nombre repetido");

// 3. Encabezados y hojas (en memoria, a partir de la plantilla).
console.log("\n3. Encabezados y hojas");
const base = await leer("public/plantillas/catalogo-bitacora-ito.xlsx");
const copia = (): HojaLeida[] => base.map((h) => ({ sheet: h.sheet, data: h.data.map((f) => [...f]) }));
const h1 = copia();
h1.find((h) => h.sheet === "Usuarios")!.data[0][1] = "E-mail";
h1.find((h) => h.sheet === "Empresas")!.data[0][2] = "RUT";
const r1 = interpretarLibro(h1, actual);
mostrar(r1);
comprobar(tiene(r1, "Usuarios", 1, "«Correo», pero dice «E-mail»"), "encabezado cambiado");
comprobar(tiene(r1, "Empresas", 1, "Sobra la columna C"), "columna de más");
const h2 = copia().filter((h) => h.sheet !== "Áreas");
const r2 = interpretarLibro(h2, actual);
mostrar(r2);
comprobar(r2.errores.some((x) => x.hoja === "Libro" && x.mensaje.includes("«Áreas»")), "falta una hoja");
const h3 = copia();
h3.find((h) => h.sheet === "Contrato")!.data[1][0] = "4600099999";
const r3 = interpretarLibro(h3, actual);
mostrar(r3);
comprobar(tiene(r3, "Contrato", 2, "otro contrato") || tiene(r3, "Contrato", 2, "contrato 4600099999"), "contrato distinto");

// 4. La versión válida con cambios.
console.log("\n4. Con cambios (scripts/catalogo/catalogo-con-cambios.xlsx)");
const c = interpretarLibro(await leer("scripts/catalogo/catalogo-con-cambios.xlsx"), actual);
mostrar(c);
const cc = c.cambios!;
comprobar(c.errores.length === 0 && !!c.catalogo, "se puede publicar");
comprobar(cc.areas.nuevas.join() === "Muro de contención Pk 2+100", "1 área nueva");
comprobar(cc.areas.dejanDeEstarVigentes.sort().join() === "La Bodega,Mentidero", "2 áreas dejan de estar vigentes (una marcada No y otra ausente)");
comprobar(c.catalogo!.areas.find((a) => a.nombre === "La Bodega")?.id === idArea(CONTRATO_BASE_ID, "La Bodega"), "el área ausente conserva su id y no se borra");
comprobar(c.catalogo!.areas.find((a) => a.nombre === "Peralte Muro Sotelo")?.id === actual.areas[3].id, "un área existente conserva su id");
comprobar(cc.empresas.nuevas.join() === "GEOSUR" && cc.empresas.seMantienen.join() === "OOCC", "empresa nueva y empresa que se mantiene");
comprobar(!c.catalogo!.empresasVigentes.includes(actual.empresas[3].id), "OOCC fuera de la lista vigente");
comprobar(cc.usuarios.nuevos.join() === "Camila Fuentes" && cc.usuarios.desactivados.join() === "Arnoldi Díaz", "usuario nuevo y usuario inactivo");
comprobar(cc.usuarios.cambianRol.length === 1 && cc.usuarios.cambianRol[0].startsWith("Alberto Castillo"), "cambio de rol");

// 5. Plantilla en blanco: sin llenar no se publica; llenada (con su fila de ejemplo y valores escritos a mano) sí.
console.log("\n5. Plantilla en blanco (public/plantillas/catalogo-bitacora-ito-en-blanco.xlsx)");
const blanco = await leer("public/plantillas/catalogo-bitacora-ito-en-blanco.xlsx");
comprobar(blanco[0].sheet === "Instrucciones" && blanco.slice(1).map((h) => h.sheet).join() === "Contrato,Áreas,Empresas,Usuarios", "Instrucciones al inicio y las 4 hojas");
const b0 = interpretarLibro(blanco, actual);
mostrar(b0);
comprobar(!b0.catalogo && tiene(b0, "Contrato", 2, "Falta la fila con los datos del contrato") && tiene(b0, "Áreas", 2, "no tiene áreas"), "sin llenar: la fila de ejemplo no cuenta como dato");
console.log("\n   …llenada (scripts/catalogo/catalogo-en-blanco-llenado.xlsx: «SI»/«si», tipos y roles en minúsculas y sin tilde)");
const b1 = interpretarLibro(await leer("scripts/catalogo/catalogo-en-blanco-llenado.xlsx"), actual);
mostrar(b1);
comprobar(b1.errores.length === 0 && b1.cambios?.hayCambios === false, "llenada: sin errores y sin cambios frente al catálogo base");
comprobar(b1.catalogo?.usuarios.find((u) => u.nombre === "Paula Rojas")?.rol === "jefatura", "«jefe de turno» se reconoce como Jefe de turno");

// 6. Hojas extra (Instrucciones, Listas) se ignoran; «Topografia», «NO» y «ADMINISTRADOR» se aceptan.
console.log("\n6. Hojas extra y valores sin tilde");
const h6 = [{ sheet: "Listas", data: [["Contratista"], ["Topografía"]] }, ...copia()];
h6.find((h) => h.sheet === "Empresas")!.data.push(["GEOSUR", "Topografia"]);
h6.find((h) => h.sheet === "Áreas")!.data[2][2] = "NO";
h6.find((h) => h.sheet === "Usuarios")!.data[5][2] = "ADMINISTRADOR";
const r6 = interpretarLibro(h6, actual);
mostrar(r6);
comprobar(r6.errores.length === 0, "sin errores");
comprobar(r6.catalogo?.empresas.find((e) => e.nombre === "GEOSUR")?.tipo === "topografia", "«Topografia» sin tilde");
comprobar(r6.cambios?.areas.dejanDeEstarVigentes.length === 1, "«NO» en mayúsculas");

console.log(fallas ? `\n${fallas} comprobaciones fallaron.` : "\nTodas las comprobaciones pasaron.");
process.exit(fallas ? 1 : 0);

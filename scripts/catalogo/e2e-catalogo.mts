// Prueba de punta a punta del catálogo con Puppeteer (no está en package.json: usa el de la caché de npx y Chrome).
// Requiere: servidor sin Supabase en :3300 →  NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p 3300
// y luego:  node --no-warnings scripts/catalogo/e2e-catalogo.mts   (deja capturas en para-marcela/capturas/v3).
// Las rutas de Puppeteer, Chrome y la carpeta de descargas son de la máquina de Juan: ajústelas si cambia.
import { createRequire } from "node:module";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
const REPO = "D:/13.-AI/models/hermes.workfolders/10_projects/maag/MAAG/bitacora-ito";
const { catalogoBase } = await import(`file:///${REPO}/src/lib/catalogo-excel.ts`);
const require = createRequire("C:/Users/juanf/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/");
const puppeteer = require("puppeteer");
const readXlsx = createRequire(`${REPO}/node_modules/`)("read-excel-file/node");

const URL = "http://localhost:3300";
const CAPTURAS = "D:/13.-AI/models/hermes.workfolders/10_projects/maag/MAAG/para-marcela/capturas/v3";
const DESCARGAS = "C:/Users/juanf/AppData/Local/Temp/claude/d--13--AI-models-hermes-workfolders-10-projects-maag-MAAG/7243eefe-43f2-4b61-b749-00296bec3ccf/scratchpad/descargas";
await mkdir(CAPTURAS, { recursive: true });
await rm(DESCARGAS, { recursive: true, force: true });
await mkdir(DESCARGAS, { recursive: true });

let fallas = 0;
const ok = (c: boolean, t: string) => { console.log(`${c ? "✓" : "✗"} ${t}`); if (!c) fallas++; };

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });

async function nuevaPagina(alto = 844) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: alto, deviceScaleFactor: 2 });
  page.on("pageerror", (e: Error) => console.log("  [pageerror]", e.message));
  return { ctx, page };
}
const esperarTexto = (page: any, t: string, timeout = 90_000) =>
  page.waitForFunction((x: string) => document.body.innerText.includes(x), { timeout }, t);
const clic = async (page: any, texto: string, sel = "button") => {
  const el = await page.waitForSelector(`${sel}::-p-text(${texto})`, { timeout: 30_000 });
  await el.click();
};
const captura = async (page: any, nombre: string) => {
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(CAPTURAS, nombre) });
  console.log("  📷", nombre);
};

// IndexedDB en bruto (para leer el estado y simular otro teléfono).
const leerTodo = (page: any, store: string) => page.evaluate((store: string) => new Promise((res, rej) => {
  const r = indexedDB.open("bitacora-ito");
  r.onsuccess = () => {
    const db = r.result;
    const q = db.transaction(store).objectStore(store).getAll();
    q.onsuccess = () => { res(q.result.map((x: any) => { const o = { ...x }; for (const k in o) if (o[k] instanceof Blob) o[k] = "blob"; return o; })); db.close(); };
    q.onerror = () => rej(q.error);
  };
  r.onerror = () => rej(r.error);
}), store);
const ajuste = async (page: any, clave: string) => ((await leerTodo(page, "ajustes")) as any[]).find((a) => a.clave === clave)?.valor;
const ponerAjuste = (page: any, clave: string, valor: string) => page.evaluate((clave: string, valor: string) => new Promise((res, rej) => {
  const r = indexedDB.open("bitacora-ito");
  r.onsuccess = () => { const db = r.result; const tx = db.transaction("ajustes", "readwrite"); tx.objectStore("ajustes").put({ clave, valor }); tx.oncomplete = () => { db.close(); res(true); }; tx.onerror = () => rej(tx.error); };
}), clave, valor);

const base = catalogoBase();

// ───────── Teléfono 1: administrador ─────────
console.log("\nTeléfono 1 · administrador");
const t1 = await nuevaPagina();
await t1.page.goto(URL + "/", { waitUntil: "domcontentloaded" });
await esperarTexto(t1.page, "¿Quién usa este teléfono?");
await esperarTexto(t1.page, "Administrador Bitácora");
await captura(t1.page, "01-quien-usa-este-telefono.png");
const usuarios = await leerTodo(t1.page, "usuarios") as any[];
ok(usuarios.length === 5 && usuarios.every((u) => base.usuarios.some((b: any) => b.id === u.id)), "semilla con 5 usuarios y sus ids estables");
const areas0 = await leerTodo(t1.page, "areas") as any[];
ok(areas0.length === 14 && areas0.every((a) => /^[0-9a-f-]{36}$/.test(a.id)), "14 áreas con UUID");
ok((await leerTodo(t1.page, "rolesTurno") as any[]).length === 4, "rol 7x7 para los 4 usuarios de terreno");

await clic(t1.page, "Administrador Bitácora");
await esperarTexto(t1.page, "Áreas del turno");
ok((await ajuste(t1.page, "rolActual")) === "admin", "sesión fijada con rol admin");
await t1.page.click('button[aria-label="Ajustes de la demostración"]');
await esperarTexto(t1.page, "Administrar catálogo");
await captura(t1.page, "02-ajustes-identidad-y-admin.png");
await clic(t1.page, "Administrar catálogo", "a");
await esperarTexto(t1.page, "En blanco, para llenar");
await esperarTexto(t1.page, "Sin publicar");
await captura(t1.page, "03-admin-inicio.png");

// Descargar plantilla.
// Chrome sin interfaz no guarda la descarga: se captura el Blob que la app entrega al enlace <a download>.
await t1.page.evaluate(() => {
  const w = window as any;
  w.__blobs = new Map(); w.__bajadas = {};
  const crear = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b: Blob) => { const u = crear(b); w.__blobs.set(u, b); return u; };
  HTMLAnchorElement.prototype.click = function () {
    const b = w.__blobs.get(this.href);
    if (b && this.download) b.arrayBuffer().then((ab: ArrayBuffer) => { w.__bajadas[this.download] = Array.from(new Uint8Array(ab)); });
  };
});
const esperarArchivo = async (nombre: string) => {
  for (let i = 0; i < 60; i++) {
    const bytes = await t1.page.evaluate((n: string) => (window as any).__bajadas[n] ?? null, nombre);
    if (bytes) { await writeFile(path.join(DESCARGAS, nombre), Buffer.from(bytes)); return true; }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
};
await clic(t1.page, "Con el catálogo actual");
await esperarTexto(t1.page, "Plantilla guardada");
ok(await esperarArchivo("catalogo-bitacora-ito.xlsx"), "plantilla con el catálogo actual descargada");
{
  const hojas = await readXlsx.default(path.join(DESCARGAS, "catalogo-bitacora-ito.xlsx"));
  ok(hojas.map((h: any) => h.sheet).join() === "Contrato,Áreas,Empresas,Usuarios,Instrucciones", "hojas de la plantilla");
  ok(hojas[1].data.length === 15 && hojas[1].data[13][0] === "Traucalén", "14 áreas del Excel real en la plantilla");
}
await clic(t1.page, "En blanco, para llenar");
ok(await esperarArchivo("catalogo-bitacora-ito-en-blanco.xlsx"), "plantilla en blanco descargada");
{
  const hojas = await readXlsx.default(path.join(DESCARGAS, "catalogo-bitacora-ito-en-blanco.xlsx"));
  ok(hojas.map((h: any) => h.sheet).join() === "Instrucciones,Contrato,Áreas,Empresas,Usuarios" && String(hojas[2].data[1][0]).startsWith("(Ejemplo)"), "plantilla en blanco con instrucciones y fila de ejemplo");
}

// Cargar el Excel con errores.
await t1.page.setViewport({ width: 390, height: 2000, deviceScaleFactor: 2 });
const input = await t1.page.$("#excel-catalogo");
await input.uploadFile(`${REPO}/scripts/catalogo/catalogo-con-errores.xlsx`);
await esperarTexto(t1.page, "errores en el Excel");
const textoErrores = await t1.page.evaluate(() => document.body.innerText);
ok(textoErrores.includes("Hoja «Usuarios»") && textoErrores.includes("Fila 4") && textoErrores.includes("Supervisor"), "errores por hoja y fila en pantalla");
ok(!(await t1.page.$("button::-p-text(Publicar catálogo)")), "sin botón Publicar cuando hay errores");
await captura(t1.page, "04-admin-excel-con-errores.png");

// Cargar el Excel con cambios.
await input.uploadFile(`${REPO}/scripts/catalogo/catalogo-con-cambios.xlsx`);
await esperarTexto(t1.page, "Sin errores");
await esperarTexto(t1.page, "Muro de contención Pk 2+100");
await t1.page.setViewport({ width: 390, height: 1500, deviceScaleFactor: 2 });
await captura(t1.page, "05-admin-vista-previa-cambios.png");
await clic(t1.page, "Publicar catálogo");
await esperarTexto(t1.page, "Catálogo publicado · versión 1");
await esperarTexto(t1.page, "Versión 1");
await t1.page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await captura(t1.page, "06-admin-publicado.png");
const simulado = await ajuste(t1.page, "catalogo.simulado");
ok(!!simulado && JSON.parse(simulado).version.version === 1, "publicación simulada versión 1 (sin Supabase)");
ok((await ajuste(t1.page, "catalogo.versionLocal")) === "1", "el teléfono del administrador queda en la versión 1");

// ───────── Teléfono 2: inspector con el catálogo de ejemplo ─────────
console.log("\nTeléfono 2 · inspector");
const t2 = await nuevaPagina();
await t2.page.goto(URL + "/", { waitUntil: "domcontentloaded" });
await esperarTexto(t2.page, "Jorge Orellana S.");
await clic(t2.page, "Jorge Orellana S.");
await esperarTexto(t2.page, "Áreas del turno");
ok(!(await t2.page.evaluate(() => document.body.innerText.includes("Hay un catálogo nuevo"))), "sin aviso mientras no hay publicación");
// «Publica» en la fuente simulada de este teléfono lo mismo que publicó el administrador (en Supabase sería la misma tabla).
await ponerAjuste(t2.page, "catalogo.simulado", simulado);
await t2.page.reload({ waitUntil: "domcontentloaded" });
await esperarTexto(t2.page, "Hay un catálogo nuevo");
await captura(t2.page, "07-turno-aviso-catalogo-nuevo.png");
const areasAntes = await leerTodo(t2.page, "areas") as any[];
await clic(t2.page, "Actualizar");
await esperarTexto(t2.page, "Catálogo actualizado · versión 1");
await captura(t2.page, "08-turno-catalogo-actualizado.png");
const areasDespues = await leerTodo(t2.page, "areas") as any[];
const areasT1 = await leerTodo(t1.page, "areas") as any[];
const mismo = (a: any[], b: any[]) => JSON.stringify(a.map((x) => [x.id, x.nombre, x.vigente]).sort()) === JSON.stringify(b.map((x) => [x.id, x.nombre, x.vigente]).sort());
ok(mismo(areasDespues, areasT1), "los dos teléfonos quedan con las mismas áreas e ids");
ok(areasAntes.every((a) => areasDespues.some((d) => d.id === a.id)), "ninguna área se borró");
ok(areasDespues.find((a) => a.nombre === "La Bodega")?.vigente === false && areasDespues.find((a) => a.nombre === "Mentidero")?.vigente === false, "La Bodega y Mentidero quedan no vigentes");
const emp2 = await leerTodo(t2.page, "empresas") as any[];
ok(emp2.some((e) => e.nombre === "GEOSUR") && emp2.some((e) => e.nombre === "OOCC"), "GEOSUR nueva; OOCC se conserva porque la usan reportes");
const us2 = await leerTodo(t2.page, "usuarios") as any[];
ok(us2.find((u) => u.nombre === "Arnoldi Díaz")?.activo === false && us2.some((u) => u.nombre === "Camila Fuentes"), "Arnoldi Díaz inactivo; Camila Fuentes nueva");
const at2 = await leerTodo(t2.page, "areasTurno") as any[];
ok(at2.every((a) => areasDespues.some((d) => d.id === a.areaId)), "todas las áreas del turno siguen apuntando a un área existente");
await t2.page.goto(URL + "/agregar-area", { waitUntil: "domcontentloaded" });
await esperarTexto(t2.page, "Muro de contención Pk 2+100");
const lista = await t2.page.evaluate(() => document.body.innerText);
ok(!lista.includes("La Bodega"), "La Bodega ya no se ofrece al agregar área");
await captura(t2.page, "09-agregar-area-con-catalogo-nuevo.png");
await t2.page.goto(URL + "/", { waitUntil: "domcontentloaded" });
await esperarTexto(t2.page, "Áreas del turno");
await t2.page.click('button[aria-label="Ajustes de la demostración"]');
await esperarTexto(t2.page, "Camila Fuentes");
const ajustesTxt = await t2.page.evaluate(() => document.body.innerText);
ok(!ajustesTxt.includes("Administrar catálogo") && !ajustesTxt.includes("Arnoldi Díaz"), "inspector sin enlace a /admin y sin usuarios inactivos");
await captura(t2.page, "10-ajustes-inspector-catalogo-v1.png");
await t2.page.goto(URL + "/admin", { waitUntil: "domcontentloaded" });
await esperarTexto(t2.page, "Solo para administradores");
ok(true, "/admin bloqueado para el inspector");

// ───────── Teléfono 3: migración desde la semilla anterior ─────────
console.log("\nTeléfono 3 · migración de ids de la semilla 2026-10-20.2");
const t3 = await nuevaPagina();
await t3.page.goto(URL + "/", { waitUntil: "domcontentloaded" });
await esperarTexto(t3.page, "Jorge Orellana S.");
const mapa: Record<string, string> = {
  [base.usuarios[0].id]: "u-orellana", [base.contrato.id]: "c-4600026893",
  [base.empresas[0].id]: "e1-tecnasic", [base.empresas[1].id]: "e2-geoinyecta", [base.empresas[2].id]: "e3-idiem", [base.empresas[3].id]: "e4-oocc",
};
base.areas.forEach((a: any, i: number) => { mapa[a.id] = `a-${String(i + 1).padStart(2, "0")}`; });
const reportesAntes = (await leerTodo(t3.page, "reportes") as any[]).map((r) => r.id).sort();
// Deja la base como la tenía la semilla anterior (ids viejos), con un reporte «del usuario» extra.
await t3.page.evaluate((mapa: Record<string, string>) => new Promise((res, rej) => {
  const m = (x: string | undefined) => (x && mapa[x]) || x;
  const r = indexedDB.open("bitacora-ito");
  r.onsuccess = () => {
    const db = r.result;
    const tx = db.transaction(["usuarios", "contratos", "empresas", "areas", "rolesTurno", "reportes", "areasTurno", "alertas", "envios", "ajustes"], "readwrite");
    const rekey = (store: string, f: (o: any) => any, filtro: (o: any) => boolean = () => true) => {
      const s = tx.objectStore(store);
      s.getAll().onsuccess = (e: any) => { for (const o of e.target.result) { if (!filtro(o)) { s.delete(o.id); continue; } s.delete(o.id); s.put(f(o)); } };
    };
    rekey("usuarios", (u) => ({ id: "u-orellana", nombre: u.nombre, correo: "jorellana@empresa.cl", rol: "inspector" }), (u) => mapa[u.id] === "u-orellana");
    rekey("contratos", (c) => ({ ...c, id: m(c.id), ultimoCorrelativo: c.ultimoCorrelativo + 3 }));
    rekey("empresas", (e) => ({ ...e, id: m(e.id), contratoId: m(e.contratoId) }));
    rekey("areas", (a) => ({ ...a, id: m(a.id), contratoId: m(a.contratoId), nombre: a.nombre === "Traucalén" ? "Traucalón" : a.nombre }));
    rekey("rolesTurno", (x) => ({ ...x, id: "rol-orellana", usuarioId: m(x.usuarioId), contratoId: m(x.contratoId) }), (x) => mapa[x.usuarioId] === "u-orellana");
    const rep = tx.objectStore("reportes");
    rep.getAll().onsuccess = (e: any) => { for (const o of e.target.result) rep.put({ ...o, contratoId: m(o.contratoId), elaboradoPor: m(o.elaboradoPor), aprobadoPor: m(o.aprobadoPor) }); };
    const at = tx.objectStore("areasTurno");
    at.getAll().onsuccess = (e: any) => { for (const o of e.target.result) at.put({ ...o, areaId: m(o.areaId), empresaId: m(o.empresaId) }); };
    const al = tx.objectStore("alertas");
    al.getAll().onsuccess = (e: any) => { for (const o of e.target.result) al.put({ ...o, empresaId: m(o.empresaId) }); };
    const en = tx.objectStore("envios");
    en.getAll().onsuccess = (e: any) => { for (const o of e.target.result) en.put({ ...o, enviadoPor: m(o.enviadoPor) }); };
    const aj = tx.objectStore("ajustes");
    aj.put({ clave: "usuarioActual", valor: "u-orellana" });
    aj.put({ clave: "contratoActual", valor: "c-4600026893" });
    aj.put({ clave: "semillaVersion", valor: "2026-10-20.2" });
    aj.put({ clave: "rolActual", valor: "inspector" });
    tx.oncomplete = () => { db.close(); res(true); };
    tx.onerror = () => rej(tx.error);
  };
}), mapa);
ok((await leerTodo(t3.page, "areasTurno") as any[]).every((a) => /^a-\d\d$/.test(a.areaId)), "base preparada con los ids antiguos");
await t3.page.reload({ waitUntil: "domcontentloaded" });
await esperarTexto(t3.page, "Áreas del turno");
const reportesDespues = (await leerTodo(t3.page, "reportes") as any[]);
ok(JSON.stringify(reportesDespues.map((r) => r.id).sort()) === JSON.stringify(reportesAntes), `se conservan los ${reportesAntes.length} reportes (mismos ids)`);
ok(reportesDespues.every((r) => r.contratoId === base.contrato.id && r.elaboradoPor === base.usuarios[0].id), "reportes apuntan al contrato y usuario nuevos");
const at3 = await leerTodo(t3.page, "areasTurno") as any[];
ok(at3.every((a) => base.areas.some((b: any) => b.id === a.areaId) && base.empresas.some((b: any) => b.id === a.empresaId)), "áreas del turno con ids estables");
ok((await leerTodo(t3.page, "usuarios") as any[]).length === 5, "usuarios nuevos agregados");
ok((await ajuste(t3.page, "semillaVersion")) === "2026-10-30.1" && (await ajuste(t3.page, "contratoActual")) === base.contrato.id, "versión de semilla y contrato actual migrados");
ok(((await leerTodo(t3.page, "contratos")) as any[])[0].ultimoCorrelativo === 1975, "el correlativo local no retrocede");
await captura(t3.page, "11-turno-tras-migrar-ids.png");

await browser.close();
console.log(fallas ? `\n${fallas} comprobaciones fallaron.` : "\nTodas las comprobaciones pasaron.");
process.exit(fallas ? 1 : 0);

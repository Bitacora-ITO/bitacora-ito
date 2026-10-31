// Prueba de la consolidación sin red ni Supabase: fuente en memoria con 3 partes inventadas.
// Comprueba las reglas, genera el PDF consolidado («bitacora»), el resumen.md y el paquete .zip,
// y simula «Aprobar y enviar» (sin correo real). Uso, desde bitacora-ito/:
//   bash scripts/consolidacion/probar.sh [ruta_del_pdf_de_muestra]
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fijarBaseRecursos, generarPdfInforme } from "../../src/lib/informe/pdf";
import { aDatosInforme, estructurar } from "../../src/lib/consolidar";
import {
  aprobarYEnviar, descargarPartes, fuenteEnMemoria, leerEstadoTurno, rutaPdfConsolidado, type FuenteConsolidacion,
} from "../../src/lib/consolidacion-remota";
import { armarPaquete, nombreBase, resumenMarkdown } from "../../src/lib/paquete";
import type { CuerpoEnvio } from "../../src/lib/envio";
import { CONTRATO_DEMO, datosDemo } from "./fixture";

const raiz = process.env.RAIZ_BITACORA ?? process.cwd();
const salida = path.join(raiz, "scripts", "consolidacion", "salida");
const pdfMuestra = path.resolve(process.argv[2] ?? path.join(salida, "consolidado-ejemplo.pdf"));
const FECHA = "2026-10-30";

let pasos = 0;
const ok = (texto: string) => { pasos++; console.log(`  ✓ ${texto}`); };

async function main() {
  await mkdir(salida, { recursive: true });
  const datos = datosDemo(FECHA);
  // En Node las fotos se leen de public/ (en la app se descargan de la URL pública del bucket `fotos`).
  const fuente: FuenteConsolidacion = {
    ...fuenteEnMemoria(datos),
    descargarFoto: async (url) => new Blob([await readFile(path.join(raiz, "public", url))], { type: "image/jpeg" }),
  };

  console.log("1. Lista de partes del turno");
  const estado = await leerEstadoTurno(fuente, CONTRATO_DEMO, FECHA, "dia");
  assert.deepEqual(estado.partes.map((p) => [p.inspector, p.entregado]),
    [["Jorge Orellana S.", true], ["Alberto Castillo", true], ["Arnoldi Díaz", true], ["Marcela Rojas", false]]);
  ok("3 partes entregadas (entregado_en lleno) y 1 en la nube sin entregar");
  const o = estado.partes[0];
  assert.deepEqual([o.areas, o.registros, o.alertas, o.fotos], [2, 3, 1, 3]);
  ok("conteos por parte (Orellana: 2 áreas, 3 registros, 1 alerta, 3 fotos)");
  assert.deepEqual(estado.pendientes.map((p) => [p.nombre, p.motivo, p.estadoParte ?? null]),
    [["Marcela Rojas", "pendiente", "generado"], ["Pedro Soto", "descanso", null]]);
  ok("pendientes: Rojas «Pendiente» (PDF generado sin entregar) y Soto de descanso; la jefa no aparece");

  console.log("2. Descarga y consolidación");
  const ids = estado.partes.filter((p) => p.entregado).map((p) => p.reporteId);
  const d = await descargarPartes(fuente, CONTRATO_DEMO, FECHA, "dia", ids);
  assert.equal(d.fotos.size, 7);
  assert.equal(d.fotosFallidas, 0);
  ok("7 fotos descargadas una sola vez");
  const dataUrl = new Map<string, string>();
  for (const [id, b] of d.fotos) dataUrl.set(id, `data:image/jpeg;base64,${Buffer.from(await b.arrayBuffer()).toString("base64")}`);
  const c = estructurar(d.entrada, { srcFoto: (f) => dataUrl.get(f.id) ?? f.url });

  assert.equal(c.correlativo, "4600026893-8211-INDCS-01974");
  ok("correlativo = prefijo + (1973 + 1) con 5 dígitos → 01974");
  assert.equal(c.elaboradoPor, "Jorge Orellana S. / Alberto Castillo / Arnoldi Díaz");
  ok("«Elaborado por» con « / » en orden de entrega");
  assert.equal(c.climaTurno, "despejado");
  assert.equal(c.climaProyeccion, "despejado");
  ok("clima por defecto = el más repetido (despejado 2 de 3)");
  assert.equal(estructurar(d.entrada, { climaTurno: "lluvia" }).climaTurno, "lluvia");
  ok("el jefe puede elegir otro clima");

  assert.deepEqual(c.areas.map((a) => `${a.numero} ${a.nombre}`),
    ["1.0 Peralte Muro Sotelo", "2.0 Vertedero Morning Glory", "3.0 Túnel PAMo", "4.0 Fortificación Tramo B"]);
  ok("áreas fusionadas por nombre y numeradas por primera aparición");
  const peralte = c.areas[0];
  assert.deepEqual(peralte.empresas.map((e) => `${e.numero} ${e.nombre}`), ["1.1 TECNASIC", "1.2 IDIEM"]);
  ok("subsecciones n.1, n.2 por empresa");
  assert.deepEqual(peralte.empresas[0].lineas.map((l) => [l.inspector, l.registradoEn.slice(11, 16)]),
    [["Jorge Orellana S.", "12:12"], ["Alberto Castillo", "13:30"], ["Jorge Orellana S.", "14:40"]]);
  ok("misma área y empresa de dos inspectores: líneas juntas por hora de registro");
  const pamo = c.areas[2];
  assert.equal(pamo.empresas[0].lineas.length, 1);
  assert.equal(pamo.empresas[0].lineas[0].sinActividad, false);
  ok("«Sin actividad» de Castillo se omite porque Díaz registró actividad en Túnel PAMo");
  assert.equal(c.areas[3].empresas[0].lineas.length, 2);
  ok("los saltos de línea separan viñetas (guion inicial quitado)");

  assert.deepEqual(c.alertas.map((a) => [a.columna, a.criticidad]),
    [["construccion", "media"], ["laboratorio", "alta"], ["topografia", "baja"], ["interferencia", "alta"]]);
  ok("alertas juntas por columna");
  assert.equal(peralte.fotos.length, 4); // 2 de Orellana + 1 de IDIEM + 1 de la alerta de laboratorio
  assert.equal(peralte.fotos[3].pie, "Alerta · Laboratorio (alta)");
  assert.equal(pamo.fotos.length, 1);
  ok("fotos por área, con las de alertas al final y su pie");
  assert.equal(new Set(c.fotos.map((f) => f.archivo)).size, c.fotos.length);
  assert.match(c.fotos[0].archivo, /^fotos\/01-peralte-muro-sotelo-j-orellana-\d{4}\.jpg$/);
  ok(`nombres legibles y únicos (${c.fotos[0].archivo})`);
  assert.deepEqual(c.totales, { areas: 4, registros: 9, sinActividad: 0, alertas: 4, alertasAltas: 2, fotos: 7 });
  ok("totales para el correo");

  console.log("3. PDF, resumen y paquete");
  fijarBaseRecursos(path.join(raiz, "public"), async (r) => new Uint8Array(await readFile(r)));
  const t0 = Date.now();
  const pdf = await generarPdfInforme(aDatosInforme(c), "bitacora");
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString("latin1"), "%PDF-");
  await mkdir(path.dirname(pdfMuestra), { recursive: true });
  await writeFile(pdfMuestra, bytes);
  ok(`PDF consolidado (${(bytes.length / 1024).toFixed(0)} KB, ${Date.now() - t0} ms): ${pdfMuestra}`);
  const md = resumenMarkdown(c, { consolidadoPor: "Carolina Muñoz" });
  await writeFile(path.join(salida, "resumen.md"), md);
  assert.match(md, /Alberto Castillo, \d\d:\d\d/);
  ok("resumen.md con registros por inspector y hora");
  const fotosBytes = new Map<string, Uint8Array>();
  for (const [id, b] of d.fotos) fotosBytes.set(id, new Uint8Array(await b.arrayBuffer()));
  const zip = armarPaquete(c, bytes, fotosBytes, { consolidadoPor: "Carolina Muñoz" });
  const rutaZip = path.join(salida, `${nombreBase(c)}.zip`);
  await writeFile(rutaZip, zip);
  ok(`paquete .zip (${(zip.length / 1024).toFixed(0)} KB): ${rutaZip}`);

  console.log("4. Aprobar y enviar (simulado: no sale ningún correo)");
  let cuerpo: CuerpoEnvio | undefined;
  const r = await aprobarYEnviar(fuente, {
    id: "cons-prueba", contratoId: CONTRATO_DEMO, consolidadoPor: "u-munoz", consolidacion: c, pdf,
    destinatarios: ["inspeccion@mandante.cl"], mandante: "Mandante de prueba",
    enviar: async (x) => { cuerpo = x; return { ok: true, mensajeId: "simulado" }; },
  });
  assert.equal(r.ok, true);
  assert.equal(cuerpo?.pdf.ruta, rutaPdfConsolidado(FECHA, "cons-prueba"));
  assert.match(cuerpo!.pdf.ruta!, /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,200}\.pdf$/); // la misma validación de /api/enviar
  assert.equal(cuerpo?.reporte.numero, "01974");
  assert.equal(cuerpo?.reporte.elaboradoPor, c.elaboradoPor);
  ok("cuerpo de /api/enviar compatible: ruta consolidados/<fecha>/<id>.pdf pasa la validación de la API");
  const tipos = (datos.escrituras ?? []).map((e) => e.tipo);
  assert.deepEqual(tipos, ["pdf", "consolidado", "correlativo", "consolidado"]);
  assert.equal(datos.contrato.ultimo_correlativo, 1974);
  const ultima = datos.escrituras!.at(-1)!.datos as { estado: string; partes: string[] };
  assert.equal(ultima.estado, "enviado");
  assert.deepEqual(ultima.partes, ["r-orellana", "r-castillo", "r-diaz"]);
  ok("sube el PDF, guarda `consolidado` (aprobado → enviado) y avanza ultimo_correlativo a 1974");

  const fallo = await aprobarYEnviar(fuente, {
    id: "cons-2", contratoId: CONTRATO_DEMO, consolidadoPor: "u-munoz", consolidacion: c, pdf,
    destinatarios: ["x@y.cl"], enviar: async () => ({ ok: false, error: "Sin conexión.", sinRed: true }),
  });
  assert.equal(fallo.ok, false);
  ok("si el correo falla, devuelve el error para reintentar");

  // Datos para la demostración en el navegador (capturas).
  await writeFile(path.join(salida, "demo.json"), JSON.stringify(datosDemo(process.env.FECHA_DEMO ?? FECHA)));
  console.log(`\n${pasos} comprobaciones correctas.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

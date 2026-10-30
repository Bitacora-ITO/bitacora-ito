// Genera en Node el PDF del fixture del 27-09-2026 con el mismo código que usa la app.
// Uso: bash scripts/pdf/verificar.sh (lo empaqueta con esbuild como ESM y lo ejecuta con Node).
// Directo, desde bitacora-ito/:
//   npx --yes esbuild scripts/pdf/generar-fixture.ts --bundle --platform=node --format=esm \
//     --packages=external --jsx=automatic --outfile=scripts/pdf/salida/generar.mjs
//   node scripts/pdf/salida/generar.mjs [salida.pdf] [fixture]
//   fixture: "27-09" (por defecto) o "largo" (varias páginas, para probar el paginado).
//   formato: "mandante" (por defecto, para comparar con el original) o "bitacora" (diseño propio).
// (tsx no sirve aquí: @react-pdf es solo ESM y tsx lo cargaría como CommonJS.)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fijarBaseRecursos, generarPdfInforme } from "../../src/lib/informe/pdf";
import { datosInforme2709 } from "../../src/lib/informe/fixture-27-09";
import type { DatosInforme } from "../../src/lib/informe/tipos";

const raiz = process.env.RAIZ_BITACORA ?? process.cwd();
const salida = path.resolve(process.argv[2] ?? path.join(raiz, "scripts", "pdf", "salida", "generado-27-09.pdf"));
const cual = process.argv[3] ?? "27-09";
const formato = process.argv[4] === "bitacora" ? "bitacora" : "mandante";

function fixtureLargo(): DatosInforme {
  const base = datosInforme2709;
  const extra = base.secciones.map((s, i) => ({
    ...s,
    numero: `${i + 5}.0`,
    subsecciones: s.subsecciones.map((sub) => ({ ...sub, numero: sub.numero ? `${i + 5}${sub.numero.slice(1)}` : "" })),
  }));
  return {
    ...base,
    alertas: {
      ...base.alertas,
      laboratorio: [{ empresa: "IDIEM", texto: "Ensayo de densidad pendiente en capa 17 del Muro Sotelo.", criticidad: "media" }],
      interferencia: [{ empresa: "TECNASIC", texto: "Corte de camino por tronadura entre 13:00 y 13:30.", criticidad: "alta" }],
    },
    secciones: [...base.secciones, ...extra, ...extra.map((s, i) => ({ ...s, numero: `${i + 9}.0` }))],
  };
}

async function main() {
  fijarBaseRecursos(path.join(raiz, "public"), async (r) => new Uint8Array(await readFile(r)));
  const datos = cual === "largo" ? fixtureLargo() : datosInforme2709;
  const t0 = Date.now();
  const blob = await generarPdfInforme(datos, formato);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await mkdir(path.dirname(salida), { recursive: true });
  await writeFile(salida, bytes);
  console.log(`PDF generado: ${salida} (${(bytes.length / 1024).toFixed(0)} KB, ${Date.now() - t0} ms)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

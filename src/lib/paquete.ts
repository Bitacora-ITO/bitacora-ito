// Paquete .zip del consolidado del turno: el PDF, un resumen.md con todo el contenido en texto y las
// fotos con nombres legibles. `resumenMarkdown` y `armarPaquete` son puros (sirven en Node para las
// pruebas); `descargarArchivo` guarda el .zip en el teléfono o lo descarga en la web.
import { strToU8, zipSync, type Zippable } from "fflate";
import { Capacitor } from "@capacitor/core";
import type { Consolidacion } from "./consolidar";
import { horaLocal, ORDEN_COLUMNAS } from "./consolidar";

const COLUMNA: Record<string, string> = {
  construccion: "Construcción", laboratorio: "Laboratorio", topografia: "Topografía", interferencia: "Interferencia",
};
const CRITICIDAD: Record<string, string> = { baja: "Baja", media: "Media", alta: "Alta" };
const CLIMA: Record<string, string> = { despejado: "Despejado", nublado: "Nublado", lluvia: "Lluvia" };

const fechaCorta = (d: string) => d.split("-").reverse().join("-");

/** Nombre base de los archivos: "Reporte_Diario_01973_30-10-2026". */
export function nombreBase(c: Consolidacion): string {
  return `Reporte_Diario_${String(c.numero).padStart(5, "0")}_${fechaCorta(c.fecha)}`;
}

/** Todo el contenido del consolidado en texto: áreas, registros por inspector y hora, alertas y fotos. */
export function resumenMarkdown(c: Consolidacion, extra?: { consolidadoPor?: string; generadoEn?: string }): string {
  const l: string[] = [];
  const turno = c.turno === "dia" ? "día" : "noche";
  l.push(`# Reporte diario consolidado N.º ${String(c.numero).padStart(5, "0")}`, "");
  l.push(`- **Contrato:** ${c.contrato.nombre} (N.º ${c.contrato.numero})`);
  l.push(`- **Código del proyecto:** ${c.contrato.codigoProyecto}`);
  l.push(`- **Correlativo:** ${c.correlativo}`);
  l.push(`- **Fecha y turno:** ${fechaCorta(c.fecha)}, turno ${turno}`);
  l.push(`- **Elaborado por:** ${c.elaboradoPor}`);
  if (extra?.consolidadoPor) l.push(`- **Consolidado por (jefe de turno):** ${extra.consolidadoPor}`);
  l.push(`- **Clima del turno:** ${CLIMA[c.climaTurno]} · **proyección de mañana:** ${CLIMA[c.climaProyeccion]}`);
  if (extra?.generadoEn) l.push(`- **Generado:** ${new Date(extra.generadoEn).toLocaleString("es-CL")}`);
  const t = c.totales;
  l.push("", `**En cifras:** ${t.areas} áreas · ${t.registros} líneas de actividad · ${t.sinActividad} sin actividad · ${t.alertas} alertas (${t.alertasAltas} altas) · ${t.fotos} fotografías`, "");

  l.push("## Partes incluidas", "", "| Inspector | Entregado | Áreas | Registros | Alertas | Fotos |", "|---|---|---|---|---|---|");
  for (const p of c.partes) l.push(`| ${p.inspector} | ${horaLocal(p.entregadoEn) || "—"} | ${p.areas} | ${p.registros} | ${p.alertas} | ${p.fotos} |`);
  l.push("");

  l.push("## Alertas", "");
  if (!c.alertas.length) l.push("Sin alertas en el turno.", "");
  for (const col of ORDEN_COLUMNAS) {
    const als = c.alertas.filter((a) => a.columna === col);
    if (!als.length) continue;
    l.push(`### ${COLUMNA[col]}`, "");
    for (const a of als) {
      const donde = [a.empresa, a.area].filter(Boolean).join(" · ");
      l.push(`- **${CRITICIDAD[a.criticidad]}**${donde ? ` · ${donde}` : ""} · ${a.inspector}, ${horaLocal(a.registradoEn)}: ${a.texto}`);
      for (const f of a.fotos) l.push(`  - Foto: \`${f}\``);
    }
    l.push("");
  }

  l.push("## Áreas y registros", "");
  for (const a of c.areas) {
    l.push(`### ${a.numero} ${a.nombre.toLocaleUpperCase("es-CL")}`, "");
    for (const e of a.empresas) {
      l.push(`#### ${e.numero} ${e.nombre}`, "");
      if (!e.lineas.length) l.push("_(sin registros)_");
      for (const x of e.lineas) {
        l.push(x.sinActividad ? `- Sin actividad. _(${x.inspector})_` : `- ${x.texto} _(${x.inspector}, ${horaLocal(x.registradoEn)})_`);
      }
      l.push("");
    }
    if (a.fotos.length) {
      l.push(`Fotografías de ${a.nombre}:`, "");
      for (const f of a.fotos) l.push(`- \`${f.archivo}\` · ${f.inspector}, ${horaLocal(f.capturadaEn)}${f.pie ? ` · ${f.pie}` : ""}`);
      l.push("");
    }
  }

  l.push("## Lista de fotografías", "");
  if (!c.fotos.length) l.push("Sin fotografías.");
  for (const f of c.fotos) l.push(`- \`${f.archivo}\` · ${f.area} · ${f.inspector}, ${horaLocal(f.capturadaEn)}${f.origen === "alerta" ? ` · ${f.pie ?? "alerta"}` : ""}`);
  l.push("", "—", "Generado por Bitácora ITO.", "");
  return l.join("\n");
}

/** Arma el .zip: PDF, resumen.md y fotos/ (solo las que se pudieron descargar). */
export function armarPaquete(c: Consolidacion, pdf: Uint8Array, fotos: Map<string, Uint8Array>, extra?: { consolidadoPor?: string; generadoEn?: string }): Uint8Array {
  const base = nombreBase(c);
  const archivos: Zippable = {
    [`${base}.pdf`]: [pdf, { level: 0 }], // el PDF ya viene comprimido
    "resumen.md": strToU8(resumenMarkdown(c, extra)),
  };
  for (const f of c.fotos) {
    const bytes = fotos.get(f.id);
    if (bytes) archivos[f.archivo] = [bytes, { level: 0 }]; // JPEG: no gana nada al comprimir
  }
  return zipSync(archivos);
}

/** Guarda el .zip (u otro archivo) en «Documentos/Bitacora ITO» del teléfono, o lo descarga en la web. */
export async function descargarArchivo(datos: Blob, nombre: string): Promise<void> {
  if (typeof window === "undefined") return;
  const archivo = nombre.replace(/[\\/:*?"<>|]+/g, "-").trim() || "paquete.zip";
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const data = await new Promise<string>((ok, mal) => {
      const lector = new FileReader();
      lector.onload = () => { const s = String(lector.result ?? ""); ok(s.slice(s.indexOf(",") + 1)); };
      lector.onerror = () => mal(lector.error ?? new Error("No se pudo leer el archivo."));
      lector.readAsDataURL(datos);
    });
    try {
      await Filesystem.writeFile({ path: `Bitacora ITO/${archivo}`, data, directory: Directory.Documents, recursive: true });
    } catch {
      await Filesystem.writeFile({ path: `Documentos/${archivo}`, data, directory: Directory.External, recursive: true });
    }
    return;
  }
  const url = URL.createObjectURL(datos);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

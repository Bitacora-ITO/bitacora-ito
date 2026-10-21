// Genera el PDF del reporte diario en el formato del mandante (FRMCS-00001), con @react-pdf/renderer.
// Corre en el navegador y sin red: las fuentes (Carlito, métricamente igual a Calibri) y el logo salen
// de /public, y las fotos llegan como data URL o como ruta pública. Para generarlo en Node (verificación
// en scripts/pdf), se fija la base de recursos con rutas absolutas de archivo y un lector de archivos.
import { createElement } from "react";
import { Font, pdf } from "@react-pdf/renderer";
import type { DatosInforme, FotoInforme } from "./tipos";
import DocumentoInforme from "./componentes/DocumentoInforme";
import type { FotoPreparada, SeccionPreparada } from "./componentes/Seccion";
import { desdeBase64, prepararImagen } from "./componentes/imagenes";
import { FAMILIA } from "./componentes/medidas";

type LectorArchivo = (ruta: string) => Promise<Uint8Array>;

let baseRecursos = "";
let lectorArchivo: LectorArchivo | null = null;
let familiaRegistrada: { base: string; familia: string } | null = null;
let contadorFamilias = 0;

/**
 * Fija de dónde salen los recursos públicos (/fonts, /informe, /demo/fotos…).
 * - En la app no hace falta llamarla: se usan las rutas del mismo origen ("/fonts/…").
 * - En Node: `fijarBaseRecursos("D:/…/bitacora-ito/public", (r) => fs.readFile(r))`.
 */
export function fijarBaseRecursos(ruta: string, leerArchivo?: LectorArchivo): void {
  baseRecursos = ruta.replace(/[\\/]+$/, "");
  lectorArchivo = leerArchivo ?? null;
}

function resolver(src: string): string {
  if (/^(data:|blob:|https?:|file:)/i.test(src)) return src;
  if (!baseRecursos) return src;
  return `${baseRecursos}/${src.replace(/^[\\/]+/, "")}`;
}

function registrarFuentes(): string {
  if (familiaRegistrada && familiaRegistrada.base === baseRecursos) return familiaRegistrada.familia;
  // Font.register acumula fuentes por familia: si cambia la base, se registra una familia nueva.
  const familia = contadorFamilias === 0 ? FAMILIA : `${FAMILIA}-${contadorFamilias}`;
  contadorFamilias += 1;
  const f = (archivo: string) => resolver(`/fonts/${archivo}`);
  Font.register({
    family: familia,
    fonts: [
      { src: f("Carlito-Regular.ttf"), fontWeight: "normal", fontStyle: "normal" },
      { src: f("Carlito-Bold.ttf"), fontWeight: "bold", fontStyle: "normal" },
      { src: f("Carlito-Italic.ttf"), fontWeight: "normal", fontStyle: "italic" },
      { src: f("Carlito-BoldItalic.ttf"), fontWeight: "bold", fontStyle: "italic" },
    ],
  });
  // Sin guiones de corte: las líneas se cortan entre palabras, como en Excel.
  Font.registerHyphenationCallback((palabra) => [palabra]);
  familiaRegistrada = { base: baseRecursos, familia };
  return familia;
}

async function leerBytes(src: string): Promise<Uint8Array> {
  if (src.startsWith("data:")) {
    const coma = src.indexOf(",");
    const cabecera = src.slice(0, coma);
    const cuerpo = src.slice(coma + 1);
    return cabecera.includes(";base64") ? desdeBase64(cuerpo) : new TextEncoder().encode(decodeURIComponent(cuerpo));
  }
  const ruta = resolver(src);
  if (lectorArchivo && !/^(blob:|https?:)/i.test(ruta)) return lectorArchivo(ruta);
  const r = await fetch(ruta);
  if (!r.ok) throw new Error(`No se pudo leer la imagen ${src} (${r.status}).`);
  return new Uint8Array(await r.arrayBuffer());
}

async function prepararFoto(f: FotoInforme): Promise<FotoPreparada | null> {
  try {
    const img = await prepararImagen(await leerBytes(f.src));
    return { src: img.dataUrl, ancho: img.ancho, alto: img.alto, pie: f.pie };
  } catch (e) {
    // Una foto ilegible no debe impedir el informe: se omite y se avisa en consola.
    console.warn("generarPdfInforme: foto omitida", f.src.slice(0, 80), e);
    return null;
  }
}

export async function generarPdfInforme(datos: DatosInforme): Promise<Blob> {
  const familia = registrarFuentes();
  const [logo, secciones] = await Promise.all([
    leerBytes("/informe/logo-jej.png")
      .then(prepararImagen)
      .then((i) => i.dataUrl)
      .catch(() => undefined),
    Promise.all(
      datos.secciones.map(async (s): Promise<SeccionPreparada> => {
        const fotos = (await Promise.all(s.fotos.map(prepararFoto))).filter((f): f is FotoPreparada => f !== null);
        return { ...s, fotos };
      }),
    ),
  ]);
  const doc = createElement(DocumentoInforme, { datos, secciones, logo, familia });
  // pdf() espera un <Document>; DocumentoInforme lo devuelve.
  return pdf(doc as unknown as Parameters<typeof pdf>[0]).toBlob();
}

/** Nombre de archivo, p. ej. "Reporte_Diario_01972_27-09-2026.pdf". */
export function nombreArchivoPdf(datos: DatosInforme): string {
  const n = datos.correlativo.split("-").pop() ?? "reporte";
  return `Reporte_Diario_${n}_${datos.fecha}.pdf`;
}

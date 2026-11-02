"use client";
// Excel del catálogo en el navegador y en el APK: escribir la plantilla y leer el archivo cargado.
// Las librerías se cargan solo al usarlas (no pesan en el resto de la app).
import {
  construirHojas, construirPlantillaEnBlanco, type CatalogoDatos, type HojaExcel, type HojaLeida, NOMBRE_PLANTILLA,
} from "@/lib/catalogo-excel";
import { blobABase64 } from "@/lib/nativo";
import { Capacitor } from "@capacitor/core";

const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function aXlsx(hojas: HojaExcel[]): Promise<Blob> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  // HojaExcel tiene la misma forma que las hojas de write-excel-file (sheet, data, columns, stickyRowsCount).
  return writeXlsxFile(hojas as never, { fontFamily: "Calibri", fontSize: 11 } as never).toBlob();
}

/** Plantilla .xlsx llena con el catálogo indicado. */
export const plantillaXlsx = (cat: CatalogoDatos) => aXlsx(construirHojas(cat));

/** Plantilla .xlsx en blanco «solo llenar» (instrucciones y una fila de ejemplo por hoja). */
export const plantillaEnBlancoXlsx = () => aXlsx(construirPlantillaEnBlanco());

/** Guarda el archivo: en la web lo descarga; en el APK lo deja en Documentos/Bitacora ITO. Devuelve dónde quedó. */
export async function guardarArchivo(blob: Blob, nombre = NOMBRE_PLANTILLA): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const data = await blobABase64(blob);
    try {
      await Filesystem.writeFile({ path: `Bitacora ITO/${nombre}`, data, directory: Directory.Documents, recursive: true });
      return `Documentos/Bitacora ITO/${nombre}`;
    } catch {
      await Filesystem.writeFile({ path: `Documentos/${nombre}`, data, directory: Directory.External, recursive: true });
      return `la carpeta de la app (Documentos/${nombre})`;
    }
  }
  const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: TIPO_XLSX }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return `Descargas/${nombre}`;
}

/** Lee todas las hojas del Excel cargado. */
export async function leerLibro(archivo: Blob): Promise<HojaLeida[]> {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  try {
    return (await readXlsxFile(archivo)) as unknown as HojaLeida[];
  } catch {
    throw new Error("No se pudo leer el archivo. Verifique que sea un Excel .xlsx (no .xls ni .csv) y que no esté dañado.");
  }
}

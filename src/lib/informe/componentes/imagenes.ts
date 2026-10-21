// Lectura de imágenes para el PDF: bytes → tipo, dimensiones y data URL.
// react-pdf solo admite JPEG y PNG; lo demás (WebP, etc.), los JPEG con orientación EXIF y las fotos
// muy grandes se redibujan en un canvas cuando hay navegador. En el PDF una foto mide ~85-120 pt de
// ancho, así que 1600 px por lado sobran para imprimir nítido y el correo pesa mucho menos.

const LADO_MAXIMO = 1600;

export interface ImagenLeida {
  dataUrl: string;
  ancho: number;
  alto: number;
}

type Tipo = "jpeg" | "png" | "otro";

export function tipoImagen(b: Uint8Array): Tipo {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  return "otro";
}

function u16(b: Uint8Array, i: number, le = false): number {
  return le ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1];
}
function u32(b: Uint8Array, i: number): number {
  return ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
}

/** Dimensiones y orientación EXIF de un JPEG o PNG (sin decodificar la imagen). */
export function dimensiones(b: Uint8Array): { ancho: number; alto: number; orientacion: number } | null {
  const tipo = tipoImagen(b);
  if (tipo === "png") return { ancho: u32(b, 16), alto: u32(b, 20), orientacion: 1 };
  if (tipo !== "jpeg") return null;
  let i = 2;
  let orientacion = 1;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marca = b[i + 1];
    if (marca === 0xd8 || (marca >= 0xd0 && marca <= 0xd7) || marca === 0x01 || marca === 0xff) {
      i += marca === 0xff ? 1 : 2;
      continue;
    }
    const largo = u16(b, i + 2);
    if (marca === 0xe1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) {
      orientacion = leerOrientacion(b, i + 10) ?? 1;
    }
    const esSof = marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc;
    if (esSof) {
      const alto = u16(b, i + 5);
      const ancho = u16(b, i + 7);
      return { ancho, alto, orientacion };
    }
    i += 2 + largo;
  }
  return null;
}

function leerOrientacion(b: Uint8Array, tiff: number): number | null {
  if (tiff + 8 > b.length) return null;
  const le = b[tiff] === 0x49;
  const ifd = tiff + (le ? b[tiff + 4] | (b[tiff + 5] << 8) | (b[tiff + 6] << 16) | (b[tiff + 7] << 24) : u32(b, tiff + 4));
  if (ifd + 2 > b.length) return null;
  const n = u16(b, ifd, le);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > b.length) return null;
    if (u16(b, e, le) === 0x0112) return u16(b, e + 8, le);
  }
  return null;
}

export function aBase64(b: Uint8Array): string {
  let s = "";
  const trozo = 0x8000;
  for (let i = 0; i < b.length; i += trozo) {
    s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + trozo)));
  }
  return btoa(s);
}

export function desdeBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Redibuja en un canvas (aplica la orientación EXIF y reduce a LADO_MAXIMO) y devuelve un JPEG. Solo en navegador. */
async function normalizarEnCanvas(b: Uint8Array): Promise<ImagenLeida | null> {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") return null;
  const copia = new Uint8Array(b.length);
  copia.set(b);
  const bmp = await createImageBitmap(new Blob([copia.buffer]), { imageOrientation: "from-image" });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bmp.width, bmp.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bmp.width * escala);
  lienzo.height = Math.round(bmp.height * escala);
  const ctx = lienzo.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
  bmp.close?.();
  return { dataUrl: lienzo.toDataURL("image/jpeg", 0.88), ancho: lienzo.width, alto: lienzo.height };
}

/** Convierte bytes de imagen en una data URL lista para react-pdf, con sus dimensiones. */
export async function prepararImagen(b: Uint8Array): Promise<ImagenLeida> {
  const tipo = tipoImagen(b);
  const dim = dimensiones(b);
  const grande = !!dim && Math.max(dim.ancho, dim.alto) > LADO_MAXIMO;
  const necesitaCanvas = tipo === "otro" || !dim || dim.orientacion > 1 || grande;
  if (necesitaCanvas) {
    const n = await normalizarEnCanvas(b).catch(() => null);
    if (n) return n;
    if (tipo === "otro") throw new Error("Formato de imagen no admitido en el PDF (solo JPEG o PNG).");
  }
  const girada = dim && dim.orientacion >= 5;
  return {
    dataUrl: `data:image/${tipo === "png" ? "png" : "jpeg"};base64,${aBase64(b)}`,
    ancho: dim ? (girada ? dim.alto : dim.ancho) : 0,
    alto: dim ? (girada ? dim.ancho : dim.alto) : 0,
  };
}

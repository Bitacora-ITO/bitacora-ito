// Capacidades del teléfono. En el APK usan plugins de Capacitor; en la web, las API del navegador.
// CONTRATO: las pantallas solo usan estas firmas (no cambiarlas).
//
// Los plugins se importan de forma diferida (import()) para que la versión web no los cargue
// y para que nada se ejecute durante el prerender de Next (no hay window en el servidor).
import { Capacitor } from "@capacitor/core";

export interface FotoCapturada {
  imagen: Blob; // JPEG comprimido (máx. ~1600 px de lado, calidad ~0.8)
  capturadaEn: string; // ISO
  latitud?: number;
  longitud?: number;
}

export interface Ubicacion {
  latitud: number;
  longitud: number;
  precision?: number;
}

const LADO_MAXIMO = 1600;
const CALIDAD_JPEG = 0.8;
const ESPERA_UBICACION_MS = 8000;
const IDIOMA_DICTADO = "es-CL";

const enNavegador = () => typeof window !== "undefined";
const esNativo = () => enNavegador() && Capacitor.isNativePlatform();

// ───────────────────────── Fotos ─────────────────────────

/** Abre la cámara (o el selector de archivos en la web) y devuelve la foto comprimida, o null si se cancela. */
export async function tomarFoto(): Promise<FotoCapturada | null> {
  if (!enNavegador()) return null;
  // La ubicación se pide en paralelo, mientras el inspector encuadra la foto.
  const ubicacion = obtenerUbicacion();
  const original = esNativo() ? await fotoNativa() : await fotoWeb();
  if (!original) return null;
  const capturadaEn = new Date().toISOString();
  const imagen = await comprimirImagen(original);
  const u = await ubicacion;
  return { imagen, capturadaEn, latitud: u?.latitud, longitud: u?.longitud };
}

async function fotoNativa(): Promise<Blob | null> {
  const { Camera, EncodingType } = await import("@capacitor/camera");
  const permiso = await Camera.checkPermissions().catch(() => null);
  if (permiso && permiso.camera !== "granted") {
    const pedido = await Camera.requestPermissions({ permissions: ["camera"] }).catch(() => null);
    if (!pedido || pedido.camera === "denied") {
      throw new Error("Bitácora ITO no tiene permiso para usar la cámara. Actívalo en Ajustes > Apps > Bitácora ITO > Permisos.");
    }
  }
  try {
    // takePhoto (Camera 8.1+) entrega la foto en un archivo temporal; la comprimimos nosotros en un canvas.
    const r = await Camera.takePhoto({ quality: 90, correctOrientation: true, encodingType: EncodingType.JPEG, saveToGallery: false });
    const ruta = r.webPath ?? (r.uri ? Capacitor.convertFileSrc(r.uri) : undefined);
    if (ruta) return await (await fetch(ruta)).blob();
    if (r.thumbnail) return base64ABlob(r.thumbnail, "image/jpeg");
    return null;
  } catch (e) {
    if (esCancelacion(e)) return null;
    throw new Error(`No se pudo tomar la foto: ${mensajeDe(e)}`);
  }
}

function esCancelacion(e: unknown): boolean {
  const m = mensajeDe(e).toLowerCase();
  return m.includes("cancel") || m.includes("no image picked") || m.includes("dismiss");
}

/** En la web: input file con `capture` (en el teléfono abre la cámara; en el PC, el selector de archivos). */
function fotoWeb(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    let terminado = false;
    const terminar = (b: Blob | null) => {
      if (terminado) return;
      terminado = true;
      window.removeEventListener("focus", alVolver);
      input.remove();
      resolve(b);
    };
    input.addEventListener("change", () => terminar(input.files?.[0] ?? null));
    // Evento «cancel» (Chrome 113+, Safari 16.4+). Respaldo: al volver el foco sin archivo, se da por cancelado.
    input.addEventListener("cancel", () => terminar(null));
    const alVolver = () => setTimeout(() => { if (!input.files?.length) terminar(null); }, 1500);
    window.addEventListener("focus", alVolver);
    document.body.appendChild(input);
    input.click();
  });
}

/** Reduce la imagen a un máximo de 1600 px de lado y la recodifica como JPEG 0,8. */
async function comprimirImagen(original: Blob): Promise<Blob> {
  try {
    const fuente = await cargarImagen(original);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(fuente.ancho, fuente.alto));
    const ancho = Math.max(1, Math.round(fuente.ancho * escala));
    const alto = Math.max(1, Math.round(fuente.alto * escala));
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.fillStyle = "#ffffff"; // fondo blanco por si la imagen trae transparencia (PNG)
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(fuente.dibujable, 0, 0, ancho, alto);
    fuente.liberar();
    const jpeg = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", CALIDAD_JPEG));
    return jpeg ?? original;
  } catch {
    return original; // formato que el navegador no decodifica (p. ej. HEIC): se guarda tal cual
  }
}

interface ImagenCargada {
  dibujable: CanvasImageSource;
  ancho: number;
  alto: number;
  liberar: () => void;
}

async function cargarImagen(b: Blob): Promise<ImagenCargada> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" respeta la orientación EXIF (fotos verticales del teléfono).
      const bmp = await createImageBitmap(b, { imageOrientation: "from-image" });
      return { dibujable: bmp, ancho: bmp.width, alto: bmp.height, liberar: () => bmp.close() };
    } catch { /* se intenta con <img> */ }
  }
  const url = URL.createObjectURL(b);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return { dibujable: img, ancho: img.naturalWidth, alto: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) };
}

// ───────────────────────── Ubicación ─────────────────────────

/** Ubicación actual; null si no hay permiso o no responde en ~8 s. */
export async function obtenerUbicacion(): Promise<Ubicacion | null> {
  if (!enNavegador()) return null;
  return conLimite(esNativo() ? ubicacionNativa() : ubicacionWeb(), ESPERA_UBICACION_MS + 500, null);
}

async function ubicacionNativa(): Promise<Ubicacion | null> {
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    let permiso = await Geolocation.checkPermissions();
    if (permiso.location !== "granted" && permiso.coarseLocation !== "granted") {
      permiso = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
      if (permiso.location !== "granted" && permiso.coarseLocation !== "granted") return null;
    }
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: ESPERA_UBICACION_MS, maximumAge: 30000 });
    return { latitud: p.coords.latitude, longitud: p.coords.longitude, precision: p.coords.accuracy };
  } catch {
    return null; // sin permiso, GPS apagado o sin respuesta
  }
}

function ubicacionWeb(): Promise<Ubicacion | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitud: p.coords.latitude, longitud: p.coords.longitude, precision: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: ESPERA_UBICACION_MS, maximumAge: 30000 },
    );
  });
}

// ───────────────────────── Dictado ─────────────────────────

/** ¿Este dispositivo puede dictar por voz? */
export async function puedeDictar(): Promise<boolean> {
  if (!enNavegador()) return false;
  if (esNativo()) {
    try {
      const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
      return (await SpeechRecognition.available()).available;
    } catch {
      return false;
    }
  }
  return Boolean(reconocedorWeb());
}

// Dictado en curso (solo uno a la vez).
let detenerActual: (() => Promise<void>) | null = null;

/**
 * Dicta en español (es-CL). `alParcial` recibe el texto mientras se habla.
 * Devuelve el texto final, o null si se cancela o no hay permiso.
 */
export async function dictar(alParcial?: (texto: string) => void): Promise<string | null> {
  if (!enNavegador()) return null;
  if (detenerActual) await detenerDictado();
  return esNativo() ? dictarNativo(alParcial) : dictarWeb(alParcial);
}

/** Detiene un dictado en curso. */
export async function detenerDictado(): Promise<void> {
  const f = detenerActual;
  detenerActual = null;
  if (f) await f().catch(() => undefined);
}

async function dictarNativo(alParcial?: (texto: string) => void): Promise<string | null> {
  const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
  try {
    if (!(await SpeechRecognition.available()).available) return null;
    let permiso = await SpeechRecognition.checkPermissions();
    if (permiso.speechRecognition !== "granted") permiso = await SpeechRecognition.requestPermissions();
    if (permiso.speechRecognition !== "granted") return null;
  } catch {
    return null;
  }

  return new Promise<string | null>((resolve) => {
    let ultimo = "";
    let terminado = false;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const terminar = async () => {
      if (terminado) return;
      terminado = true;
      if (espera) clearTimeout(espera);
      detenerActual = null;
      await SpeechRecognition.removeAllListeners().catch(() => undefined);
      const t = ultimo.trim();
      resolve(t ? t : null);
    };
    // En Android, con resultados parciales, start() responde de inmediato: el texto llega por eventos
    // («partialResults», incluido el final) y el fin, por «listeningState». El resultado final puede
    // llegar un instante después del fin, por eso se espera un margen breve antes de cerrar.
    const cerrarConMargen = () => {
      if (espera) clearTimeout(espera);
      espera = setTimeout(() => void terminar(), 900);
    };
    void SpeechRecognition.addListener("partialResults", (d) => {
      const t = d.matches?.[0];
      if (t) {
        ultimo = t;
        alParcial?.(t);
      }
    });
    void SpeechRecognition.addListener("listeningState", (d) => {
      if (d.status === "stopped") cerrarConMargen();
    });
    detenerActual = async () => {
      await SpeechRecognition.stop().catch(() => undefined);
      cerrarConMargen();
    };
    SpeechRecognition.start({ language: IDIOMA_DICTADO, maxResults: 1, partialResults: true, popup: false })
      .catch(() => cerrarConMargen()); // «No match», «busy», sin red, etc.: se entrega lo que haya
  });
}

interface ReconocedorWeb {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function reconocedorWeb(): (new () => ReconocedorWeb) | null {
  const w = window as unknown as { SpeechRecognition?: new () => ReconocedorWeb; webkitSpeechRecognition?: new () => ReconocedorWeb };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function dictarWeb(alParcial?: (texto: string) => void): Promise<string | null> {
  const Clase = reconocedorWeb();
  if (!Clase) return Promise.resolve(null);
  return new Promise((resolve) => {
    const rec = new Clase();
    rec.lang = IDIOMA_DICTADO;
    rec.continuous = true; // sigue escuchando hasta que el inspector toque «detener»
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let final = "";
    let cancelado = false;
    rec.onresult = (e) => {
      let parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final = unir(final, r[0].transcript);
        else parcial = unir(parcial, r[0].transcript);
      }
      alParcial?.(unir(final, parcial));
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") cancelado = true;
    };
    rec.onend = () => {
      if (detenerActual === parar) detenerActual = null;
      const t = final.trim();
      resolve(cancelado || !t ? null : t);
    };
    const parar = async () => rec.stop();
    detenerActual = parar;
    try {
      rec.start();
    } catch {
      detenerActual = null;
      resolve(null);
    }
  });
}

const unir = (a: string, b: string) => [a.trim(), b.trim()].filter(Boolean).join(" ");

// ───────────────────────── Red ─────────────────────────

/** ¿Hay conexión a internet ahora? */
export async function hayRed(): Promise<boolean> {
  if (!enNavegador()) return true;
  if (esNativo()) {
    try {
      const { Network } = await import("@capacitor/network");
      return (await Network.getStatus()).connected;
    } catch { /* se usa la del navegador */ }
  }
  return navigator.onLine;
}

/** Avisa cada cambio de conexión. Devuelve la función para dejar de escuchar. */
export function alCambiarRed(fn: (conectado: boolean) => void): () => void {
  if (!enNavegador()) return () => undefined;
  if (esNativo()) {
    let activo = true;
    let quitar: (() => void) | null = null;
    void import("@capacitor/network").then(({ Network }) =>
      Network.addListener("networkStatusChange", (s) => { if (activo) fn(s.connected); }).then((h) => {
        if (activo) quitar = () => void h.remove();
        else void h.remove();
      }),
    );
    return () => {
      activo = false;
      quitar?.();
    };
  }
  const on = () => fn(true), off = () => fn(false);
  window.addEventListener("online", on);
  window.addEventListener("offline", off);
  return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
}

// ───────────────────────── PDF ─────────────────────────

/** Guarda o comparte el PDF (en el APK lo deja en Documentos; en la web lo descarga). */
export async function guardarPdf(pdf: Blob, nombre: string): Promise<void> {
  if (!enNavegador()) return;
  const archivo = nombreSeguro(nombre);
  if (esNativo()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const data = await blobABase64(pdf);
    try {
      // Carpeta pública «Documentos/Bitacora ITO» (visible en la app Archivos del teléfono).
      await Filesystem.writeFile({ path: `Bitacora ITO/${archivo}`, data, directory: Directory.Documents, recursive: true });
    } catch {
      // Algunos Android no dejan escribir en Documentos: se usa la carpeta externa propia de la app.
      await Filesystem.writeFile({ path: `Documentos/${archivo}`, data, directory: Directory.External, recursive: true });
    }
    return;
  }
  const url = URL.createObjectURL(pdf);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function nombreSeguro(nombre: string): string {
  const limpio = nombre.replace(/[\\/:*?"<>|]+/g, "-").trim() || "reporte";
  return /\.pdf$/i.test(limpio) ? limpio : `${limpio}.pdf`;
}

// ───────────────────────── Utilidades ─────────────────────────

/** Contenido de un Blob en base64 (sin el prefijo data:). */
export function blobABase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      const s = String(lector.result ?? "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    lector.onerror = () => reject(lector.error ?? new Error("No se pudo leer el archivo."));
    lector.readAsDataURL(b);
  });
}

function base64ABlob(b64: string, tipo: string): Blob {
  const limpio = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(limpio);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

function conLimite<T>(p: Promise<T>, ms: number, porDefecto: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(porDefecto), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(porDefecto); });
  });
}

function mensajeDe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

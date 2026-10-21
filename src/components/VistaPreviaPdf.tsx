"use client";
// Muestra un PDF página por página con pdf.js: canvas nítido según devicePixelRatio, ajustado al
// ancho, paginador «‹ 1 / 2 ›», acercar/alejar (botones y pellizco) y deslizamiento lateral para
// cambiar de página. pdf.js se carga con import dinámico dentro de useEffect: nada corre en SSR.
// El worker sale de /pdf.worker.min.mjs (copiado de pdfjs-dist/build) y se crea desde un Blob, así
// funciona aunque el WebView de Android no sirva .mjs con el tipo MIME de JavaScript.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import e from "./VistaPreviaPdf.module.css";

export interface VistaPreviaPdfProps {
  pdf: Blob;
  /** Avisa la página visible y el total, para el indicador «Pág. 1 de 2». */
  alCambiarPagina?: (pagina: number, total: number) => void;
}

type PdfJs = typeof import("pdfjs-dist");

const RUTA_WORKER = "/pdf.worker.min.mjs";
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const PASOS_ZOOM = [1, 1.5, 2, 3, 4];
/** Tope de píxeles del canvas (los WebView antiguos fallan con lienzos enormes). */
const MAX_PIXELES = 16_000_000;

let pdfjsPromesa: Promise<PdfJs> | null = null;

/** Carga pdf.js una sola vez y deja listo su worker. */
function cargarPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromesa) {
    pdfjsPromesa = (async () => {
      const pdfjs = await import("pdfjs-dist");
      try {
        const r = await fetch(RUTA_WORKER);
        if (!r.ok) throw new Error(String(r.status));
        const codigo = await r.blob();
        const url = URL.createObjectURL(new Blob([codigo], { type: "text/javascript" }));
        pdfjs.GlobalWorkerOptions.workerPort = new Worker(url, { type: "module" });
      } catch {
        // Sin Blob/Worker de módulo: pdf.js usa la ruta directamente.
        pdfjs.GlobalWorkerOptions.workerSrc = RUTA_WORKER;
      }
      return pdfjs;
    })();
    pdfjsPromesa.catch(() => {
      pdfjsPromesa = null;
    });
  }
  return pdfjsPromesa;
}

const limitar = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export default function VistaPreviaPdf({ pdf, alCambiarPagina }: VistaPreviaPdfProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [ancho, setAncho] = useState(0);
  const [error, setError] = useState<string>();
  const [renderizando, setRenderizando] = useState(true);

  const marcoRef = useRef<HTMLDivElement>(null);
  const hojaRef = useRef<HTMLDivElement>(null);
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const tareaRef = useRef<RenderTask | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const totalRef = useRef(total);
  totalRef.current = total;

  // 1. Cargar el documento cada vez que cambia el Blob.
  useEffect(() => {
    let vivo = true;
    let tareaCarga: ReturnType<PdfJs["getDocument"]> | null = null;
    setError(undefined);
    setDoc(null);
    setRenderizando(true);
    (async () => {
      try {
        const pdfjs = await cargarPdfJs();
        const datos = new Uint8Array(await pdf.arrayBuffer());
        if (!vivo) return;
        tareaCarga = pdfjs.getDocument({ data: datos });
        const d = await tareaCarga.promise;
        if (!vivo) return;
        setDoc(d);
        setTotal(d.numPages);
        setPagina(1);
        setZoom(1);
      } catch (err) {
        if (vivo) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      vivo = false;
      tareaRef.current?.cancel();
      tareaCarga?.destroy(); // libera el documento y su memoria en el worker
    };
  }, [pdf]);

  // 2. Medir el ancho disponible (y seguirlo al girar el teléfono).
  useEffect(() => {
    const marco = marcoRef.current;
    if (!marco) return;
    const medir = () => setAncho(marco.clientWidth);
    medir();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", medir);
      return () => window.removeEventListener("resize", medir);
    }
    const ro = new ResizeObserver(medir);
    ro.observe(marco);
    return () => ro.disconnect();
  }, []);

  // 3. Avisar la página visible.
  useEffect(() => {
    if (total > 0) alCambiarPagina?.(pagina, total);
  }, [pagina, total, alCambiarPagina]);

  // 4. Dibujar la página actual con la nitidez de la pantalla.
  useEffect(() => {
    const lienzo = lienzoRef.current;
    if (!doc || !lienzo || ancho <= 0) return;
    let vivo = true;
    (async () => {
      try {
        setRenderizando(true);
        const pag = await doc.getPage(pagina);
        if (!vivo) return;
        const base = pag.getViewport({ scale: 1 });
        const anchoCss = Math.max(1, ancho - 24) * zoom; // 12 px de aire a cada lado
        const escalaCss = anchoCss / base.width;
        const vista = pag.getViewport({ scale: escalaCss });
        let dpr = window.devicePixelRatio || 1;
        const pixeles = vista.width * vista.height * dpr * dpr;
        if (pixeles > MAX_PIXELES) dpr *= Math.sqrt(MAX_PIXELES / pixeles);

        // Se dibuja en un canvas aparte y se copia al final: no parpadea al cambiar el zoom.
        const tmp = document.createElement("canvas");
        tmp.width = Math.floor(vista.width * dpr);
        tmp.height = Math.floor(vista.height * dpr);
        tareaRef.current?.cancel();
        const tarea = pag.render({
          canvas: tmp,
          viewport: vista,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
          background: "#ffffff",
        });
        tareaRef.current = tarea;
        await tarea.promise;
        if (!vivo) return;
        lienzo.width = tmp.width;
        lienzo.height = tmp.height;
        lienzo.style.width = `${Math.floor(vista.width)}px`;
        lienzo.style.height = `${Math.floor(vista.height)}px`;
        lienzo.getContext("2d")?.drawImage(tmp, 0, 0);
        if (hojaRef.current) hojaRef.current.style.transform = "";
        setRenderizando(false);
      } catch (err) {
        if (!vivo) return;
        const nombre = (err as { name?: string })?.name;
        if (nombre !== "RenderingCancelledException") setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [doc, pagina, zoom, ancho]);

  const irA = useCallback((n: number) => setPagina((p) => (total ? Math.min(total, Math.max(1, n)) : p)), [total]);

  const cambiarZoom = useCallback((dir: 1 | -1) => {
    setZoom((z) => {
      const siguiente = dir > 0 ? PASOS_ZOOM.find((p) => p > z + 0.01) : [...PASOS_ZOOM].reverse().find((p) => p < z - 0.01);
      return siguiente ?? z;
    });
  }, []);

  // 5. Gestos: pellizco para acercar y deslizamiento lateral para cambiar de página (sin zoom).
  //    Los listeners van con passive:false para poder anular el zoom nativo del WebView al pellizcar.
  useEffect(() => {
    const marco = marcoRef.current;
    if (!marco) return;
    let inicio: { x: number; y: number; t: number } | null = null;
    let pellizco: { d0: number; z0: number; escala: number } | null = null;
    const distancia = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const alTocar = (ev: TouchEvent) => {
      if (ev.touches.length === 2) {
        pellizco = { d0: distancia(ev.touches), z0: zoomRef.current, escala: 1 };
        inicio = null;
      } else if (ev.touches.length === 1 && !pellizco) {
        inicio = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, t: Date.now() };
      }
    };
    const alMover = (ev: TouchEvent) => {
      if (pellizco && ev.touches.length === 2) {
        ev.preventDefault();
        const z = limitar(pellizco.z0 * (distancia(ev.touches) / pellizco.d0));
        pellizco.escala = z / zoomRef.current;
        if (hojaRef.current) hojaRef.current.style.transform = `scale(${pellizco.escala})`;
      }
    };
    const alSoltar = (ev: TouchEvent) => {
      if (pellizco) {
        if (ev.touches.length < 2) {
          const z = limitar(zoomRef.current * pellizco.escala);
          pellizco = null;
          if (Math.abs(z - zoomRef.current) < 0.02) {
            if (hojaRef.current) hojaRef.current.style.transform = "";
          } else setZoom(Math.round(z * 100) / 100);
        }
        return;
      }
      if (!inicio || zoomRef.current > 1.01) return;
      const t = ev.changedTouches[0];
      const dx = t.clientX - inicio.x;
      const dy = t.clientY - inicio.y;
      const rapido = Date.now() - inicio.t < 700;
      inicio = null;
      if (rapido && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        setPagina((p) => Math.min(Math.max(1, p + (dx < 0 ? 1 : -1)), Math.max(1, totalRef.current)));
      }
    };
    marco.addEventListener("touchstart", alTocar, { passive: true });
    marco.addEventListener("touchmove", alMover, { passive: false });
    marco.addEventListener("touchend", alSoltar, { passive: true });
    marco.addEventListener("touchcancel", alSoltar, { passive: true });
    return () => {
      marco.removeEventListener("touchstart", alTocar);
      marco.removeEventListener("touchmove", alMover);
      marco.removeEventListener("touchend", alSoltar);
      marco.removeEventListener("touchcancel", alSoltar);
    };
  }, []);
  const alTeclado = (ev: KeyboardEvent) => {
    if (ev.key === "ArrowRight" || ev.key === "PageDown") irA(pagina + 1);
    else if (ev.key === "ArrowLeft" || ev.key === "PageUp") irA(pagina - 1);
    else if (ev.key === "+" || ev.key === "=") cambiarZoom(1);
    else if (ev.key === "-") cambiarZoom(-1);
    else return;
    ev.preventDefault();
  };

  return (
    <div className={e.visor}>
      <div
        ref={marcoRef}
        className={`${e.marco} ${zoom > 1.01 ? e.conZoom : ""}`}
        tabIndex={0}
        onKeyDown={alTeclado}
        aria-label={total ? `Vista previa del PDF, página ${pagina} de ${total}` : "Vista previa del PDF"}
      >
        <div ref={hojaRef} className={e.hoja}>
          <canvas ref={lienzoRef} className={e.lienzo} role="img" aria-label={`Página ${pagina}`} />
          {renderizando && !error ? <div className={e.cargando} aria-hidden="true" /> : null}
        </div>
        {error ? <p className={e.error}>No se pudo mostrar el PDF: {error}</p> : null}
      </div>

      <div className={e.barra}>
        <div className={e.paginador} role="group" aria-label="Páginas">
          <button type="button" className={e.boton} onClick={() => irA(pagina - 1)} disabled={pagina <= 1} aria-label="Página anterior">
            ‹
          </button>
          <span className={e.indicador} aria-live="polite">
            {total ? `${pagina} / ${total}` : "–"}
          </span>
          <button type="button" className={e.boton} onClick={() => irA(pagina + 1)} disabled={!total || pagina >= total} aria-label="Página siguiente">
            ›
          </button>
        </div>
        <div className={e.paginador} role="group" aria-label="Zoom">
          <button type="button" className={e.boton} onClick={() => cambiarZoom(-1)} disabled={zoom <= ZOOM_MIN + 0.01} aria-label="Alejar">
            −
          </button>
          <button type="button" className={`${e.boton} ${e.botonZoom}`} onClick={() => setZoom(1)} disabled={zoom <= ZOOM_MIN + 0.01} aria-label="Ajustar al ancho">
            {Math.round(zoom * 100)} %
          </button>
          <button type="button" className={e.boton} onClick={() => cambiarZoom(1)} disabled={zoom >= ZOOM_MAX - 0.01} aria-label="Acercar">
            +
          </button>
        </div>
      </div>
    </div>
  );
}

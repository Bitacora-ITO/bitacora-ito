"use client";
// Arranque de la app: siembra los datos de demostración, crea el reporte de hoy (regla 1),
// procesa la cola de envíos, sincroniza y vuelve a intentarlo cada vez que vuelve la señal.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sembrarSiFalta } from "@/lib/seed";
import { asegurarReporteHoy, obtenerContexto, type Contexto } from "@/lib/repositorio";
import { alCambiarRed, hayRed } from "@/lib/nativo";
import { procesarCola } from "@/lib/envio";
import { contarPendientes, sincronizar } from "@/lib/sync";
import { Cargando } from "./ui";
import s from "./ui.module.css";

interface EstadoApp {
  contexto: Contexto;
  reporteHoyId: string;
  conectado: boolean;
  pendientes: number;
  ultimaSync?: string;
  errorSync?: string;
  sincronizando: boolean;
  /** Sube lo pendiente y reintenta la cola (no bloquea; los errores quedan en `errorSync`). */
  refrescar: () => void;
  /** Vuelve a leer usuario, contrato y reporte de hoy (tras reiniciar o cambiar ajustes). */
  recargar: () => Promise<void>;
}

const Ctx = createContext<EstadoApp | null>(null);

const RUTAS = ["/", "/registrar", "/alerta", "/borrador", "/vista-previa", "/enviar", "/agregar-area", "/historial", "/historial/dia", "/historial/inicio"];

export function useApp(): EstadoApp {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp fuera del proveedor");
  return v;
}

export default function Proveedor({ children }: { children: React.ReactNode }) {
  const [base, setBase] = useState<{ contexto: Contexto; reporteHoyId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conectado, setConectado] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const [ultimaSync, setUltimaSync] = useState<string>();
  const [errorSync, setErrorSync] = useState<string>();
  const [sincronizando, setSincronizando] = useState(false);
  const corriendo = useRef(false);
  const router = useRouter();

  // Deja precargadas las pantallas para poder navegar si se corta la señal (en el APK ya son locales).
  useEffect(() => {
    if (!base) return;
    for (const r of RUTAS) { try { router.prefetch(r); } catch { /* sin precarga */ } }
  }, [base, router]);

  const recargar = useCallback(async () => {
    await sembrarSiFalta();
    const reporte = await asegurarReporteHoy();
    const contexto = await obtenerContexto();
    setBase({ contexto, reporteHoyId: reporte.id });
  }, []);

  const refrescar = useCallback(() => {
    if (corriendo.current) return;
    corriendo.current = true;
    setSincronizando(true);
    (async () => {
      try {
        const red = await hayRed().catch(() => navigator.onLine);
        setConectado(red);
        if (red) {
          await procesarCola().catch((e) => setErrorSync(mensaje(e)));
          const r = await sincronizar();
          setErrorSync(r.error);
          if (r.ultimaSync) setUltimaSync(r.ultimaSync);
          else if (!r.error && r.pendientes === 0) setUltimaSync(new Date().toISOString());
        }
        setPendientes(await contarPendientes());
      } catch (e) {
        setErrorSync(mensaje(e));
      } finally {
        corriendo.current = false;
        setSincronizando(false);
      }
    })();
  }, []);

  useEffect(() => {
    let vivo = true;
    recargar()
      .then(() => vivo && refrescar())
      .catch((e) => vivo && setError(mensaje(e)));
    let quitar: (() => void) | undefined;
    try {
      quitar = alCambiarRed((c) => {
        setConectado(c);
        if (c) refrescar();
      });
    } catch { /* sin aviso de red: se reintenta al volver a la app */ }
    // Si la app queda abierta y cambia el día, se crea el reporte nuevo al volver a ella.
    const alVolver = () => {
      if (document.visibilityState === "visible") recargar().then(refrescar).catch(() => {});
    };
    document.addEventListener("visibilitychange", alVolver);
    const reloj = window.setInterval(() => contarPendientes().then(setPendientes).catch(() => {}), 30_000);
    return () => {
      vivo = false;
      quitar?.();
      document.removeEventListener("visibilitychange", alVolver);
      window.clearInterval(reloj);
    };
  }, [recargar, refrescar]);

  if (error) {
    return (
      <main className={s.pantalla}>
        <div className={s.centro}>
          <p className={s.tituloEstado}>No se pudo abrir la base local</p>
          <p className={s.textoSuave}>{error}</p>
          <button className={s.botonSecundario} onClick={() => location.reload()}>Reintentar</button>
        </div>
      </main>
    );
  }
  if (!base) return <Cargando texto="Preparando el turno…" />;

  return (
    <Ctx.Provider value={{ ...base, conectado, pendientes, ultimaSync, errorSync, sincronizando, refrescar, recargar }}>
      {children}
    </Ctx.Provider>
  );
}

export function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

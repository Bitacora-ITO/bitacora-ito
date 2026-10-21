"use client";
// Piezas de interfaz comunes a todas las pantallas.
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import s from "./ui.module.css";
import { IcoAlerta, IcoAtras, IcoCerrar } from "./iconos";
import { useUrlObjeto } from "@/hooks/useUrlObjeto";

export { s as estilos };

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Pantalla({ children, pie }: { children: ReactNode; pie?: ReactNode }) {
  return (
    <main className={s.pantalla}>
      <div className={s.cuerpo}>{children}</div>
      {pie && <div className={s.pie}>{pie}</div>}
    </main>
  );
}

export function Encabezado({ volver, titulo, derecha }: {
  volver?: { texto: string; href?: string; onClick?: () => void };
  titulo?: string;
  derecha?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className={s.encabezado}>
      <div>
        {volver && (
          <button
            className={s.volver}
            onClick={() => (volver.onClick ? volver.onClick() : router.push(volver.href ?? "/"))}
            aria-label={`Volver a ${volver.texto}`}
          >
            <IcoAtras size={22} /> {volver.texto}
          </button>
        )}
      </div>
      <h1 className={s.tituloBarra}>{titulo}</h1>
      <div className={s.derechaBarra}>{derecha}</div>
    </header>
  );
}

export function Etiqueta({ children, obligatorio, derecha, htmlFor }: {
  children: ReactNode; obligatorio?: boolean; derecha?: ReactNode; htmlFor?: string;
}) {
  return (
    <label className={s.etiqueta} htmlFor={htmlFor}>
      <span>{children}{obligatorio && <span className={s.asterisco}>*</span>}</span>
      {derecha && <small>{derecha}</small>}
    </label>
  );
}

export function MensajeError({ children }: { children: ReactNode }) {
  return <p className={s.textoError} role="alert"><IcoAlerta size={16} /> {children}</p>;
}

export function Segmentado<T extends string>({ opciones, valor, onChange, deshabilitado, etiqueta }: {
  opciones: { valor: T; etiqueta: string }[];
  valor: T | undefined;
  onChange: (v: T) => void;
  deshabilitado?: boolean;
  etiqueta: string;
}) {
  return (
    <div className={s.segmentado} role="radiogroup" aria-label={etiqueta} aria-disabled={deshabilitado || undefined}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          className={cx(s.segmento, valor === o.valor && s.segmentoActivo)}
          onClick={() => onChange(o.valor)}
          disabled={deshabilitado}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

export type Tono = "teal" | "ambar" | "gris" | "rojo" | "verde";

export function Chip({ tono, children }: { tono: Tono; children: ReactNode }) {
  return <span className={cx(s.chip, s[`chip_${tono}`])}>{children}</span>;
}

export function Aviso({ tono, icono, titulo, children }: { tono: "rojo" | "ambar" | "gris" | "verde"; icono?: ReactNode; titulo?: ReactNode; children?: ReactNode }) {
  return (
    <div className={cx(s.aviso, s[`aviso_${tono}`])} role={tono === "rojo" ? "alert" : "status"}>
      {icono}
      <div>{titulo && <b>{titulo}</b>}{children}</div>
    </div>
  );
}

export function Giro({ chico }: { chico?: boolean }) {
  return <span className={cx(s.giro, chico && s.giroChico)} aria-hidden="true" style={{ display: "inline-block" }} />;
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <main className={s.pantalla}>
      <div className={s.centro} role="status">
        <Giro />
        <p className={s.textoSuave}>{texto}</p>
      </div>
    </main>
  );
}

export function Interruptor({ titulo, detalle, activo, onChange, deshabilitado }: {
  titulo: string; detalle?: string; activo: boolean; onChange: (v: boolean) => void; deshabilitado?: boolean;
}) {
  return (
    <label className={cx(s.interruptor, deshabilitado && s.atenuado)}>
      <span style={{ flex: 1 }}>
        <b style={{ display: "block", fontSize: 15 }}>{titulo}</b>
        {detalle && <span className={s.textoSuave}>{detalle}</span>}
      </span>
      <input type="checkbox" role="switch" checked={activo} onChange={(e) => onChange(e.target.checked)} disabled={deshabilitado} />
      <span className={s.pista} />
    </label>
  );
}

export function Miniatura({ blob, alt, onQuitar }: { blob: Blob; alt: string; onQuitar?: () => void }) {
  const url = useUrlObjeto(blob);
  return (
    <div className={s.foto}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={alt} />}
      {onQuitar && (
        <button type="button" className={s.quitarFoto} onClick={onQuitar} aria-label={`Quitar ${alt}`}>
          <IcoCerrar size={16} />
        </button>
      )}
    </div>
  );
}

export function HojaInferior({ titulo, children, onCerrar }: { titulo: string; children: ReactNode; onCerrar: () => void }) {
  return (
    <div className={s.velo} onClick={onCerrar}>
      <div className={s.hoja} role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className={s.hojaTitulo}>
          <span>{titulo}</span>
          <button className={s.botonIcono} onClick={onCerrar} aria-label="Cerrar"><IcoCerrar /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EnlaceBoton({ href, children, secundario }: { href: string; children: ReactNode; secundario?: boolean }) {
  return <Link href={href} className={secundario ? s.botonSecundario : s.botonPrimario}>{children}</Link>;
}

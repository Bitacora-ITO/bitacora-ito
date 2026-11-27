"use client";
// Fotografías del registro o de la alerta: «Tomar fotografía» y, con fotos, la grilla con «Otra foto».
import { useState } from "react";
import { tomarFoto, type FotoCapturada } from "@/lib/nativo";
import { cx, Giro, MensajeError, Miniatura, estilos as s } from "./ui";
import { IcoCamara } from "./iconos";

export default function SelectorFotos({ fotos, onChange, error, deshabilitado, etiquetaFoto = "foto", maximo }: {
  fotos: FotoCapturada[];
  onChange: (f: FotoCapturada[]) => void;
  error?: string;
  deshabilitado?: boolean;
  etiquetaFoto?: string;
  /** Tope de fotos (solo el registro de avance lo usa). Al llegar, «Otra foto» se desactiva antes de abrir la cámara. */
  maximo?: number;
}) {
  const [abriendo, setAbriendo] = useState(false);
  const [falla, setFalla] = useState<string>();

  const lleno = maximo !== undefined && fotos.length >= maximo;

  async function tomar() {
    if (lleno) return;
    setFalla(undefined);
    setAbriendo(true);
    try {
      const f = await tomarFoto();
      if (f) onChange([...fotos, f]);
    } catch (e) {
      console.warn("Cámara:", e);
      setFalla("No se pudo abrir la cámara. Revisa el permiso de cámara e intenta de nuevo.");
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <>
      {fotos.length === 0 ? (
        <button type="button" className={cx(s.tomarFoto, error && s.tomarFotoError)} onClick={tomar} disabled={deshabilitado || abriendo}>
          {abriendo ? <Giro chico /> : <IcoCamara size={26} />}
          {abriendo ? "Abriendo cámara…" : "Tomar fotografía"}
        </button>
      ) : (
        <div className={s.fotos}>
          {fotos.map((f, i) => (
            <Miniatura key={i} blob={f.imagen} alt={`${etiquetaFoto} ${i + 1}`}
              onQuitar={deshabilitado ? undefined : () => onChange(fotos.filter((_, k) => k !== i))} />
          ))}
          <button type="button" className={cx(s.tomarFoto, s.tomarFotoChico)} onClick={tomar} disabled={deshabilitado || abriendo || lleno}>
            {abriendo ? <Giro chico /> : <IcoCamara />}
            {lleno ? `${fotos.length} de ${maximo} fotos` : "Otra foto"}
          </button>
        </div>
      )}
      {maximo !== undefined && fotos.length > 0 && (
        <p className={s.textoSuave} style={{ margin: 0, fontSize: 13 }}>
          {lleno ? `Llegaste al máximo de ${maximo} fotos. Quita una para tomar otra.` : `${fotos.length} de ${maximo} fotos`}
        </p>
      )}
      {error && <MensajeError>{error}</MensajeError>}
      {falla && <MensajeError>{falla}</MensajeError>}
    </>
  );
}

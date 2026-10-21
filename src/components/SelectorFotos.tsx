"use client";
// Fotografías del registro o de la alerta: «Tomar fotografía» y, con fotos, la grilla con «Otra foto».
import { useState } from "react";
import { tomarFoto, type FotoCapturada } from "@/lib/nativo";
import { cx, Giro, MensajeError, Miniatura, estilos as s } from "./ui";
import { IcoCamara } from "./iconos";

export default function SelectorFotos({ fotos, onChange, error, deshabilitado, etiquetaFoto = "foto" }: {
  fotos: FotoCapturada[];
  onChange: (f: FotoCapturada[]) => void;
  error?: string;
  deshabilitado?: boolean;
  etiquetaFoto?: string;
}) {
  const [abriendo, setAbriendo] = useState(false);
  const [falla, setFalla] = useState<string>();

  async function tomar() {
    setFalla(undefined);
    setAbriendo(true);
    try {
      const f = await tomarFoto();
      if (f) onChange([...fotos, f]);
    } catch (e) {
      setFalla(`No se pudo abrir la cámara: ${e instanceof Error ? e.message : String(e)}`);
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
          <button type="button" className={cx(s.tomarFoto, s.tomarFotoChico)} onClick={tomar} disabled={deshabilitado || abriendo}>
            {abriendo ? <Giro chico /> : <IcoCamara />}
            Otra foto
          </button>
        </div>
      )}
      {error && <MensajeError>{error}</MensajeError>}
      {falla && <MensajeError>{falla}</MensajeError>}
    </>
  );
}

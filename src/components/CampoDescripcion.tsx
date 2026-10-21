"use client";
// Descripción dictada o escrita, con «Repetir dictado» (HU-02, dictado defectuoso por ruido de faena).
import { useEffect, useRef, useState } from "react";
import { detenerDictado, dictar, puedeDictar } from "@/lib/nativo";
import { cx, MensajeError, Segmentado, estilos as s } from "./ui";
import { IcoMicrofono } from "./iconos";

export type Origen = "dictado" | "escrito";

export default function CampoDescripcion({ id, valor, onChange, origen, onOrigen, error, deshabilitado, placeholder, mostrarSelector = true }: {
  id: string;
  valor: string;
  onChange: (v: string) => void;
  origen: Origen;
  onOrigen: (o: Origen) => void;
  error?: string;
  deshabilitado?: boolean;
  placeholder?: string;
  mostrarSelector?: boolean;
}) {
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [escuchando, setEscuchando] = useState(false);
  const [aviso, setAviso] = useState<string>();
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    puedeDictar().then(setDisponible).catch(() => setDisponible(false));
    return () => { detenerDictado().catch(() => {}); };
  }, []);

  // El cuadro crece con el texto dictado o escrito.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(92, el.scrollHeight + 2)}px`;
  }, [valor]);

  async function iniciarDictado(reemplazar: boolean) {
    setAviso(undefined);
    onOrigen("dictado");
    if (disponible === false) {
      setAviso("El dictado por voz no está disponible en este dispositivo. Escribe la descripción.");
      onOrigen("escrito");
      area.current?.focus();
      return;
    }
    const base = reemplazar ? "" : valor.trim() ? `${valor.trim()}\n` : "";
    if (reemplazar) onChange("");
    setEscuchando(true);
    try {
      const texto = await dictar((parcial) => onChange(base + parcial));
      if (texto === null) {
        if (reemplazar || !valor) setAviso("No se recibió dictado. Vuelve a intentarlo o escribe la descripción.");
      } else {
        onChange(base + texto);
      }
    } catch (e) {
      setAviso(`No se pudo dictar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setEscuchando(false);
    }
  }

  async function parar() {
    await detenerDictado().catch(() => {});
    setEscuchando(false);
  }

  return (
    <>
      {mostrarSelector && (
        <Segmentado
          etiqueta="Origen de la descripción"
          opciones={[{ valor: "dictado", etiqueta: escuchando ? "Escuchando…" : "Dictar" }, { valor: "escrito", etiqueta: "Escribir" }]}
          valor={origen}
          deshabilitado={deshabilitado}
          onChange={(o) => {
            if (o === "dictado") { if (escuchando) parar(); else iniciarDictado(false); }
            else { if (escuchando) parar(); onOrigen("escrito"); setTimeout(() => area.current?.focus(), 0); }
          }}
        />
      )}
      <div style={{ position: "relative" }}>
        {!valor && !escuchando && (
          <span style={{ position: "absolute", left: 14, top: 13, color: "var(--gris)", display: "flex", gap: 8, pointerEvents: "none" }}>
            <IcoMicrofono size={20} /> {placeholder ?? "Toca Dictar y habla, o escribe."}
          </span>
        )}
        <textarea
          id={id}
          ref={area}
          className={cx(s.entrada, error && s.campoError)}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          disabled={deshabilitado}
          aria-invalid={!!error}
          rows={3}
        />
      </div>
      {escuchando && (
        <button type="button" className={`${s.botonSecundario} ${s.botonChico}`} onClick={parar}>
          <IcoMicrofono /> Escuchando… toca para terminar
        </button>
      )}
      {error && <MensajeError>{error}</MensajeError>}
      {aviso && <p className={s.textoSuave}>{aviso}</p>}
      {origen === "dictado" && valor && !escuchando && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className={s.textoSuave}>¿Se transcribió mal?</span>
          <button type="button" className={s.enlace} onClick={() => iniciarDictado(true)} disabled={deshabilitado}>Repetir dictado</button>
        </div>
      )}
    </>
  );
}

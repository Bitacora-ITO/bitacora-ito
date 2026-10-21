"use client";
// Calendario mensual de lunes a domingo, con celdas de 44 px.
import { celdasMes, INICIALES_SEMANA } from "@/lib/fechas";
import c from "./calendario.module.css";

export interface CeldaDia {
  clase: keyof typeof c | string;
  punto?: boolean;
  tocable: boolean;
  etiqueta: string;
}

export default function Calendario({ anio, mes0, celda, onTocar }: {
  anio: number;
  mes0: number;
  celda: (dia: string) => CeldaDia;
  onTocar: (dia: string) => void;
}) {
  const celdas = celdasMes(anio, mes0);
  return (
    <div className={c.grilla} role="grid">
      {INICIALES_SEMANA.map((d, i) => <span key={i} className={c.cabecera} aria-hidden="true">{d}</span>)}
      {celdas.map((dia, i) => {
        if (!dia) return <span key={i} />;
        const info = celda(dia);
        return (
          <button
            key={dia}
            type="button"
            className={`${c.dia} ${c[info.clase] ?? ""}`}
            disabled={!info.tocable}
            onClick={() => onTocar(dia)}
            aria-label={`${Number(dia.slice(8))}: ${info.etiqueta}`}
          >
            {Number(dia.slice(8))}
            {info.punto && <span className={c.punto} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

export { c as estilosCalendario };

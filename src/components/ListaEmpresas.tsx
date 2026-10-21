"use client";
// Lista de empresas del contrato con radio (06b).
import type { Empresa } from "@/lib/types";
import { TIPO_EMPRESA } from "@/lib/repositorio";
import l from "./listas.module.css";

export default function ListaEmpresas({ empresas, valor, onChange }: {
  empresas: Empresa[]; valor?: string; onChange: (id: string) => void;
}) {
  return (
    <div className={l.caja} role="radiogroup" aria-label="Empresa que ejecuta">
      {empresas.map((e) => (
        <button key={e.id} type="button" role="radio" aria-checked={valor === e.id}
          className={`${l.item} ${valor === e.id ? l.itemActivo : ""}`} onClick={() => onChange(e.id)}>
          <span className={`${l.radio} ${valor === e.id ? l.radioActivo : ""}`} aria-hidden="true" />
          <span className={l.texto}>
            <b>{e.nombre}</b>
            <small>{TIPO_EMPRESA[e.tipo]}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

"use client";
// Empresa del contrato: campo que abre la lista (radio) para cambiarla.
import { useState } from "react";
import type { Empresa } from "@/lib/types";
import { TIPO_EMPRESA } from "@/lib/repositorio";
import { cx, HojaInferior, MensajeError, estilos as s } from "./ui";
import { IcoEmpresa, IcoFlecha } from "./iconos";
import ListaEmpresas from "./ListaEmpresas";

export default function SelectorEmpresa({ empresas, valor, onChange, error, deshabilitado, opcional }: {
  empresas: Empresa[];
  valor?: string;
  onChange: (id: string | undefined) => void;
  error?: string;
  deshabilitado?: boolean;
  opcional?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const actual = empresas.find((e) => e.id === valor);
  return (
    <>
      <button type="button" className={cx(s.campo, error && s.campoError)} onClick={() => setAbierto(true)} disabled={deshabilitado}>
        <IcoEmpresa />
        <span className={s.crece} style={{ color: actual ? undefined : "var(--gris)", fontWeight: actual ? 600 : 400 }}>
          {actual ? actual.nombre : "Elige la empresa"}
        </span>
        <IcoFlecha className={s.filaFlecha} />
      </button>
      {error && <MensajeError>{error}</MensajeError>}
      {abierto && (
        <HojaInferior titulo="Empresa que ejecuta" onCerrar={() => setAbierto(false)}>
          <ListaEmpresas empresas={empresas} valor={valor} onChange={(id) => { onChange(id); setAbierto(false); }} />
          {opcional && valor && (
            <button className={`${s.botonSecundario} ${s.botonChico}`} onClick={() => { onChange(undefined); setAbierto(false); }}>
              Sin empresa
            </button>
          )}
        </HojaInferior>
      )}
    </>
  );
}

export function tipoEmpresa(e: Empresa) {
  return TIPO_EMPRESA[e.tipo];
}

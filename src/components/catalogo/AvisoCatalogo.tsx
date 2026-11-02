"use client";
// Aviso en P1 cuando el administrador publicó un catálogo nuevo: «Hay un catálogo nuevo · Actualizar».
// Lee las versiones local y remota de `ajustes` (las deja ahí `verificarCatalogo`, que corre al abrir
// la app y al volver la red) y descarga el catálogo al teléfono para trabajar sin señal.
import { useState } from "react";
import { db } from "@/lib/db";
import { CLAVES_CATALOGO, descargarCatalogo } from "@/lib/catalogo";
import { useConsulta } from "@/hooks/useConsulta";
import { mensaje, useApp } from "../Proveedor";
import { Aviso, Giro, MensajeError, estilos as s } from "../ui";
import { IcoDocumento } from "../iconos";

export default function AvisoCatalogo() {
  const { recargar, conectado } = useApp();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string>();
  const [listo, setListo] = useState<number>();

  const { datos } = useConsulta(async () => {
    const [l, r] = await Promise.all([db.ajustes.get(CLAVES_CATALOGO.versionLocal), db.ajustes.get(CLAVES_CATALOGO.versionRemota)]);
    return { local: Number(l?.valor ?? 0), remota: Number(r?.valor ?? 0) };
  }, []);

  async function actualizar() {
    setTrabajando(true); setError(undefined);
    try {
      const v = await descargarCatalogo();
      await recargar();
      setListo(v);
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setTrabajando(false);
    }
  }

  if (listo !== undefined && !(datos && datos.remota > datos.local)) {
    return <Aviso tono="verde" icono={<IcoDocumento />} titulo={`Catálogo actualizado · versión ${listo}`}>Ya puedes trabajar sin señal con las áreas, empresas y usuarios nuevos.</Aviso>;
  }
  if (!datos || datos.remota <= datos.local) return null;

  return (
    <>
      <Aviso tono="ambar" icono={<IcoDocumento />}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <b style={{ flex: 1, minWidth: 160 }}>Hay un catálogo nuevo</b>
          <button className={`${s.botonSecundario} ${s.botonChico}`} style={{ width: "auto", padding: "0 16px" }}
            onClick={actualizar} disabled={trabajando || !conectado} aria-label="Actualizar el catálogo">
            {trabajando ? <><Giro chico /> Actualizando…</> : "Actualizar"}
          </button>
        </div>
        <span className={s.textoSuave} style={{ fontSize: 13 }}>
          {conectado ? "Áreas, empresas o usuarios cambiaron. Lo registrado no se pierde." : "Se podrá actualizar al volver la señal."}
        </span>
      </Aviso>
      {error && <MensajeError>{error}</MensajeError>}
    </>
  );
}

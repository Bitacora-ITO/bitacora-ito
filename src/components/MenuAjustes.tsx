"use client";
// Ajustes de la demostración: quién usa el teléfono (y su rol), catálogo, destinatario del correo de prueba
// y reinicio de los datos.
import { useEffect, useState } from "react";
import Link from "next/link";
import { CLAVES, fijarDestinatarioPrueba, leerAjuste } from "@/lib/repositorio";
import { reiniciarDemostracion } from "@/lib/seed";
import { useSesion } from "@/lib/sesion";
import { CLAVES_CATALOGO } from "@/lib/catalogo";
import { mensaje, useApp } from "./Proveedor";
import { ListaIdentidades } from "./catalogo/ElegirIdentidad";
import { Aviso, Etiqueta, Giro, HojaInferior, MensajeError, estilos as s } from "./ui";
import { IcoDocumento } from "./iconos";

export default function MenuAjustes({ onCerrar }: { onCerrar: () => void }) {
  const { recargar, refrescar, contexto } = useApp();
  const [correo, setCorreo] = useState(contexto.contrato.destinatarios[0] ?? "");
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState<string>();
  const [confirmar, setConfirmar] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const sesion = useSesion();
  const [versionCatalogo, setVersionCatalogo] = useState<string>();

  useEffect(() => {
    leerAjuste(CLAVES.destinatario).then((v) => v && setCorreo(v)).catch(() => {});
    leerAjuste(CLAVES_CATALOGO.versionLocal).then((v) => setVersionCatalogo(v ?? "0")).catch(() => {});
  }, []);

  async function guardarCorreo() {
    setError(undefined); setOk(undefined);
    try {
      await fijarDestinatarioPrueba(correo);
      await recargar();
      setOk("Destinatario guardado. Los próximos envíos irán a esta dirección.");
    } catch (e) { setError(mensaje(e)); }
  }

  async function reiniciar() {
    setTrabajando(true); setError(undefined);
    try {
      await reiniciarDemostracion();
      await recargar();
      refrescar();
      onCerrar();
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <HojaInferior titulo="Ajustes de la demostración" onCerrar={onCerrar}>
      <Etiqueta derecha={versionCatalogo && versionCatalogo !== "0" ? `Catálogo v${versionCatalogo}` : "Catálogo de ejemplo"}>¿Quién usa este teléfono?</Etiqueta>
      <ListaIdentidades actualId={sesion?.usuario?.id} alElegir={async () => { await recargar(); refrescar(); }} />
      {sesion?.rol === "admin" && (
        <Link href="/admin" className={`${s.botonSecundario} ${s.botonChico}`} onClick={onCerrar}>
          <IcoDocumento /> Administrar catálogo
        </Link>
      )}

      <Etiqueta htmlFor="correo-prueba" derecha="Del contrato">Destinatario del correo de prueba</Etiqueta>
      <input
        id="correo-prueba" className={s.entrada} type="email" inputMode="email" autoComplete="email"
        value={correo} onChange={(e) => setCorreo(e.target.value)}
      />
      <button className={`${s.botonSecundario} ${s.botonChico}`} onClick={guardarCorreo}>Guardar destinatario</button>
      {ok && <Aviso tono="verde">{ok}</Aviso>}

      <Etiqueta>Datos de demostración</Etiqueta>
      <p className={s.textoSuave}>Borra lo registrado en este teléfono y vuelve a cargar el turno de ejemplo y 6 semanas de historial.</p>
      {!confirmar ? (
        <button className={`${s.botonSecundario} ${s.botonChico}`} onClick={() => setConfirmar(true)}>
          Reiniciar datos de demostración
        </button>
      ) : (
        <Aviso tono="ambar" titulo="¿Borrar todo y volver a empezar?">
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className={`${s.botonSecundario} ${s.botonChico}`} onClick={() => setConfirmar(false)} disabled={trabajando}>Cancelar</button>
            <button className={`${s.botonPrimario} ${s.botonChico}`} onClick={reiniciar} disabled={trabajando}>
              {trabajando ? <><Giro chico /> Reiniciando…</> : "Sí, reiniciar"}
            </button>
          </div>
        </Aviso>
      )}
      {error && <MensajeError>{error}</MensajeError>}
    </HojaInferior>
  );
}

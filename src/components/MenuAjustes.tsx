"use client";
// Ajustes de la demostración: destinatario del correo de prueba y reinicio de los datos.
import { useEffect, useState } from "react";
import { CLAVES, fijarDestinatarioPrueba, leerAjuste } from "@/lib/repositorio";
import { reiniciarDemostracion } from "@/lib/seed";
import { mensaje, useApp } from "./Proveedor";
import { Aviso, Etiqueta, Giro, HojaInferior, MensajeError, estilos as s } from "./ui";

export default function MenuAjustes({ onCerrar }: { onCerrar: () => void }) {
  const { recargar, refrescar, contexto } = useApp();
  const [correo, setCorreo] = useState(contexto.contrato.destinatarios[0] ?? "");
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState<string>();
  const [confirmar, setConfirmar] = useState(false);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    leerAjuste(CLAVES.destinatario).then((v) => v && setCorreo(v)).catch(() => {});
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

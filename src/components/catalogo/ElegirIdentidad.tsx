"use client";
// Inicio de sesión de la maqueta (semana 8 v2): se elige el usuario de una lista desplegable y se escribe la
// clave (CLAVE_MAQUETA, la misma para todos). El rol que trae el usuario en el catálogo define qué pantallas ve.
import { useState } from "react";
import { usuariosDelContrato } from "@/lib/catalogo";
import { etiquetaRol } from "@/lib/catalogo-excel";
import { CLAVE_MAQUETA, iniciarSesion } from "@/lib/sesion";
import { useConsulta } from "@/hooks/useConsulta";
import { Etiqueta, Giro, MensajeError, estilos as s } from "../ui";

export default function ElegirIdentidad({ alElegir }: { alElegir: (id: string) => Promise<void> }) {
  const { datos: usuarios, error } = useConsulta(() => usuariosDelContrato(), []);
  const [usuarioId, setUsuarioId] = useState("");
  const [clave, setClave] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [fallo, setFallo] = useState<string>();

  async function entrar(ev: React.FormEvent) {
    ev.preventDefault();
    setEntrando(true); setFallo(undefined);
    try {
      await iniciarSesion(usuarioId, clave);
      await alElegir(usuarioId);
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e));
      setEntrando(false);
    }
  }

  return (
    <main className={s.pantalla}>
      <form className={s.cuerpo} onSubmit={entrar}>
        <h1 className={s.h1}>Bitácora ITO</h1>
        <p className={s.textoSuave}>
          Elige tu nombre y escribe tu clave. Cada rol ve solo lo suyo: el inspector registra su parte, el jefe de
          turno consolida el día y envía el correo al mandante, y el administrador carga el catálogo.
        </p>

        <Etiqueta htmlFor="usuario">Usuario</Etiqueta>
        {error ? <MensajeError>{error.message}</MensajeError> : !usuarios ? (
          <p className={s.textoSuave}><Giro chico /> Cargando usuarios…</p>
        ) : (
          <select id="usuario" className={s.entrada} value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} disabled={entrando}>
            <option value="">Elige tu nombre…</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre} · {etiquetaRol(u.rol)}</option>)}
          </select>
        )}

        <Etiqueta htmlFor="clave">Clave</Etiqueta>
        <input id="clave" className={s.entrada} type="password" inputMode="numeric" autoComplete="current-password"
          value={clave} onChange={(e) => setClave(e.target.value)} disabled={entrando} />

        {fallo && <MensajeError>{fallo}</MensajeError>}
        <button type="submit" className={s.botonPrimario} disabled={entrando || !usuarioId || !clave}>
          {entrando ? <><Giro chico /> Entrando…</> : "Entrar"}
        </button>
        <p className={s.textoSuave} style={{ fontSize: 13, textAlign: "center" }}>
          Maqueta académica: la clave de todos los usuarios es {CLAVE_MAQUETA}.
        </p>
      </form>
    </main>
  );
}

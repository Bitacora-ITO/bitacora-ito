"use client";
// «¿Quién usa este teléfono?»: lista de usuarios activos del contrato con su rol.
// Se usa en Ajustes y, al primer uso, como pantalla completa antes de entrar a la app.
import { useState } from "react";
import { usuariosDelContrato } from "@/lib/catalogo";
import { etiquetaRol } from "@/lib/catalogo-excel";
import { fijarSesion } from "@/lib/sesion";
import type { RolApp } from "@/lib/types";
import { useConsulta } from "@/hooks/useConsulta";
import { Chip, Giro, MensajeError, estilos as s, type Tono } from "../ui";
import { IcoCheck } from "../iconos";

const TONO: Record<RolApp, Tono> = { inspector: "teal", jefatura: "ambar", admin: "gris" };

export function ListaIdentidades({ actualId, alElegir }: { actualId?: string; alElegir: (id: string) => Promise<void> }) {
  const { datos: usuarios, error } = useConsulta(() => usuariosDelContrato(), []);
  const [eligiendo, setEligiendo] = useState<string>();
  const [fallo, setFallo] = useState<string>();

  async function elegir(id: string) {
    setEligiendo(id); setFallo(undefined);
    try {
      await fijarSesion(id);
      await alElegir(id);
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e));
    } finally {
      setEligiendo(undefined);
    }
  }

  if (error) return <MensajeError>{error.message}</MensajeError>;
  if (!usuarios) return <p className={s.textoSuave}><Giro chico /> Cargando usuarios…</p>;
  return (
    <div className={s.lista} role="radiogroup" aria-label="¿Quién usa este teléfono?">
      {usuarios.map((u) => {
        const actual = u.id === actualId;
        return (
          <button key={u.id} type="button" role="radio" aria-checked={actual} className={s.fila}
            style={{ "--barra": actual ? "var(--teal)" : "var(--linea)", minHeight: 56 } as React.CSSProperties}
            onClick={() => elegir(u.id)} disabled={!!eligiendo}>
            <span className={s.filaTexto}>
              <span className={s.filaTitulo}>{u.nombre}</span>
              <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <Chip tono={TONO[u.rol]}>{etiquetaRol(u.rol)}</Chip>
                <span className={s.textoSuave} style={{ fontSize: 13 }}>{u.correo}</span>
              </span>
            </span>
            {eligiendo === u.id ? <Giro chico /> : actual ? <IcoCheck className={s.filaFlecha} /> : null}
          </button>
        );
      })}
      {fallo && <MensajeError>{fallo}</MensajeError>}
    </div>
  );
}

/** Pantalla del primer uso: nadie ha elegido aún quién usa este teléfono. */
export default function ElegirIdentidad({ alElegir }: { alElegir: (id: string) => Promise<void> }) {
  return (
    <main className={s.pantalla}>
      <div className={s.cuerpo}>
        <h1 className={s.h1}>¿Quién usa este teléfono?</h1>
        <p className={s.textoSuave}>
          Elige tu nombre. Tu rol define lo que ves: el inspector registra su parte, el jefe de turno la
          consolida y el administrador carga el catálogo. Se puede cambiar después en Ajustes.
        </p>
        <ListaIdentidades alElegir={alElegir} />
      </div>
    </main>
  );
}

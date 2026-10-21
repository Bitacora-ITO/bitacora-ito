"use client";
// P7 · Inicio de turno (08d): tocar un día lo fija como primer día del turno y se ve el ciclo 7x7.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fijarInicioTurno, rolDelUsuario } from "@/lib/repositorio";
import { esDiaTrabajo, esInicioTurno, proximoInicioTurno } from "@/lib/rol";
import { capitalizar, fechaConDia, hoyLocal, nombreMes } from "@/lib/fechas";
import { useConsulta } from "@/hooks/useConsulta";
import { mensaje } from "@/components/Proveedor";
import Calendario, { estilosCalendario as c } from "@/components/Calendario";
import { Cargando, Encabezado, Giro, MensajeError, Pantalla, estilos as s } from "@/components/ui";
import { IcoAtras, IcoFlecha } from "@/components/iconos";
import l from "@/components/listas.module.css";
import h from "../historial.module.css";

export default function InicioTurno() {
  const router = useRouter();
  const hoy = hoyLocal();
  const { datos: rol } = useConsulta(() => rolDelUsuario(), []);
  const [elegido, setElegido] = useState<string>();
  const [mes, setMes] = useState(() => ({ anio: Number(hoy.slice(0, 4)), mes0: Number(hoy.slice(5, 7)) - 1 }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string>();

  if (rol === undefined) return <Cargando />;
  if (!rol) return <Pantalla><MensajeError>No hay rol de turnos cargado.</MensajeError></Pantalla>;
  const inicio = elegido ?? rol.fechaInicio;
  const vista = { ...rol, fechaInicio: inicio };
  const proximo = proximoInicioTurno(hoy, vista);

  function irMes(delta: number) {
    setMes(({ anio, mes0 }) => { const d = new Date(anio, mes0 + delta, 1); return { anio: d.getFullYear(), mes0: d.getMonth() }; });
  }

  async function guardar() {
    setGuardando(true); setError(undefined);
    try {
      await fijarInicioTurno(inicio);
      router.push("/historial");
    } catch (e) { setError(mensaje(e)); setGuardando(false); }
  }

  return (
    <Pantalla pie={
      <>
        {error && <MensajeError>{error}</MensajeError>}
        <button className={s.botonPrimario} onClick={guardar} disabled={guardando}>
          {guardando ? <><Giro chico /> Guardando…</> : "Guardar inicio de turno"}
        </button>
      </>
    }>
      <Encabezado volver={{ texto: "Historial", href: "/historial" }} titulo="Inicio de turno" />
      <p style={{ margin: "0 0 4px", fontSize: 15 }}>
        Toca el primer día de tu turno. Desde ahí el rol {rol.diasTrabajo}×{rol.diasDescanso} calcula solo los días de trabajo y de descanso.
      </p>
      <div className={c.mes}>
        <button className={c.flechaMes} onClick={() => irMes(-1)} aria-label="Mes anterior"><IcoAtras /></button>
        <b>{capitalizar(nombreMes(mes.mes0))} {mes.anio}</b>
        <button className={c.flechaMes} onClick={() => irMes(1)} aria-label="Mes siguiente"><IcoFlecha /></button>
      </div>
      <Calendario
        anio={mes.anio}
        mes0={mes.mes0}
        celda={(dia) => {
          const ini = dia === inicio;
          const trabajo = esDiaTrabajo(dia, vista);
          return {
            clase: ini ? "inicio" : trabajo ? "trabajo" : "descanso",
            punto: esInicioTurno(dia, vista),
            tocable: true,
            etiqueta: ini ? "Inicio elegido" : trabajo ? "Trabajo" : "Descanso",
          };
        }}
        onTocar={setElegido}
      />
      <div className={c.leyenda}>
        <span><i className={c.muestra} style={{ background: "var(--teal)" }} /> Inicio</span>
        <span><i className={c.muestra} style={{ background: "var(--teal-bg)" }} /> Trabajo ({rol.diasTrabajo} días)</span>
        <span><i className={c.muestra} style={{ background: "var(--descanso)" }} /> Descanso ({rol.diasDescanso} días)</span>
      </div>
      <div className={l.tabla} style={{ marginTop: 8 }}>
        <div className={l.par}><span>Rol del contrato</span><b>{rol.diasTrabajo}×{rol.diasDescanso}</b></div>
      </div>
      <div className={h.seleccion}>Inicio de turno: {fechaConDia(inicio)}</div>
      <p className={s.textoSuave} style={{ fontSize: 14 }}>
        Próximo inicio: {fechaConDia(proximo)}. Los informes ya enviados no cambian.
      </p>
    </Pantalla>
  );
}

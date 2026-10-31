"use client";
// P7 · Historial (HU-10, 08a): calendario del mes con enviado / no entregado / descanso según el rol 7x7.
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fechasEnviadas, rolDelUsuario } from "@/lib/repositorio";
import { estadoDia, esInicioTurno, inicioTurnoVigente, totalesMes } from "@/lib/rol";
import { capitalizar, diaMes, hoyLocal, nombreMes } from "@/lib/fechas";
import type { EstadoDia } from "@/lib/types";
import { useConsulta } from "@/hooks/useConsulta";
import { useApp } from "@/components/Proveedor";
import Calendario, { estilosCalendario as c } from "@/components/Calendario";
import { Cargando, Encabezado, Pantalla, estilos as s } from "@/components/ui";
import { IcoAtras, IcoFlecha } from "@/components/iconos";
import h from "./historial.module.css";

const ETIQUETA: Record<EstadoDia, string> = {
  enviado: "Enviado", no_entregado: "No entregado", descanso: "Descanso", hoy: "Hoy",
  programado: "Turno programado", descanso_futuro: "Descanso programado",
};

export default function Pagina() {
  return <Suspense fallback={<Cargando />}><Historial /></Suspense>;
}

function Historial() {
  const router = useRouter();
  const params = useSearchParams();
  const { contexto } = useApp();
  const hoy = hoyLocal();
  const m = params.get("m") ?? hoy.slice(0, 7);
  const [anio, mes] = m.split("-").map(Number);
  const mes0 = mes - 1;

  const { datos } = useConsulta(async () => {
    const [rol, enviados] = await Promise.all([rolDelUsuario(), fechasEnviadas(contexto.contrato.id)]);
    return { rol, enviados };
  }, [contexto.contrato.id]);

  if (!datos) return <Cargando />;
  const { rol, enviados } = datos;
  if (!rol) return <Pantalla><Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Historial" /><p>No hay rol de turnos cargado.</p></Pantalla>;

  const irMes = (delta: number) => {
    const d = new Date(anio, mes0 + delta, 1);
    router.replace(`/historial?m=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const tot = totalesMes(anio, mes0, hoy, rol, enviados);
  const prev = new Date(anio, mes0 - 1, 1);
  const totPrev = totalesMes(prev.getFullYear(), prev.getMonth(), hoy, rol, enviados);
  const mesActual = m === hoy.slice(0, 7);
  const futuro = m > hoy.slice(0, 7);

  return (
    <Pantalla pie={<button className={s.botonPrimario} onClick={() => router.push("/")}>Volver al turno</button>}>
      <Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Historial" />
      <div className={c.mes}>
        <button className={c.flechaMes} onClick={() => irMes(-1)} aria-label="Mes anterior"><IcoAtras /></button>
        <b>{capitalizar(nombreMes(mes0))} {anio}</b>
        <button className={c.flechaMes} onClick={() => irMes(1)} aria-label="Mes siguiente"><IcoFlecha /></button>
      </div>

      <Calendario
        anio={anio}
        mes0={mes0}
        celda={(dia) => {
          const e = estadoDia(dia, hoy, rol, enviados);
          const esHoy = dia === hoy;
          return {
            clase: esHoy && e === "enviado" ? "hoyEnviado" : e,
            punto: esInicioTurno(dia, rol),
            tocable: e === "enviado" || e === "no_entregado" || e === "hoy",
            etiqueta: `${ETIQUETA[e]}${esHoy && e === "enviado" ? ", hoy" : ""}${esInicioTurno(dia, rol) ? ", inicio de turno" : ""}`,
          };
        }}
        onTocar={(dia) => {
          const e = estadoDia(dia, hoy, rol, enviados);
          router.push(e === "hoy" ? "/" : `/historial/dia?f=${dia}`);
        }}
      />

      <div className={c.leyenda}>
        <span><i className={c.muestra} style={{ background: "var(--verde)" }} /> Enviado</span>
        <span><i className={c.muestra} style={{ background: "var(--rojo)" }} /> No entregado</span>
        <span><i className={c.muestra} style={{ background: "var(--descanso)" }} /> Descanso</span>
        <span><i className={c.muestra} style={{ background: "var(--teal)", borderRadius: "50%" }} /> Inicio de turno</span>
        <span><i className={c.muestra} style={{ boxShadow: "inset 0 0 0 2px var(--teal)" }} /> Hoy</span>
        <span><i className={c.muestra} style={{ border: "1.5px dashed #b9c2ca" }} /> Programado</span>
      </div>

      <div className={`${s.tarjeta} ${h.resumen}`}>
        <b>Resumen de {nombreMes(mes0)}{mesActual && tot.hasta ? ` · al ${diaMes(tot.hasta)}` : ""}</b>
        {futuro ? (
          <p className={s.textoSuave}>{tot.programados} días de turno programados.</p>
        ) : (
          <div className={h.numeros}>
            <div><b style={{ color: "var(--verde)" }}>{tot.enviados}</b><span>{tot.enviados === 1 ? "Enviado" : "Enviados"}</span></div>
            <div><b style={{ color: "var(--rojo)" }}>{tot.noEntregados}</b><span>{tot.noEntregados === 1 ? "No entregado" : "No entregados"}</span></div>
            <div><b style={{ color: "var(--gris)" }}>{tot.descanso}</b><span>Descanso</span></div>
          </div>
        )}
        {totPrev.hasta && (
          <p className={h.previo}>
            {capitalizar(nombreMes(prev.getMonth()))}: {totPrev.enviados} enviados · {totPrev.noEntregados} {totPrev.noEntregados === 1 ? "no entregado" : "no entregados"} · {totPrev.descanso} descanso
          </p>
        )}
      </div>

      <div className={`${s.tarjeta} ${h.rol}`}>
        <b>Rol {rol.diasTrabajo}×{rol.diasDescanso} · inicio de turno {diaMes(inicioTurnoVigente(hoy, rol))}</b>
        <button className={s.enlace} onClick={() => router.push("/historial/inicio")}>Cambiar</button>
      </div>
      <p className={s.textoSuave} style={{ textAlign: "center", fontSize: 14 }}>Toca un día para ver los datos de su informe.</p>
    </Pantalla>
  );
}

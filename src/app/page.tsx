"use client";
// P1 · Turno y áreas (HU-01): fecha, turno, clima, áreas del turno con su estado y acceso al reporte.
// Prueba de usuarios (11 y 18-11-2026): «Paso 1 · Inicia tu turno» con el calendario resaltado (hallazgo 1),
// clima discreto y «Paso 2» con botones de color (2), «Cerrar sesión» visible (4) y botón para registrar
// el avance dentro de la tarjeta de un área pendiente (6).
// Semana 8 v2, navegación por rol: el inspector ve P1 y el jefe de turno («jefatura») solo la consolidación
// del día. El administrador no pasa por aquí: Proveedor lo lleva a /admin.
import { useEffect, useState } from "react";
import { useSesion } from "@/lib/sesion";
import InicioJefe from "@/components/consolidacion/InicioJefe";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import {
  actualizarClima, areasDelReporte, CLIMA, esEditable, estadoInicioTurno, ultimoEnvio,
} from "@/lib/repositorio";
import type { Clima } from "@/lib/types";
import { fechaCorta, hora, haceCuanto, nombreCorto } from "@/lib/fechas";
import { useConsulta } from "@/hooks/useConsulta";
import { mensaje, useApp } from "@/components/Proveedor";
import FilaArea from "@/components/FilaArea";
import MenuAjustes from "@/components/MenuAjustes";
import AvisoCatalogo from "@/components/catalogo/AvisoCatalogo";
import { Aviso, Cargando, cx, Etiqueta, Giro, MensajeError, Pantalla, Segmentado, estilos as s } from "@/components/ui";
import {
  IcoAjustes, IcoAlerta, IcoCalendario, IcoCheck, IcoDocumento, IcoFlecha, IcoMas, IcoSinSenal, IcoUbicacion,
} from "@/components/iconos";
import p from "./turno.module.css";

const OPC_CLIMA = (Object.keys(CLIMA) as Clima[]).map((valor) => ({ valor, etiqueta: CLIMA[valor] }));

export default function Inicio() {
  const sesion = useSesion();
  if (!sesion) return <Cargando texto="Cargando el turno…" />;
  if (sesion.rol === "jefatura") return <InicioJefe />;
  if (sesion.rol === "admin") return <Cargando texto="Abriendo el catálogo…" />;
  return <Turno />;
}

function Turno() {
  const router = useRouter();
  const app = useApp();
  const { contexto, reporteHoyId, conectado, pendientes, ultimaSync, errorSync, sincronizando, salir } = app;
  const [ajustes, setAjustes] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState<string>();
  const [, setTic] = useState(0);
  useEffect(() => { const t = setInterval(() => setTic((n) => n + 1), 30_000); return () => clearInterval(t); }, []);

  const { datos, error: errorCarga } = useConsulta(async () => {
    const reporte = await db.reportes.get(reporteHoyId);
    if (!reporte) return null;
    const [areas, alertas, editable, envio, inicioTurno] = await Promise.all([
      areasDelReporte(reporte.id, pendientes),
      db.alertas.where("reporteId").equals(reporte.id).toArray(),
      esEditable(reporte),
      ultimoEnvio(reporte.id),
      estadoInicioTurno(),
    ]);
    const sinSubir = (await db.registros.where("reporteId").equals(reporte.id).toArray()).filter((r) => !r.sincronizadoEn).length;
    return { reporte, areas, alertas, editable, envio, sinSubir, inicioTurno };
  }, [reporteHoyId, pendientes]);

  if (errorCarga) {
    // Mensaje propio en vez del texto técnico, con una salida (propuesta de reglas, parte 3).
    return (
      <Pantalla pie={<button className={s.botonPrimario} onClick={() => window.location.reload()}>Reintentar</button>}>
        <Aviso tono="rojo" icono={<IcoAlerta />} titulo="No se pudo cargar el turno">
          Intenta de nuevo. Si el problema sigue, cierra la app y vuelve a abrirla.
        </Aviso>
      </Pantalla>
    );
  }
  if (!datos) return <Cargando texto="Cargando el turno…" />;
  const { reporte, areas, alertas, editable, envio, sinSubir, inicioTurno } = datos;
  const falteIniciar = editable && !!inicioTurno && !inicioTurno.confirmado;

  const resueltas = areas.filter((a) => a.estado !== "pendiente").length;
  const hayRegistros = areas.some((a) => a.registros.length > 0);
  const vacio = areas.length === 0;

  async function cambiarClima(campo: "climaTurno" | "climaProyeccion", v: Clima) {
    setError(undefined);
    try { await actualizarClima(reporte.id, campo, v); } catch (e) { setError(mensaje(e)); }
  }

  async function cerrarSesion() {
    setSaliendo(true); setError(undefined);
    try { await salir(); } catch (e) { setError(mensaje(e)); setSaliendo(false); }
  }

  function revisar() {
    if (reporte.estado === "aprobado" || reporte.estado === "entregado" || reporte.estado === "enviado" || envio) router.push("/enviar");
    else router.push("/borrador");
  }

  const turno = reporte.turno === "dia" ? "Turno día" : "Turno noche";

  return (
    <Pantalla
      pie={
        <>
          <div className={p.sync}>
            {!conectado ? (
              <Aviso tono="ambar" icono={<IcoSinSenal />}>
                <b>Sin señal · {sinSubir === 0 ? "lo que registres se guarda en el teléfono" : sinSubir === 1 ? "1 registro se enviará solo" : `${sinSubir} registros se enviarán solos`}</b>
              </Aviso>
            ) : sincronizando ? (
              <p className={p.estadoSync}><Giro chico /> Sincronizando…</p>
            ) : pendientes > 0 || errorSync ? (
              <p className={p.estadoSync}>
                {pendientes > 0 ? `${pendientes} ${pendientes === 1 ? "dato pendiente" : "datos pendientes"} de sincronizar` : "No se pudo sincronizar"} · se reintentará solo
              </p>
            ) : (
              <p className={p.estadoSync}><IcoCheck size={18} /> Sincronizado {haceCuanto(ultimaSync) || "recién"}</p>
            )}
          </div>
          {!hayRegistros && <p className={s.notaPie}>Disponible cuando haya registros</p>}
          <button className={s.botonPrimario} disabled={!hayRegistros} onClick={revisar}>
            <IcoDocumento /> {reporte.estado === "enviado" ? "Ver reporte enviado" : reporte.estado === "entregado" ? "Ver mi parte entregada" : "Revisar reporte del turno"}
          </button>
        </>
      }
    >
      <div className={p.cabecera}>
        <div style={{ minWidth: 0 }}>
          <h1 className={`${s.h1} ${p.titulo}`}>{turno} · {fechaCorta(reporte.fecha)}</h1>
          <p className={s.subtitulo}>Contrato {contexto.contrato.numero} · {nombreCorto(contexto.usuario.nombre)}</p>
        </div>
        <div className={p.iconos}>
          <button className={p.iconoPlano} onClick={() => setAjustes(true)} aria-label="Ajustes de la demostración">
            <IcoAjustes />
          </button>
          <button className={cx(s.botonIcono, falteIniciar && p.calendarioResaltado)}
            onClick={() => router.push(falteIniciar ? "/historial/inicio?desde=turno" : "/historial")}
            aria-label={falteIniciar ? "Iniciar el turno en el calendario" : "Historial"}>
            <IcoCalendario />
          </button>
        </div>
      </div>

      <AvisoCatalogo />

      {falteIniciar ? (
        <button className={p.paso1} onClick={() => router.push("/historial/inicio?desde=turno")}>
          <span style={{ flex: 1 }}>
            <b>Paso 1 · Inicia tu turno</b>
            <span>Toca aquí o el calendario y marca el día de inicio.</span>
          </span>
          <IcoFlecha />
        </button>
      ) : editable && inicioTurno?.confirmado ? (
        <p className={p.turnoIniciado}>
          <IcoCheck size={16} /> Turno iniciado el {fechaCorta(inicioTurno.inicio)} ·{" "}
          <button className={s.enlace} style={{ padding: 0, minHeight: 0 }} onClick={() => router.push("/historial/inicio?desde=turno")}>Cambiar</button>
        </p>
      ) : null}

      {!editable && (
        <Aviso tono={reporte.estado === "enviado" ? "verde" : "ambar"} icono={<IcoCheck />}
          titulo={reporte.estado === "enviado"
            ? `Reporte enviado${envio?.enviadoEn ? ` ${hora(envio.enviadoEn)}` : ""}`
            : "Reporte aprobado, pendiente de envío"}>
          {reporte.estado === "enviado" ? "El reporte enviado no se edita." : "Se enviará solo al detectar señal."}
        </Aviso>
      )}

      <p className={p.etiquetaClima}>Clima del turno</p>
      <Segmentado discreto etiqueta="Clima del turno" opciones={OPC_CLIMA} valor={reporte.climaTurno}
        onChange={(v) => cambiarClima("climaTurno", v)} deshabilitado={!editable} />
      <p className={p.etiquetaClima}>Proyección de mañana</p>
      <Segmentado discreto etiqueta="Proyección de mañana" opciones={OPC_CLIMA} valor={reporte.climaProyeccion}
        onChange={(v) => cambiarClima("climaProyeccion", v)} deshabilitado={!editable} />
      {error && <MensajeError>{error}</MensajeError>}

      <Etiqueta derecha={vacio ? undefined : `${resueltas} de ${areas.length} resueltos`}>Áreas del turno</Etiqueta>

      {vacio ? (
        <div className={p.vacio}>
          <span className={p.vacioIcono}><IcoUbicacion size={28} /></span>
          <b>Primer día del contrato</b>
          <p className={s.textoSuave}>Aún no hay áreas. Elige la primera<br />para empezar a registrar.</p>
          {editable && <p className={p.paso2}>Paso 2 · Agrega cada área donde trabajaste hoy</p>}
          <button className={cx(s.botonPrimario, p.botonArea)} style={{ width: "auto", marginTop: 4, padding: "0 20px" }} onClick={() => router.push("/agregar-area")} disabled={!editable}>
            <IcoMas /> Agregar primera área
          </button>
        </div>
      ) : (
        <div className={s.lista}>
          {areas.map((a) => (
            <FilaArea key={a.areaTurno.id} area={a} onClick={() => router.push(`/registrar?at=${a.areaTurno.id}`)}
              accion={editable ? "Registrar avance de esta área" : undefined} />
          ))}
        </div>
      )}

      {!vacio && editable && <p className={p.paso2}>Paso 2 · Agrega cada área donde trabajaste hoy</p>}
      {!vacio && (
        <div className={p.acciones}>
          <button className={cx(s.botonPrimario, s.botonChico, p.botonArea)} onClick={() => router.push("/agregar-area")} disabled={!editable}>
            <IcoMas /> Agregar área
          </button>
          <button className={cx(s.botonPrimario, s.botonChico, p.botonAlerta)} onClick={() => router.push("/alerta")} disabled={!editable}>
            <IcoAlerta /> Nueva alerta
          </button>
        </div>
      )}
      {alertas.length > 0 && (
        <p className={s.textoSuave}>
          {alertas.length === 1 ? "1 alerta" : `${alertas.length} alertas`} en el turno
          {alertas.some((a) => a.criticidad === "alta") && <> · <span style={{ color: "var(--rojo)" }}>{alertas.filter((a) => a.criticidad === "alta").length} alta</span></>}
        </p>
      )}

      {/* Al final del contenido y siempre visible (hallazgo 4): antes estaba solo dentro de los tres puntos. */}
      <div className={p.filaSalir}>
        <button className={p.cerrarSesion} onClick={cerrarSesion} disabled={saliendo}>
          {saliendo ? <><Giro chico /> Subiendo lo registrado…</> : <>Cerrar sesión <IcoFlecha size={16} /></>}
        </button>
      </div>

      {ajustes && <MenuAjustes onCerrar={() => setAjustes(false)} />}
    </Pantalla>
  );
}

"use client";
// P1 · Turno y áreas (HU-01): fecha, turno, clima, áreas del turno con su estado y acceso al reporte.
// Semana 8, navegación por rol: el inspector ve P1; el jefe de turno («jefatura») ve la consolidación
// del turno y, si también inspecciona, entra a sus registros con «Mis registros del turno».
import { useEffect, useState } from "react";
import { useSesion } from "@/lib/sesion";
import InicioJefe, { BarraJefe, CLAVE_MIS_REGISTROS } from "@/components/consolidacion/InicioJefe";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import {
  actualizarClima, areasDelReporte, CLIMA, esEditable, ultimoEnvio,
} from "@/lib/repositorio";
import type { Clima } from "@/lib/types";
import { fechaCorta, hora, haceCuanto, nombreCorto } from "@/lib/fechas";
import { useConsulta } from "@/hooks/useConsulta";
import { mensaje, useApp } from "@/components/Proveedor";
import FilaArea from "@/components/FilaArea";
import MenuAjustes from "@/components/MenuAjustes";
import AvisoCatalogo from "@/components/catalogo/AvisoCatalogo";
import { Aviso, Cargando, Etiqueta, Giro, MensajeError, Pantalla, Segmentado, estilos as s } from "@/components/ui";
import {
  IcoAjustes, IcoAlerta, IcoCalendario, IcoCheck, IcoDocumento, IcoMas, IcoSinSenal, IcoUbicacion,
} from "@/components/iconos";
import p from "./turno.module.css";

const OPC_CLIMA = (Object.keys(CLIMA) as Clima[]).map((valor) => ({ valor, etiqueta: CLIMA[valor] }));

export default function Inicio() {
  const sesion = useSesion();
  const [misRegistros, setMisRegistros] = useState<boolean | null>(null);
  useEffect(() => {
    try { setMisRegistros(sessionStorage.getItem(CLAVE_MIS_REGISTROS) === "1"); } catch { setMisRegistros(false); }
  }, []);
  const verMisRegistros = (si: boolean) => {
    try { if (si) sessionStorage.setItem(CLAVE_MIS_REGISTROS, "1"); else sessionStorage.removeItem(CLAVE_MIS_REGISTROS); } catch { /* sin sessionStorage */ }
    setMisRegistros(si);
  };
  if (!sesion || misRegistros === null) return <Cargando texto="Cargando el turno…" />;
  if (sesion.rol !== "jefatura") return <Turno />;
  if (!misRegistros) return <InicioJefe alVerMisRegistros={() => verMisRegistros(true)} />;
  return <><BarraJefe alVolver={() => verMisRegistros(false)} /><Turno /></>;
}

function Turno() {
  const router = useRouter();
  const app = useApp();
  const { contexto, reporteHoyId, conectado, pendientes, ultimaSync, errorSync, sincronizando } = app;
  const [ajustes, setAjustes] = useState(false);
  const [error, setError] = useState<string>();
  const [, setTic] = useState(0);
  useEffect(() => { const t = setInterval(() => setTic((n) => n + 1), 30_000); return () => clearInterval(t); }, []);

  const { datos, error: errorCarga } = useConsulta(async () => {
    const reporte = await db.reportes.get(reporteHoyId);
    if (!reporte) return null;
    const [areas, alertas, editable, envio] = await Promise.all([
      areasDelReporte(reporte.id, pendientes),
      db.alertas.where("reporteId").equals(reporte.id).toArray(),
      esEditable(reporte),
      ultimoEnvio(reporte.id),
    ]);
    const sinSubir = (await db.registros.where("reporteId").equals(reporte.id).toArray()).filter((r) => !r.sincronizadoEn).length;
    return { reporte, areas, alertas, editable, envio, sinSubir };
  }, [reporteHoyId, pendientes]);

  if (errorCarga) return <Pantalla><MensajeError>{errorCarga.message}</MensajeError></Pantalla>;
  if (!datos) return <Cargando texto="Cargando el turno…" />;
  const { reporte, areas, alertas, editable, envio, sinSubir } = datos;

  const resueltas = areas.filter((a) => a.estado !== "pendiente").length;
  const hayRegistros = areas.some((a) => a.registros.length > 0);
  const vacio = areas.length === 0;

  async function cambiarClima(campo: "climaTurno" | "climaProyeccion", v: Clima) {
    setError(undefined);
    try { await actualizarClima(reporte.id, campo, v); } catch (e) { setError(mensaje(e)); }
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
          <button className={s.botonIcono} onClick={() => router.push("/historial")} aria-label="Historial">
            <IcoCalendario />
          </button>
        </div>
      </div>

      <AvisoCatalogo />

      {!editable && (
        <Aviso tono={reporte.estado === "enviado" ? "verde" : "ambar"} icono={<IcoCheck />}
          titulo={reporte.estado === "enviado"
            ? `Reporte enviado${envio?.enviadoEn ? ` ${hora(envio.enviadoEn)}` : ""}`
            : "Reporte aprobado, pendiente de envío"}>
          {reporte.estado === "enviado" ? "El reporte enviado no se edita." : "Se enviará solo al detectar señal."}
        </Aviso>
      )}

      <Etiqueta>Clima del turno</Etiqueta>
      <Segmentado etiqueta="Clima del turno" opciones={OPC_CLIMA} valor={reporte.climaTurno}
        onChange={(v) => cambiarClima("climaTurno", v)} deshabilitado={!editable} />
      <Etiqueta>Proyección de mañana</Etiqueta>
      <Segmentado etiqueta="Proyección de mañana" opciones={OPC_CLIMA} valor={reporte.climaProyeccion}
        onChange={(v) => cambiarClima("climaProyeccion", v)} deshabilitado={!editable} />
      {error && <MensajeError>{error}</MensajeError>}

      <Etiqueta derecha={vacio ? undefined : `${resueltas} de ${areas.length} resueltos`}>Áreas del turno</Etiqueta>

      {vacio ? (
        <div className={p.vacio}>
          <span className={p.vacioIcono}><IcoUbicacion size={28} /></span>
          <b>Primer día del contrato</b>
          <p className={s.textoSuave}>Aún no hay áreas. Elige la primera<br />para empezar a registrar.</p>
          <button className={s.botonSecundario} style={{ width: "auto", marginTop: 8 }} onClick={() => router.push("/agregar-area")} disabled={!editable}>
            <IcoMas /> Agregar primera área
          </button>
        </div>
      ) : (
        <div className={s.lista}>
          {areas.map((a) => (
            <FilaArea key={a.areaTurno.id} area={a} onClick={() => router.push(`/registrar?at=${a.areaTurno.id}`)} />
          ))}
        </div>
      )}

      {!vacio && (
        <div className={p.acciones}>
          <button className={`${s.botonSecundario} ${s.botonChico}`} onClick={() => router.push("/agregar-area")} disabled={!editable}>
            <IcoMas /> Agregar área
          </button>
          <button className={`${s.botonSecundario} ${s.botonChico}`} onClick={() => router.push("/alerta")} disabled={!editable}>
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

      {ajustes && <MenuAjustes onCerrar={() => setAjustes(false)} />}
    </Pantalla>
  );
}

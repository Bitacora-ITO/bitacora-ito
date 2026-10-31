"use client";
// P4 · Borrador del reporte (HU-06): 04a cargando, 04b con datos, 04c áreas sin resolver (regla 2).
import { useEffect, useState } from "react";
import { useSesion } from "@/lib/sesion";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import {
  areasDelReporte, CLIMA, COLUMNA, CRITICIDAD, eliminarAlerta, esEditable, numeroCorto, resumenReporte,
} from "@/lib/repositorio";
import type { Fotografia } from "@/lib/types";
import { useConsulta } from "@/hooks/useConsulta";
import { mensaje, useApp } from "@/components/Proveedor";
import FilaArea from "@/components/FilaArea";
import {
  Aviso, Chip, Encabezado, Etiqueta, Giro, MensajeError, Miniatura, Pantalla, estilos as s,
} from "@/components/ui";
import { IcoAlerta, IcoCheck, IcoFlecha } from "@/components/iconos";
import b from "./borrador.module.css";

const PASOS = ["Áreas con sus registros", "Tabla de alertas", "Anexo fotográfico", "Resumen del turno"];

export default function Borrador() {
  const router = useRouter();
  const { contexto, reporteHoyId } = useApp();
  const sesion = useSesion();
  const [paso, setPaso] = useState(0);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  // 04a: el borrador se arma por partes; se muestra el avance un instante.
  useEffect(() => {
    const t = setInterval(() => setPaso((p) => (p >= PASOS.length ? p : p + 1)), 220);
    return () => clearInterval(t);
  }, []);

  const { datos, error: errorCarga } = useConsulta(async () => {
    const reporte = await db.reportes.get(reporteHoyId);
    if (!reporte) return null;
    const [areas, resumen, editable] = await Promise.all([areasDelReporte(reporteHoyId), resumenReporte(reporteHoyId), esEditable(reporte)]);
    const regIds = areas.flatMap((a) => a.registros.map((r) => r.id));
    const fotos: Fotografia[] = [
      ...(regIds.length ? await db.fotografias.where("registroId").anyOf(regIds).toArray() : []),
      ...(resumen.alertas.length ? await db.fotografias.where("alertaId").anyOf(resumen.alertas.map((a) => a.id)).toArray() : []),
    ];
    return { reporte, areas, resumen, editable, fotos };
  }, [reporteHoyId]);

  const listo = paso >= PASOS.length && datos !== undefined;

  if (errorCarga) return <Pantalla><Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Borrador del reporte" /><MensajeError>{errorCarga.message}</MensajeError></Pantalla>;

  if (!listo || !datos) {
    return (
      <Pantalla pie={<button className={s.botonSecundario} onClick={() => router.push("/")}>Cancelar y volver al turno</button>}>
        <Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Borrador del reporte" />
        <div className={s.centro}>
          <Giro />
          <b style={{ marginTop: 16 }}>Generando el borrador del turno…</b>
          <ul className={b.pasos}>
            {PASOS.map((t, i) => (
              <li key={t} className={i < paso ? b.hecho : undefined}>
                {i < paso ? <IcoCheck size={20} /> : <span className={b.circulo} />} {t}
              </li>
            ))}
          </ul>
        </div>
      </Pantalla>
    );
  }

  const { reporte, areas, resumen, editable, fotos } = datos;
  const pendientes = areas.filter((a) => a.estado === "pendiente");

  if (!editable) {
    return (
      <Pantalla pie={<button className={s.botonPrimario} onClick={() => router.push("/enviar")}>Ver estado</button>}>
        <Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Borrador del reporte" />
        <Aviso tono="gris" titulo="El reporte ya fue aprobado.">
          {sesion?.rol === "jefatura"
            ? "Un reporte enviado no se edita. El envío al mandante se hace desde la consolidación del turno."
            : "Un reporte enviado no se edita. Tu parte se entrega al jefe de turno, que envía el reporte al mandante."}
        </Aviso>
      </Pantalla>
    );
  }

  if (areas.length === 0 || pendientes.length > 0) {
    const n = pendientes.length;
    return (
      <Pantalla pie={
        <>
          <button className={s.botonSecundario} onClick={() => router.push("/")}>Volver al turno</button>
          {n > 0
            ? <button className={s.botonPrimario} onClick={() => router.push(`/registrar?at=${pendientes[0].areaTurno.id}`)}>Ir a {pendientes[0].area.nombre}</button>
            : <button className={s.botonPrimario} onClick={() => router.push("/agregar-area")}>Agregar área</button>}
        </>
      }>
        <Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Borrador del reporte" />
        <div className={b.resolver}>
          <span className={b.iconoAmbar}><IcoAlerta size={34} /></span>
          <h2 className={s.tituloEstado}>{n === 0 ? "El turno no tiene áreas" : n === 1 ? "Falta resolver 1 área" : `Faltan resolver ${n} áreas`}</h2>
          <p className={s.textoSuave} style={{ textAlign: "center" }}>
            Para generar el borrador, cada área debe tener registro o declararse sin actividad.
          </p>
        </div>
        <div className={s.lista}>
          {pendientes.map((a) => <FilaArea key={a.areaTurno.id} area={a} onClick={() => router.push(`/registrar?at=${a.areaTurno.id}`)} />)}
        </div>
      </Pantalla>
    );
  }

  const { porCriticidad: c } = resumen;
  const partesCrit = (["alta", "media", "baja"] as const).filter((k) => c[k] > 0).map((k) => `${c[k]} ${CRITICIDAD[k].toLowerCase()}`);
  const toggle = (k: string) => setAbierto((v) => (v === k ? null : k));

  return (
    <Pantalla pie={
      <>
        <button className={s.botonSecundario} onClick={() => router.push("/")}>Editar registros</button>
        <button className={s.botonPrimario} onClick={() => router.push("/vista-previa")}>Ver vista previa del PDF</button>
      </>
    }>
      <Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Borrador del reporte" />
      <h2 className={s.h1}>Reporte {contexto.contrato.numero}-{numeroCorto(reporte.correlativo)}</h2>
      <div><Chip tono="teal">Borrador generado automáticamente</Chip></div>
      {error && <MensajeError>{error}</MensajeError>}
      {reporte.estado === "entregado" && (
        <Aviso tono="ambar" icono={<IcoAlerta />} titulo="Ya entregaste tu parte al jefe de turno">
          Si cambias algo, vuelve a borrador y tendrás que revisarla y entregarla de nuevo.
        </Aviso>
      )}

      <Etiqueta>Resumen del turno</Etiqueta>
      <div className={b.numeros}>
        <div className={s.tarjeta}>
          <b className={b.grande}>{resumen.areas} {resumen.areas === 1 ? "área" : "áreas"}</b>
          <span className={s.textoSuave}>{resumen.conRegistro} con registro</span>
        </div>
        <div className={s.tarjeta}>
          <b className={b.grande}>{resumen.alertas.length} {resumen.alertas.length === 1 ? "alerta" : "alertas"}</b>
          <span className={s.textoSuave} style={{ color: c.alta ? "var(--rojo)" : undefined }}>{partesCrit.join(" · ") || "sin alertas"}</span>
        </div>
      </div>

      <Etiqueta>Contenido</Etiqueta>
      <div className={s.lista}>
        <Seccion titulo="Áreas con sus registros" detalle={`${areas.length} áreas · ${resumen.sinActividad} sin actividad`} abierto={abierto === "areas"} onClick={() => toggle("areas")}>
          {areas.map((a, i) => (
            <button key={a.areaTurno.id} className={b.subitem} onClick={() => router.push(`/registrar?at=${a.areaTurno.id}`)}>
              <b>{i + 1}.0 {a.area.nombre} · {a.empresa.nombre}</b>
              {a.registros.map((r) => r.sinActividad
                ? <span key={r.id} style={{ color: "var(--rojo)" }}>Sin actividad.</span>
                : <span key={r.id} style={{ whiteSpace: "pre-line" }}>{r.descripcion}</span>)}
            </button>
          ))}
        </Seccion>
        <Seccion titulo="Tabla de alertas" detalle={`${resumen.alertas.length} alertas por columna`} abierto={abierto === "alertas"} onClick={() => toggle("alertas")}>
          {resumen.alertas.length === 0 && <span className={s.textoSuave}>Sin alertas en el turno.</span>}
          {resumen.alertas.map((al) => (
            <div key={al.id} className={b.subitem} style={{ cursor: "default" }}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <b>{COLUMNA[al.columna].largo.toUpperCase()}</b>
                <Chip tono={al.criticidad === "alta" ? "rojo" : al.criticidad === "media" ? "ambar" : "gris"}>{CRITICIDAD[al.criticidad]}</Chip>
              </span>
              <span>{al.descripcion}</span>
              <button className={s.enlace} style={{ color: "var(--rojo)", alignSelf: "flex-start", padding: 0 }}
                onClick={() => eliminarAlerta(al.id).catch((e) => setError(mensaje(e)))}>Quitar alerta</button>
            </div>
          ))}
        </Seccion>
        <Seccion titulo="Anexo fotográfico" detalle={`${resumen.fotos} ${resumen.fotos === 1 ? "fotografía" : "fotografías"}`} abierto={abierto === "fotos"} onClick={() => toggle("fotos")}>
          <div className={s.fotos}>{fotos.map((f, i) => <Miniatura key={f.id} blob={f.imagen} alt={`Fotografía ${i + 1}`} />)}</div>
        </Seccion>
        <Seccion titulo="Clima del turno" detalle={`${CLIMA[reporte.climaTurno]} · mañana ${CLIMA[reporte.climaProyeccion].toLowerCase()}`} abierto={abierto === "clima"} onClick={() => toggle("clima")}>
          <button className={s.enlace} style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => router.push("/")}>Cambiar en el turno</button>
        </Seccion>
      </div>
    </Pantalla>
  );
}

function Seccion({ titulo, detalle, abierto, onClick, children }: {
  titulo: string; detalle: string; abierto: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <div className={s.tarjeta} style={{ padding: 0 }}>
      <button className={b.cabeceraSeccion} onClick={onClick} aria-expanded={abierto}>
        <span style={{ flex: 1 }}>
          <b style={{ display: "block" }}>{titulo}</b>
          <span className={s.textoSuave}>{detalle}</span>
        </span>
        <IcoFlecha className={abierto ? b.girado : undefined} />
      </button>
      {abierto && <div className={b.contenidoSeccion}>{children}</div>}
    </div>
  );
}

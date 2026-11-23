"use client";
// P4 · Borrador del reporte (HU-06): 04a cargando, 04b con datos, 04c áreas sin resolver (regla 2).
// Prueba de usuarios (hallazgo 7): el inspector firmaba sin abrir las secciones. Ahora un aviso pide abrir cada
// una, la primera viene abierta, las demás muestran «Ver detalle» y el aviso pasa a verde al revisarlas todas.
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
  Aviso, Chip, cx, Encabezado, Etiqueta, Giro, MensajeError, Miniatura, Pantalla, estilos as s,
} from "@/components/ui";
import { IcoAlerta, IcoCheck, IcoFlecha } from "@/components/iconos";
import b from "./borrador.module.css";

const PASOS = ["Áreas con sus registros", "Tabla de alertas", "Anexo fotográfico", "Resumen del turno"];

export default function Borrador() {
  const router = useRouter();
  const { contexto, reporteHoyId } = useApp();
  const sesion = useSesion();
  const [paso, setPaso] = useState(0);
  // Varias secciones pueden quedar abiertas; `vistas` recuerda cuáles se revisaron.
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set(["areas"]));
  const [vistas, setVistas] = useState<Set<string>>(() => new Set(["areas"]));
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
  const toggle = (k: string) => {
    setAbiertas((v) => { const n = new Set(v); if (n.has(k)) n.delete(k); else n.add(k); return n; });
    setVistas((v) => new Set(v).add(k));
  };
  const faltanVer = SECCIONES.filter((k) => !vistas.has(k)).length;

  return (
    <Pantalla pie={
      <>
        <button className={s.botonSecundario} onClick={() => router.push("/")}>Editar registros</button>
        <button className={s.botonPrimario} onClick={() => router.push("/enviar")}>Cerrar y enviar al jefe de turno</button>
      </>
    }>
      <Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Borrador del reporte" />
      <h2 className={s.h1}>Reporte {contexto.contrato.numero}-{numeroCorto(reporte.correlativo)}</h2>
      <div><Chip tono="teal">Revisa tu parte antes de cerrarla</Chip></div>
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

      {faltanVer > 0 ? (
        <Aviso tono="ambar" icono={<IcoAlerta />} titulo="Antes de firmar, abre cada sección">
          y revisa que tus registros estén bien. {faltanVer === 1 ? "Falta 1 sección." : `Faltan ${faltanVer} secciones.`}
        </Aviso>
      ) : (
        <Aviso tono="verde" icono={<IcoCheck />} titulo="Revisaste todas las secciones">
          Si todo está bien, cierra y envía tu parte al jefe de turno.
        </Aviso>
      )}

      <Etiqueta>Contenido</Etiqueta>
      <div className={s.lista}>
        <Seccion titulo="Áreas con sus registros" detalle={`${areas.length} áreas · ${resumen.sinActividad} sin actividad`} abierto={abiertas.has("areas")} vista={vistas.has("areas")} onClick={() => toggle("areas")}>
          {areas.map((a, i) => (
            <button key={a.areaTurno.id} className={b.subitem} onClick={() => router.push(`/registrar?at=${a.areaTurno.id}`)}>
              <b>{i + 1}.0 {a.area.nombre} · {a.empresa.nombre}</b>
              {a.registros.map((r) => r.sinActividad
                ? <span key={r.id} style={{ color: "var(--rojo)" }}>Sin actividad.</span>
                : <span key={r.id} style={{ whiteSpace: "pre-line" }}>{r.descripcion}</span>)}
            </button>
          ))}
        </Seccion>
        <Seccion titulo="Tabla de alertas" detalle={`${resumen.alertas.length} alertas por columna`} abierto={abiertas.has("alertas")} vista={vistas.has("alertas")} onClick={() => toggle("alertas")}>
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
        <Seccion titulo="Anexo fotográfico" detalle={`${resumen.fotos} ${resumen.fotos === 1 ? "fotografía" : "fotografías"}`} abierto={abiertas.has("fotos")} vista={vistas.has("fotos")} onClick={() => toggle("fotos")}>
          <div className={s.fotos}>{fotos.map((f, i) => <Miniatura key={f.id} blob={f.imagen} alt={`Fotografía ${i + 1}`} />)}</div>
        </Seccion>
        <Seccion titulo="Clima del turno" detalle={`${CLIMA[reporte.climaTurno]} · mañana ${CLIMA[reporte.climaProyeccion].toLowerCase()}`} abierto={abiertas.has("clima")} vista={vistas.has("clima")} onClick={() => toggle("clima")}>
          <button className={s.enlace} style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => router.push("/")}>Cambiar en el turno</button>
        </Seccion>
      </div>
    </Pantalla>
  );
}

const SECCIONES = ["areas", "alertas", "fotos", "clima"] as const;

function Seccion({ titulo, detalle, abierto, vista, onClick, children }: {
  titulo: string; detalle: string; abierto: boolean; vista: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <div className={cx(s.tarjeta, abierto && b.seccionAbierta)} style={{ padding: 0 }}>
      <button className={b.cabeceraSeccion} onClick={onClick} aria-expanded={abierto}>
        <span style={{ flex: 1 }}>
          <b style={{ display: "block" }}>{titulo}</b>
          <span className={s.textoSuave}>{detalle}</span>
        </span>
        <span className={b.pildora}>
          {abierto ? <>Ocultar <IcoFlecha size={14} className={b.arriba} /></>
            : <>{vista && <IcoCheck size={14} />}Ver detalle <IcoFlecha size={14} /></>}
        </span>
      </button>
      {abierto && <div className={b.contenidoSeccion}>{children}</div>}
    </div>
  );
}

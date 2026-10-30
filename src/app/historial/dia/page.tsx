"use client";
// P7 · Día del historial: 08b enviado (datos del informe, solo lectura, sin PDF) y 08c no entregado.
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CLIMA, COLUMNA, CRITICIDAD, detalleDelDia, numeroCorto, rolDelUsuario } from "@/lib/repositorio";
import { esDiaTrabajo } from "@/lib/rol";
import { fechaCorta, hora, hoyLocal } from "@/lib/fechas";
import type { Reporte } from "@/lib/types";
import { useConsulta } from "@/hooks/useConsulta";
import { useApp } from "@/components/Proveedor";
import { Aviso, Cargando, Chip, Encabezado, Etiqueta, Miniatura, Pantalla, estilos as s } from "@/components/ui";
import l from "@/components/listas.module.css";
import h from "../historial.module.css";

export default function Pagina() {
  return <Suspense fallback={<Cargando />}><Dia /></Suspense>;
}

const ESTADO_INFORME: Record<Reporte["estado"], string> = {
  borrador: "Borrador sin aprobar",
  generado: "PDF generado sin aprobar",
  aprobado: "Aprobado, sin enviar",
  entregado: "Entregado al jefe de turno",
  enviado: "Enviado",
};

function Dia() {
  const router = useRouter();
  const fecha = useSearchParams().get("f") ?? hoyLocal();
  const { contexto } = useApp();
  const { datos } = useConsulta(async () => ({ detalle: await detalleDelDia(fecha), rol: await rolDelUsuario() }), [fecha]);
  if (!datos) return <Cargando />;
  const { detalle: { reporte, envio, areas, alertas, fotos }, rol } = datos;
  const volver = () => router.push(`/historial?m=${fecha.slice(0, 7)}`);
  const pie = <button className={s.botonPrimario} onClick={volver}>Volver al calendario</button>;
  // «Entregado al jefe de turno» cuenta como cumplido (semana 8): se muestra igual que un día enviado.
  const entregado = reporte?.estado === "entregado";
  const enviado = envio?.estado === "enviado" || entregado;
  const empresas = new Map(areas.map((a) => [a.empresa.id, a.empresa.nombre]));

  if (reporte && enviado) {
    return (
      <Pantalla pie={pie}>
        <Encabezado volver={{ texto: "Historial", onClick: volver }} titulo={fechaCorta(fecha)} />
        <div className={h.chip}><Chip tono="verde">{entregado && envio?.estado !== "enviado" ? `Entregado al jefe de turno ${hora(reporte.entregadoEn)}` : `Enviado ${hora(envio?.enviadoEn)} · acuse recibido`}</Chip></div>
        <h2 className={s.h1}>Reporte {contexto.contrato.numero}-{numeroCorto(reporte.correlativo)}</h2>
        <p className={s.textoSuave} style={{ fontSize: 14 }}>
          Turno {reporte.turno === "dia" ? "día" : "noche"} · {contexto.usuario.nombre} · clima: {CLIMA[reporte.climaTurno].toLowerCase()} / mañana: {CLIMA[reporte.climaProyeccion].toLowerCase()}
        </p>

        <Etiqueta>Áreas y registros</Etiqueta>
        <div className={l.tabla}>
          {areas.map((a, i) => {
            const nFotos = a.fotos;
            const avances = a.registros.filter((r) => !r.sinActividad);
            return (
              <div key={a.areaTurno.id} className={h.detalleArea}>
                <b style={{ fontSize: 15 }}>{i + 1}.0 {a.area.nombre} · {a.empresa.nombre}</b>
                {a.estado === "sin_actividad"
                  ? <small style={{ color: "var(--rojo)" }}>Sin actividad</small>
                  : <small>{avances.length} {avances.length === 1 ? "registro" : "registros"} · {nFotos} {nFotos === 1 ? "foto" : "fotos"}</small>}
                {avances.map((r) => <p key={r.id}>{r.descripcion}</p>)}
              </div>
            );
          })}
        </div>

        <Etiqueta>Alertas ({alertas.length})</Etiqueta>
        {alertas.length === 0 && <p className={s.textoSuave}>Sin alertas en el turno.</p>}
        {alertas.map((al) => (
          <div key={al.id} className={`${l.tabla} ${h.alerta}`} style={{ padding: "10px 16px" }}>
            <div className={h.alertaCabecera}>
              <b>{COLUMNA[al.columna].largo.toUpperCase()}{al.empresaId ? ` · ${empresas.get(al.empresaId) ?? ""}` : ""}</b>
              <Chip tono={al.criticidad === "alta" ? "rojo" : al.criticidad === "media" ? "ambar" : "gris"}>{CRITICIDAD[al.criticidad]}</Chip>
            </div>
            <span className={s.textoSuave} style={{ fontSize: 14 }}>{al.descripcion}</span>
          </div>
        ))}

        <Etiqueta>Fotografías ({fotos.length})</Etiqueta>
        <div className={h.fotos}>{fotos.map((f, i) => <Miniatura key={f.id} blob={f.imagen} alt={`Fotografía ${i + 1}`} />)}</div>
        <p className={s.textoSuave} style={{ fontSize: 13 }}>
          Datos con que se armó la vista previa del informe. Solo lectura: un informe enviado no se edita.
        </p>
      </Pantalla>
    );
  }

  const trabajo = rol ? esDiaTrabajo(fecha, rol) : true;
  const registros = areas.reduce((n, a) => n + a.registros.length, 0);
  return (
    <Pantalla pie={pie}>
      <Encabezado volver={{ texto: "Historial", onClick: volver }} titulo={fechaCorta(fecha)} />
      <div className={h.noEntregado}>
        <span className={h.iconoRojo} aria-hidden="true">!</span>
        <h2 className={s.tituloEstado} style={{ marginTop: 0 }}>{trabajo ? "Informe no entregado" : "Día de descanso"}</h2>
        <p className={s.textoSuave}>
          {trabajo ? "Era día de trabajo según el rol 7×7 y el informe no se envió." : "Según el rol 7×7 era día de descanso."}
        </p>
      </div>
      <div className={l.tabla}>
        <div className={l.par}><span>Turno</span><b>{reporte ? (reporte.turno === "dia" ? "Día" : "Noche") : "Día"}</b></div>
        <div className={l.par}><span>Registros guardados</span><b>{registros}</b></div>
        <div className={l.par}><span>Alertas</span><b>{alertas.length}</b></div>
        <div className={l.par}><span>Estado del informe</span><b>{reporte ? (envio ? `${ESTADO_INFORME[reporte.estado]} · envío ${envio.estado.replace("_", " ")}` : ESTADO_INFORME[reporte.estado]) : "Sin reporte"}</b></div>
      </div>
      {areas.length > 0 && (
        <>
          <Etiqueta>Áreas del día</Etiqueta>
          <div className={l.tabla}>
            {areas.map((a, i) => (
              <div key={a.areaTurno.id} className={h.detalleArea}>
                <b style={{ fontSize: 15 }}>{i + 1}.0 {a.area.nombre} · {a.empresa.nombre}</b>
                <small>{a.registros.length === 0 ? "Sin registro" : a.estado === "sin_actividad" ? "Sin actividad" : `${a.registros.length} ${a.registros.length === 1 ? "registro" : "registros"} · ${a.fotos} ${a.fotos === 1 ? "foto" : "fotos"}`}</small>
                {a.registros.filter((r) => !r.sinActividad).map((r) => <p key={r.id}>{r.descripcion}</p>)}
              </div>
            ))}
          </div>
        </>
      )}
      <Aviso tono="gris">Los días de descanso del rol aparecen en gris y no cuentan como no entregados.</Aviso>
    </Pantalla>
  );
}

"use client";
// Lista de partes del turno (entregadas y en preparación) e inspectores pendientes, para el jefe de turno.
import type { InspectorPendiente, ResumenParte } from "@/lib/consolidacion-remota";
import { horaLocal } from "@/lib/consolidar";
import { Chip, Etiqueta, estilos as s } from "@/components/ui";
import { IcoCheck } from "@/components/iconos";
import c from "./consolidacion.module.css";

const ESTADO_PARTE: Record<string, string> = {
  borrador: "En borrador", generado: "PDF generado, sin entregar", aprobado: "Aprobada, sin entregar", enviado: "Enviada (flujo antiguo)",
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function ListaPartes({ partes, elegidas, alCambiar, deshabilitado }: {
  partes: ResumenParte[];
  elegidas: Set<string>;
  alCambiar: (reporteId: string) => void;
  deshabilitado?: boolean;
}) {
  if (!partes.length) {
    return <p className={s.textoSuave}>Aún no hay partes en la nube para esta fecha y turno.</p>;
  }
  return (
    <div className={s.lista}>
      {partes.map((p) => {
        const marcada = elegidas.has(p.reporteId);
        return (
          <button key={p.reporteId} type="button" role="checkbox" aria-checked={marcada} disabled={deshabilitado}
            className={`${c.parte} ${marcada ? c.parteElegida : ""}`} onClick={() => alCambiar(p.reporteId)}>
            <span className={`${c.casilla} ${marcada ? c.casillaMarcada : ""}`} aria-hidden="true">{marcada && <IcoCheck size={16} />}</span>
            <span className={c.parteTexto}>
              <span className={c.parteCabecera}>
                <b>{p.inspector}</b>
                {p.entregado
                  ? <Chip tono="verde">Entregada {horaLocal(p.entregadoEn)}</Chip>
                  : <Chip tono="ambar">{ESTADO_PARTE[p.estado] ?? p.estado}</Chip>}
              </span>
              <span className={c.cifras}>
                {plural(p.areas, "área", "áreas")} · {plural(p.registros, "registro", "registros")} · {plural(p.alertas, "alerta", "alertas")} · {plural(p.fotos, "foto", "fotos")}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ListaPendientes({ pendientes }: { pendientes: InspectorPendiente[] }) {
  if (!pendientes.length) return null;
  const n = pendientes.filter((p) => p.motivo === "pendiente").length;
  return (
    <>
      <Etiqueta derecha={n ? plural(n, "sin entregar", "sin entregar") : undefined}>Inspectores pendientes</Etiqueta>
      <div className={s.lista}>
        {pendientes.map((p) => (
          <div key={p.id} className={c.pendiente}>
            <span>
              {p.nombre}
              {p.estadoParte && <small>Su parte está en la nube: {ESTADO_PARTE[p.estadoParte]?.toLowerCase() ?? p.estadoParte}</small>}
            </span>
            {p.motivo === "pendiente" ? <Chip tono="ambar">Pendiente</Chip> : <Chip tono="gris">Descanso</Chip>}
          </div>
        ))}
      </div>
    </>
  );
}

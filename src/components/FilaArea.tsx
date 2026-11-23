"use client";
// Fila de un área del turno: «Área · EMPRESA» y su estado con palabra y color.
// Con `accion`, un área pendiente muestra un botón explícito para registrar su avance (prueba de usuarios,
// hallazgo 6: después de agregar el área, el inspector no sabía si debía tocar la tarjeta «Pendiente»).
import type { AreaDelTurno, EstadoArea } from "@/lib/repositorio";
import { Chip, cx, estilos as s, type Tono } from "./ui";
import { IcoFlecha } from "./iconos";

const ESTADO: Record<EstadoArea, { tono: Tono; barra: string; texto: (h?: string) => string }> = {
  con_registro: { tono: "teal", barra: "var(--teal)", texto: (h) => `Con registro${h ? ` · ${h}` : ""}` },
  por_sincronizar: { tono: "ambar", barra: "#f2b53a", texto: (h) => `Por sincronizar${h ? ` · ${h}` : ""}` },
  pendiente: { tono: "ambar", barra: "#f2b53a", texto: () => "Pendiente" },
  sin_actividad: { tono: "gris", barra: "#cfd6dc", texto: () => "Sin actividad" },
};

export function textoEstado(a: AreaDelTurno) {
  return ESTADO[a.estado].texto(a.ultimaHora);
}

export default function FilaArea({ area, onClick, detalle, accion }: {
  area: AreaDelTurno; onClick?: () => void; detalle?: string;
  /** Texto del botón que se muestra dentro de la tarjeta cuando el área está pendiente. */
  accion?: string;
}) {
  const e = ESTADO[area.estado];
  const nombre = `${area.area.nombre} · ${area.empresa.nombre}`;

  if (accion && onClick && area.estado === "pendiente") {
    return (
      <div className={cx(s.fila, s.filaConAccion)} style={{ "--barra": e.barra } as React.CSSProperties}>
        <span className={s.filaTexto}>
          <span className={s.filaTitulo}>{nombre}</span>
          <Chip tono={e.tono}>{e.texto(area.ultimaHora)}</Chip>
          {detalle && <span className={s.textoSuave} style={{ fontSize: 13 }}>{detalle}</span>}
        </span>
        <button type="button" className={s.filaAccion} onClick={onClick} aria-label={`${accion}: ${nombre}`}>
          {accion} <IcoFlecha size={18} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={s.fila}
      style={{ "--barra": e.barra } as React.CSSProperties}
      onClick={onClick}
      aria-label={`${nombre}: ${e.texto(area.ultimaHora)}`}
    >
      <span className={s.filaTexto}>
        <span className={s.filaTitulo}>{nombre}</span>
        <Chip tono={e.tono}>{e.texto(area.ultimaHora)}</Chip>
        {detalle && <span className={s.textoSuave} style={{ fontSize: 13 }}>{detalle}</span>}
      </span>
      {onClick && <IcoFlecha className={s.filaFlecha} />}
    </button>
  );
}

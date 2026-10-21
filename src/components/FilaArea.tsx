"use client";
// Fila de un área del turno: «Área · EMPRESA» y su estado con palabra y color.
import type { AreaDelTurno, EstadoArea } from "@/lib/repositorio";
import { Chip, estilos as s, type Tono } from "./ui";
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

export default function FilaArea({ area, onClick, detalle }: { area: AreaDelTurno; onClick?: () => void; detalle?: string }) {
  const e = ESTADO[area.estado];
  return (
    <button
      type="button"
      className={s.fila}
      style={{ "--barra": e.barra } as React.CSSProperties}
      onClick={onClick}
      aria-label={`${area.area.nombre}, ${area.empresa.nombre}: ${e.texto(area.ultimaHora)}`}
    >
      <span className={s.filaTexto}>
        <span className={s.filaTitulo}>{area.area.nombre} · {area.empresa.nombre}</span>
        <Chip tono={e.tono}>{e.texto(area.ultimaHora)}</Chip>
        {detalle && <span className={s.textoSuave} style={{ fontSize: 13 }}>{detalle}</span>}
      </span>
      {onClick && <IcoFlecha className={s.filaFlecha} />}
    </button>
  );
}

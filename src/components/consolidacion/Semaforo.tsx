"use client";
// Semáforo del jefe de turno (semana 8 v2, pedido del equipo): cuántos ITO del día ya firmaron y enviaron su
// parte. Rojo = ninguno, ámbar = algunos, verde = todos (100 %): ahí corresponde consolidar.
// Los ITO en descanso según su rol 7x7 no cuentan.

export type Luz = "rojo" | "ambar" | "verde";

export function luzDe(enviaron: number, esperados: number): Luz {
  if (esperados > 0 && enviaron >= esperados) return "verde";
  return enviaron > 0 ? "ambar" : "rojo";
}

const MENSAJE: Record<Luz, string> = {
  rojo: "Ningún ITO ha enviado su parte todavía.",
  ambar: "Faltan partes por llegar. Esta pantalla se actualiza sola.",
  verde: "Todos los ITO enviaron su parte. Ya puedes consolidar.",
};

export default function Semaforo({ enviaron, esperados, actualizado }: { enviaron: number; esperados: number; actualizado?: string }) {
  const luz = luzDe(enviaron, esperados);
  const pct = esperados ? Math.round((Math.min(enviaron, esperados) / esperados) * 100) : 0;
  const color = `var(--${luz})`;
  return (
    <section aria-live="polite" aria-label="Semáforo de partes enviadas" data-luz={luz}
      style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 16px", borderRadius: "var(--radio)",
        background: `var(--${luz}-bg)`, border: `1.5px solid ${color}` }}>
      <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 5, padding: 6, borderRadius: 10, background: "var(--ink)" }}>
        {(["rojo", "ambar", "verde"] as Luz[]).map((l) => (
          <span key={l} style={{ width: 16, height: 16, borderRadius: "50%", background: l === luz ? `var(--${l})` : "#46525e",
            boxShadow: l === luz ? `0 0 8px var(--${l})` : "none" }} />
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <b style={{ fontSize: 20, color: "var(--ink)" }}>{enviaron} de {esperados} ITO enviaron · {pct} %</b>
        <div style={{ height: 8, borderRadius: 4, background: "var(--blanco)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .4s" }} />
        </div>
        <span style={{ fontSize: 14, color: "var(--ink)" }}>{MENSAJE[luz]}</span>
        {actualizado && <span style={{ fontSize: 12, color: "var(--gris)" }}>Actualizado {actualizado}</span>}
      </div>
    </section>
  );
}

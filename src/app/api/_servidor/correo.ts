// Plantilla del correo del reporte diario (HTML sobrio, compatible con Gmail y Outlook: tablas y estilos en línea).
import type { CuerpoEnvio } from "@/lib/envio";
import { escaparHtml as e } from "./comun";

const TINTA = "#1E2B38";
const TURQUESA = "#35D2C3";
const GRIS = "#5B6875";
const BORDE = "#E3E8EC";

export function fechaLarga(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const t = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}-${m}-${a}` : iso;
}

export const nombreTurno = (t: string) => (t === "noche" ? "Noche" : "Día");

export function asunto(r: CuerpoEnvio["reporte"]): string {
  return `Reporte diario N.º ${r.numero} · ${fechaCorta(r.fecha)} · Turno ${nombreTurno(r.turno).toLowerCase()}`;
}

function resumenAutomatico(r: CuerpoEnvio["reporte"]): string {
  const partes = [
    `${r.areas} ${r.areas === 1 ? "área inspeccionada" : "áreas inspeccionadas"}`,
    `${r.registros} ${r.registros === 1 ? "actividad registrada" : "actividades registradas"}`,
  ];
  if (r.sinActividad) partes.push(`${r.sinActividad} sin actividad`);
  partes.push(r.alertas ? `${r.alertas} ${r.alertas === 1 ? "alerta" : "alertas"}${r.alertasAltas ? ` (${r.alertasAltas} de criticidad alta)` : ""}` : "sin alertas");
  if (r.fotos) partes.push(`${r.fotos} ${r.fotos === 1 ? "fotografía" : "fotografías"}`);
  return partes.join(" · ");
}

export function textoPlano(r: CuerpoEnvio["reporte"]): string {
  return [
    `REPORTE DIARIO DE INSPECCIÓN N.º ${r.numero}`,
    "",
    `Fecha: ${fechaLarga(r.fecha)}`,
    `Turno: ${nombreTurno(r.turno)}`,
    `Elaborado por: ${r.elaboradoPor}`,
    r.contrato ? `Contrato: ${r.contrato}${r.numeroContrato ? ` (N.º ${r.numeroContrato})` : ""}` : "",
    `Correlativo: ${r.correlativo}`,
    "",
    `Resumen: ${r.resumen ?? resumenAutomatico(r)}`,
    r.resumen ? `En cifras: ${resumenAutomatico(r)}` : "",
    "",
    "Se adjunta el reporte en PDF.",
    "",
    "—",
    "Correo generado por Bitácora ITO. El reporte fue revisado y aprobado por el inspector antes de su envío.",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}

export function html(r: CuerpoEnvio["reporte"]): string {
  const fila = (etiqueta: string, valor: string) => `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid ${BORDE};color:${GRIS};font-size:13px;width:38%;vertical-align:top;">${e(etiqueta)}</td>
              <td style="padding:8px 0;border-bottom:1px solid ${BORDE};color:${TINTA};font-size:14px;font-weight:600;vertical-align:top;">${e(valor)}</td>
            </tr>`;
  const filas = [
    fila("Fecha", fechaLarga(r.fecha)),
    fila("Turno", nombreTurno(r.turno)),
    fila("Elaborado por", r.elaboradoPor),
    r.contrato ? fila("Contrato", `${r.contrato}${r.numeroContrato ? ` · N.º ${r.numeroContrato}` : ""}`) : "",
    r.mandante ? fila("Mandante", r.mandante) : "",
    fila("Correlativo", r.correlativo),
  ].join("");
  const resumen = r.resumen
    ? `<p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:${TINTA};">${e(r.resumen).replace(/\n/g, "<br>")}</p>
            <p style="margin:0;font-size:13px;color:${GRIS};">${e(resumenAutomatico(r))}</p>`
    : `<p style="margin:0;font-size:14px;line-height:1.55;color:${TINTA};">${e(resumenAutomatico(r))}</p>`;
  const alertaAlta = r.alertasAltas
    ? `<tr><td style="padding:0 32px 8px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FDECEC;border-radius:6px;">
              <tr><td style="padding:10px 14px;font-size:13px;color:#9B1C1C;">
                El reporte informa ${r.alertasAltas} ${r.alertasAltas === 1 ? "alerta" : "alertas"} de criticidad alta. El detalle y las fotografías están en el PDF adjunto.
              </td></tr>
            </table>
          </td></tr>`
    : "";

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(asunto(r))}</title></head>
<body style="margin:0;padding:0;background:#F3F5F7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F5F7;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:8px;overflow:hidden;border:1px solid ${BORDE};">
        <tr><td style="background:${TINTA};padding:20px 32px;border-bottom:4px solid ${TURQUESA};">
          <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${TURQUESA};font-weight:700;">Bitácora ITO</div>
          <div style="font-size:20px;color:#FFFFFF;font-weight:700;margin-top:4px;">Reporte diario de inspección N.º ${e(r.numero)}</div>
          ${r.codigoProyecto ? `<div style="font-size:12px;color:#B8C4CE;margin-top:4px;">${e(r.codigoProyecto)}</div>` : ""}
        </td></tr>
        <tr><td style="padding:24px 32px 8px;">
          <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:${TINTA};">Estimados:</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:${TINTA};">Junto con saludar, se remite el reporte diario de inspección técnica de obra correspondiente al turno ${e(nombreTurno(r.turno).toLowerCase())} del ${e(fechaCorta(r.fecha))}. El documento completo se adjunta en PDF.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${filas}
          </table>
        </td></tr>
        <tr><td style="padding:16px 32px 8px;">
          <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${GRIS};font-weight:700;margin-bottom:8px;">Resumen del turno</div>
          ${resumen}
        </td></tr>
        ${alertaAlta}
        <tr><td style="padding:16px 32px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" style="border:1px solid ${BORDE};border-radius:6px;">
            <tr><td style="padding:10px 14px;font-size:13px;color:${TINTA};"><strong>Adjunto:</strong> reporte diario en PDF</td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#F8FAFB;padding:14px 32px;border-top:1px solid ${BORDE};font-size:11px;line-height:1.5;color:${GRIS};">
          Correo generado por Bitácora ITO. El reporte fue revisado y aprobado por el inspector antes de su envío.
          Si recibió este mensaje por error, avise al remitente y elimínelo.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

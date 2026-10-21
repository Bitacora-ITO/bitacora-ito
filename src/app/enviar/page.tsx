"use client";
// P5 · Enviar al mandante (HU-07): 05a con datos, 05b enviando, 05c enviado, 05d en cola sin red, y fallido.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { numeroCorto, ultimoEnvio } from "@/lib/repositorio";
import { enviarReporte } from "@/lib/envio";
import { guardarPdf } from "@/lib/nativo";
import { armarDatosInforme } from "@/lib/informe/armar";
import { nombreArchivoPdf } from "@/lib/informe/pdf";
import { diferenciaMin } from "./plazo";
import { duracion, hora, instante, nombreCorto } from "@/lib/fechas";
import { useConsulta } from "@/hooks/useConsulta";
import { mensaje, useApp } from "@/components/Proveedor";
import { Aviso, Cargando, Encabezado, Etiqueta, Giro, MensajeError, Pantalla, estilos as s } from "@/components/ui";
import { IcoAlerta, IcoCheck, IcoSinSenal } from "@/components/iconos";
import l from "@/components/listas.module.css";
import e from "./enviar.module.css";

export default function Enviar() {
  const router = useRouter();
  const { contexto, reporteHoyId, refrescar } = useApp();
  const [enviando, setEnviando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string>();
  const [archivo, setArchivo] = useState<{ nombre: string; fotos: number }>();
  const [errorPdf, setErrorPdf] = useState<string>();

  const { datos } = useConsulta(async () => {
    const reporte = await db.reportes.get(reporteHoyId);
    const [envio, pdf, aprobador] = await Promise.all([
      ultimoEnvio(reporteHoyId), db.pdfs.get(reporteHoyId),
      reporte?.aprobadoPor ? db.usuarios.get(reporte.aprobadoPor) : Promise.resolve(undefined),
    ]);
    return { reporte, envio, pdf, aprobador };
  }, [reporteHoyId]);

  useEffect(() => {
    armarDatosInforme(reporteHoyId)
      .then((d) => setArchivo({ nombre: nombreArchivoPdf(d), fotos: d.secciones.reduce((n, sec) => n + sec.fotos.length, 0) }))
      .catch(() => {});
  }, [reporteHoyId]);

  if (!datos) return <Cargando />;
  const { reporte, envio, pdf, aprobador } = datos;
  if (!reporte) return <Pantalla><MensajeError>No se encontró el reporte del turno.</MensajeError></Pantalla>;

  const destinatarios = envio?.destinatarios ?? contexto.contrato.destinatarios;
  const elaborado = nombreCorto(contexto.usuario.nombre);

  async function confirmar() {
    setEnviando(true); setErrorLocal(undefined);
    try {
      const r = await enviarReporte(reporteHoyId);
      if (r.estado === "fallido") setErrorLocal(r.error);
      refrescar();
    } catch (err) {
      setErrorLocal(mensaje(err));
    } finally {
      setEnviando(false);
    }
  }

  async function verPdf() {
    setErrorPdf(undefined);
    try {
      if (!pdf) throw new Error("No se encontró el PDF guardado en el teléfono.");
      await guardarPdf(pdf.pdf, archivo?.nombre ?? `Reporte_Diario_${numeroCorto(reporte!.correlativo)}.pdf`);
    } catch (err) { setErrorPdf(mensaje(err)); }
  }

  const tarjetaPdf = (
    <button className={e.pdf} onClick={() => router.push("/vista-previa")} aria-label="Abrir la vista previa del PDF">
      <span className={e.iconoPdf}>PDF</span>
      <b>{archivo ? `${archivo.nombre} · ${archivo.fotos} ${archivo.fotos === 1 ? "foto" : "fotos"}` : "Reporte del turno"}</b>
    </button>
  );

  // 05c · Enviado
  if (reporte.estado === "enviado" || envio?.estado === "enviado") {
    const enviadoEn = envio?.enviadoEn;
    const plazo = enviadoEn ? diferenciaMin(enviadoEn, instante(reporte.fecha, contexto.contrato.horaCierreTurnoDia)) : undefined;
    return (
      <Pantalla pie={
        <>
          {errorPdf && <MensajeError>{errorPdf}</MensajeError>}
          <button className={s.botonSecundario} onClick={verPdf}>Ver PDF enviado</button>
          <button className={s.botonPrimario} onClick={() => router.push("/")}>Volver al turno</button>
        </>
      }>
        <Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Enviar al mandante" />
        <div className={e.exito}>
          <span className={e.check}><IcoCheck size={52} /></span>
          <h2 className={s.tituloEstado}>Reporte enviado</h2>
          <p className={s.textoSuave}>Enviado {hora(enviadoEn)} · acuse recibido</p>
        </div>
        <div className={`${l.tabla} ${l.tablaSinLineas}`} style={{ border: 0, padding: "10px 16px" }}>
          <div className={l.par}><span>Reporte</span><b>{numeroCorto(reporte.correlativo)}</b></div>
          <div className={l.par}><span>Aprobado por</span><b>{nombreCorto(aprobador?.nombre ?? contexto.usuario.nombre)}{reporte.horaAprobacion ? ` · ${hora(reporte.horaAprobacion)}` : ""}</b></div>
          <div className={l.par}><span>Destinatarios</span><b>{destinatarios.length}</b></div>
          {plazo !== undefined && (
            <div className={l.par}><span>{plazo >= 0 ? "Antes del plazo" : "Después del plazo"}</span><b>{duracion(plazo)}</b></div>
          )}
        </div>
        <p className={s.textoSuave} style={{ textAlign: "center", marginTop: 16 }}>
          El reporte enviado no se edita.<br />Una corrección genera un envío nuevo.
        </p>
      </Pantalla>
    );
  }

  // 05d · En cola sin red
  if (envio?.estado === "en_cola" && !enviando) {
    return (
      <Pantalla pie={<button className={s.botonPrimario} onClick={() => router.push("/")}>Volver al turno</button>}>
        <Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Enviar al mandante" />
        <Aviso tono="ambar" icono={<IcoSinSenal />} titulo="Pendiente de envío por falta de red">
          PDF aprobado y guardado.<br />Se enviará solo al detectar señal.
        </Aviso>
        {tarjetaPdf}
        <Etiqueta>Elaborado por</Etiqueta>
        <div className={s.campo} style={{ fontWeight: 400 }}>{elaborado}</div>
        <Etiqueta derecha="Del contrato">Destinatarios</Etiqueta>
        {destinatarios.map((d) => <div key={d} className={s.campo} style={{ fontWeight: 400 }}>{d}</div>)}
        <p className={s.textoSuave}>Puedes cerrar la app: el envío queda en cola.</p>
        <button className={`${s.botonSecundario} ${s.botonChico}`} onClick={confirmar}>Reintentar ahora</button>
      </Pantalla>
    );
  }

  // Sin aprobar: la aprobación solo se da desde la vista previa (regla 9).
  if (reporte.estado !== "aprobado") {
    return (
      <Pantalla pie={<button className={s.botonPrimario} onClick={() => router.push("/vista-previa")}>Ir a la vista previa</button>}>
        <Encabezado volver={{ texto: "Borrador", href: "/borrador" }} titulo="Enviar al mandante" />
        <Aviso tono="ambar" icono={<IcoAlerta />} titulo="El reporte aún no está aprobado">
          Revisa el PDF en la vista previa y toca «Aprobar y enviar».
        </Aviso>
      </Pantalla>
    );
  }

  const ocupado = enviando || envio?.estado === "enviando";
  const fallido = errorLocal ?? (envio?.estado === "fallido" ? envio.error ?? "El envío no se completó." : undefined);

  // 05a / 05b · Con datos y enviando
  return (
    <Pantalla pie={
      <button className={s.botonPrimario} onClick={confirmar} disabled={ocupado}>
        {ocupado ? <><Giro chico /> Enviando…</> : fallido ? "Reintentar envío" : "Confirmar envío"}
      </button>
    }>
      <Encabezado volver={{ texto: "Vista previa", href: "/vista-previa" }} titulo="Enviar al mandante" />
      {fallido && !ocupado && (
        <Aviso tono="rojo" icono={<IcoAlerta />} titulo="No se pudo enviar el reporte">
          {fallido}<br />El PDF quedó guardado; puedes reintentar.
        </Aviso>
      )}
      <div className={ocupado ? s.atenuado : undefined} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tarjetaPdf}
        <Etiqueta>Elaborado por</Etiqueta>
        <div className={s.campo} style={{ fontWeight: 400 }}>{elaborado}</div>
        <Etiqueta derecha="Del contrato">Destinatarios</Etiqueta>
        {destinatarios.map((d) => <div key={d} className={s.campo} style={{ fontWeight: 400 }}>{d}</div>)}
        <p className={s.textoSuave}>
          Aprobado por {nombreCorto(aprobador?.nombre ?? contexto.usuario.nombre)}{reporte.horaAprobacion ? ` a las ${hora(reporte.horaAprobacion)}` : ""}.
          Al confirmar se envía el PDF y se registra la hora de envío.
        </p>
      </div>
    </Pantalla>
  );
}

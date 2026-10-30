"use client";
// P5 · Entregar al jefe de turno (semana 8; antes «Enviar al mandante», HU-07).
// Pedido del profesor guía: cada inspector entrega su parte y el jefe de turno envía UN reporte consolidado.
// Estados: con datos (aprobado), entregando, entregado (subido a la nube, con resumen) y en cola sin red.
// Los reportes antiguos que ya se habían enviado al mandante siguen mostrando su pantalla de «Enviado».
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { numeroCorto, resumenReporte, ultimoEnvio } from "@/lib/repositorio";
import { entregarAlJefe, reintentarEntrega } from "@/lib/envio";
import { pendientesDeReporte } from "@/lib/sync";
import { supabaseConfigurado } from "@/lib/supabase";
import { useSesion } from "@/lib/sesion";
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
  const { contexto, reporteHoyId, conectado, errorSync, sincronizando, refrescar } = useApp();
  const sesion = useSesion();
  const [entregando, setEntregando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string>();
  const [archivo, setArchivo] = useState<{ nombre: string; fotos: number }>();
  const [errorPdf, setErrorPdf] = useState<string>();

  const { datos } = useConsulta(async () => {
    const reporte = await db.reportes.get(reporteHoyId);
    const [envio, pdf, aprobador, resumen, porSubir, usuarios] = await Promise.all([
      ultimoEnvio(reporteHoyId), db.pdfs.get(reporteHoyId),
      reporte?.aprobadoPor ? db.usuarios.get(reporte.aprobadoPor) : Promise.resolve(undefined),
      resumenReporte(reporteHoyId),
      pendientesDeReporte(reporteHoyId),
      db.usuarios.toArray(),
    ]);
    const jefes = usuarios.filter((u) => u.rol === "jefatura" && u.activo !== false && u.id !== reporte?.elaboradoPor);
    return { reporte, envio, pdf, aprobador, resumen, porSubir, jefes };
  }, [reporteHoyId]);

  useEffect(() => {
    armarDatosInforme(reporteHoyId)
      .then((d) => setArchivo({ nombre: nombreArchivoPdf(d), fotos: d.secciones.reduce((n, sec) => n + sec.fotos.length, 0) }))
      .catch(() => {});
  }, [reporteHoyId]);

  if (!datos) return <Cargando />;
  const { reporte, envio, pdf, aprobador, resumen, porSubir, jefes } = datos;
  if (!reporte) return <Pantalla><MensajeError>No se encontró el reporte del turno.</MensajeError></Pantalla>;

  const elaborado = nombreCorto(contexto.usuario.nombre);
  const soyJefe = sesion?.rol === "jefatura";
  const titulo = soyJefe ? "Entregar mi parte" : "Entregar al jefe de turno";
  const receptor = jefes.length ? jefes.map((j) => nombreCorto(j.nombre)).join(" / ") : "Jefe de turno";

  async function entregar() {
    setEntregando(true); setErrorLocal(undefined);
    try {
      const r = reporte!.estado === "entregado" ? await reintentarEntrega(reporteHoyId) : await entregarAlJefe(reporteHoyId);
      if (r.estado === "fallido") setErrorLocal(r.error);
      refrescar();
    } catch (err) {
      setErrorLocal(mensaje(err));
    } finally {
      setEntregando(false);
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
      <b>{archivo ? `${archivo.nombre} · ${archivo.fotos} ${archivo.fotos === 1 ? "foto" : "fotos"}` : "Parte del turno"}</b>
    </button>
  );

  const cifras = (
    <div className={`${l.tabla} ${l.tablaSinLineas}`} style={{ border: 0, padding: "10px 16px" }}>
      <div className={l.par}><span>Parte</span><b>{numeroCorto(reporte.correlativo)} · {elaborado}</b></div>
      <div className={l.par}><span>Áreas</span><b>{resumen.areas} ({resumen.sinActividad} sin actividad)</b></div>
      <div className={l.par}><span>Alertas</span><b>{resumen.alertas.length}{resumen.porCriticidad.alta ? ` · ${resumen.porCriticidad.alta} alta` : ""}</b></div>
      <div className={l.par}><span>Fotografías</span><b>{resumen.fotos}</b></div>
      <div className={l.par}><span>Se entrega a</span><b>{receptor}</b></div>
    </div>
  );

  // Reportes antiguos ya enviados al mandante (antes de la consolidación): se muestran como estaban.
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
          <div className={l.par}><span>Destinatarios</span><b>{(envio?.destinatarios ?? contexto.contrato.destinatarios).length}</b></div>
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

  // Entregado: ya en la nube (el jefe de turno la ve) o en cola hasta que vuelva la señal.
  if (reporte.estado === "entregado") {
    const subido = supabaseConfigurado && porSubir === 0;
    const ocupado = entregando || sincronizando;
    if (subido) {
      return (
        <Pantalla pie={
          <>
            {errorPdf && <MensajeError>{errorPdf}</MensajeError>}
            <button className={s.botonSecundario} onClick={verPdf}>Ver PDF de mi parte</button>
            <button className={s.botonPrimario} onClick={() => router.push("/")}>Volver al turno</button>
          </>
        }>
          <Encabezado volver={{ texto: "Turno", href: "/" }} titulo={titulo} />
          <div className={e.exito}>
            <span className={e.check}><IcoCheck size={52} /></span>
            <h2 className={s.tituloEstado}>Parte entregada</h2>
            <p className={s.textoSuave}>Entregada {hora(reporte.entregadoEn)} · disponible para el jefe de turno</p>
          </div>
          {cifras}
          <p className={s.textoSuave} style={{ textAlign: "center", marginTop: 16 }}>
            El jefe de turno junta las partes de todos los inspectores y envía un solo reporte al mandante.
          </p>
          <p className={s.textoSuave} style={{ textAlign: "center" }}>
            Si corriges algo, tu parte vuelve a borrador y tendrás que entregarla de nuevo.
          </p>
        </Pantalla>
      );
    }
    return (
      <Pantalla pie={<button className={s.botonPrimario} onClick={() => router.push("/")}>Volver al turno</button>}>
        <Encabezado volver={{ texto: "Turno", href: "/" }} titulo={titulo} />
        {!supabaseConfigurado ? (
          <Aviso tono="gris" icono={<IcoAlerta />} titulo="Parte entregada en este teléfono">
            Este teléfono no tiene configurada la nube (Supabase): la parte queda guardada aquí y el jefe de turno no la verá.
          </Aviso>
        ) : !conectado ? (
          <Aviso tono="ambar" icono={<IcoSinSenal />} titulo="Entregada · pendiente de subir por falta de red">
            Tu parte quedó guardada.<br />Se subirá sola al detectar señal.
          </Aviso>
        ) : (
          <Aviso tono="ambar" icono={<IcoAlerta />} titulo={ocupado ? "Subiendo tu parte…" : "Entregada · aún no se termina de subir"}>
            {porSubir} {porSubir === 1 ? "elemento pendiente" : "elementos pendientes"}. Se reintentará solo.
            {!ocupado && errorSync && <><br /><small>{errorSync}</small></>}
          </Aviso>
        )}
        {tarjetaPdf}
        {cifras}
        {errorLocal && <MensajeError>{errorLocal}</MensajeError>}
        <p className={s.textoSuave}>Puedes cerrar la app: la entrega queda en cola.</p>
        {supabaseConfigurado && (
          <button className={`${s.botonSecundario} ${s.botonChico}`} onClick={entregar} disabled={ocupado}>
            {ocupado ? <><Giro chico /> Subiendo…</> : "Reintentar ahora"}
          </button>
        )}
      </Pantalla>
    );
  }

  // Sin aprobar: la aprobación solo se da desde la vista previa (regla 9).
  if (reporte.estado !== "aprobado") {
    return (
      <Pantalla pie={<button className={s.botonPrimario} onClick={() => router.push("/vista-previa")}>Ir a la vista previa</button>}>
        <Encabezado volver={{ texto: "Borrador", href: "/borrador" }} titulo={titulo} />
        <Aviso tono="ambar" icono={<IcoAlerta />} titulo="Tu parte aún no está aprobada">
          Revisa el PDF en la vista previa y toca «Aprobar y entregar».
        </Aviso>
      </Pantalla>
    );
  }

  // Con datos y entregando.
  return (
    <Pantalla pie={
      <button className={s.botonPrimario} onClick={entregar} disabled={entregando}>
        {entregando ? <><Giro chico /> Entregando…</> : errorLocal ? "Reintentar entrega" : titulo}
      </button>
    }>
      <Encabezado volver={{ texto: "Vista previa", href: "/vista-previa" }} titulo={titulo} />
      {errorLocal && !entregando && (
        <Aviso tono="rojo" icono={<IcoAlerta />} titulo="No se pudo entregar tu parte">
          {errorLocal}
        </Aviso>
      )}
      <div className={entregando ? s.atenuado : undefined} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tarjetaPdf}
        <Etiqueta>Elaborado por</Etiqueta>
        <div className={s.campo} style={{ fontWeight: 400 }}>{elaborado}</div>
        <Etiqueta derecha="Arma el reporte consolidado">Se entrega a</Etiqueta>
        <div className={s.campo} style={{ fontWeight: 400 }}>{receptor}</div>
        <p className={s.textoSuave}>
          Aprobado por {nombreCorto(aprobador?.nombre ?? contexto.usuario.nombre)}{reporte.horaAprobacion ? ` a las ${hora(reporte.horaAprobacion)}` : ""}.
          Al entregar, tu parte (registros, alertas, fotos y PDF) sube a la nube y el jefe de turno la incluye
          en el reporte único que se envía al mandante.
        </p>
      </div>
    </Pantalla>
  );
}

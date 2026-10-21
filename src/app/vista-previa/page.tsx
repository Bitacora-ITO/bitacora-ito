"use client";
// P4.5 · Vista previa del PDF (HU-09). Regla 9: el reporte pasa a «generado» al armar el PDF
// y solo desde aquí se aprueba («Aprobar y enviar»).
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { aprobarReporte, areasSinResolver, guardarPdfGenerado } from "@/lib/repositorio";
import { armarDatosInforme } from "@/lib/informe/armar";
import { generarPdfInforme } from "@/lib/informe/pdf";
import VistaPreviaPdf from "@/components/VistaPreviaPdf";
import { mensaje, useApp } from "@/components/Proveedor";
import { Aviso, Encabezado, Giro, Pantalla, estilos as s } from "@/components/ui";
import { IcoAlerta } from "@/components/iconos";
import v from "./vista.module.css";

type Estado =
  | { tipo: "generando" }
  | { tipo: "sin_resolver"; n: number }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; pdf: Blob; aprobado: boolean };

export default function VistaPrevia() {
  const router = useRouter();
  const { contexto, reporteHoyId } = useApp();
  const [estado, setEstado] = useState<Estado>({ tipo: "generando" });
  const [pagina, setPagina] = useState({ actual: 1, total: 1 });
  const [aprobando, setAprobando] = useState(false);
  const [errorAprobar, setErrorAprobar] = useState<string>();
  const enCurso = useRef(false);

  const generar = useCallback(async (forzar = false) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setEstado({ tipo: "generando" });
    try {
      const reporte = await db.reportes.get(reporteHoyId);
      if (!reporte) throw new Error("No se encontró el reporte del turno.");
      const guardado = await db.pdfs.get(reporteHoyId);
      // Ya aprobado o enviado: se muestra el mismo PDF, sin regenerarlo.
      if ((reporte.estado === "aprobado" || reporte.estado === "enviado") && guardado) {
        setEstado({ tipo: "listo", pdf: guardado.pdf, aprobado: true });
        return;
      }
      const sinResolver = await areasSinResolver(reporteHoyId);
      if (sinResolver.length > 0) { setEstado({ tipo: "sin_resolver", n: sinResolver.length }); return; }
      if (!forzar && reporte.estado === "generado" && guardado) {
        setEstado({ tipo: "listo", pdf: guardado.pdf, aprobado: false });
        return;
      }
      const pdf = await generarPdfInforme(await armarDatosInforme(reporteHoyId));
      await guardarPdfGenerado(reporteHoyId, pdf);
      setEstado({ tipo: "listo", pdf, aprobado: false });
    } catch (e) {
      setEstado({ tipo: "error", mensaje: mensaje(e) });
    } finally {
      enCurso.current = false;
    }
  }, [reporteHoyId]);

  useEffect(() => { generar(); }, [generar]);

  async function aprobar() {
    setAprobando(true); setErrorAprobar(undefined);
    try {
      if (estado.tipo === "listo" && !estado.aprobado) await aprobarReporte(reporteHoyId, contexto.usuario.id);
      router.push("/enviar");
    } catch (e) {
      setErrorAprobar(mensaje(e));
      setAprobando(false);
    }
  }

  const alCambiarPagina = useCallback((actual: number, total: number) => setPagina({ actual, total }), []);
  const listo = estado.tipo === "listo";

  return (
    <Pantalla pie={
      <>
        {listo && <p className={s.notaPie} style={{ fontSize: 14 }}>Así saldrá el PDF que se envía · pellizca para acercar</p>}
        {errorAprobar && <Aviso tono="rojo" icono={<IcoAlerta />} titulo="No se pudo aprobar">{errorAprobar}</Aviso>}
        <button className={s.botonSecundario} onClick={() => router.push("/borrador")}>Volver a editar</button>
        <button className={s.botonPrimario} onClick={aprobar} disabled={!listo || aprobando}>
          {aprobando ? <><Giro chico /> Aprobando…</> : listo && estado.aprobado ? "Ir a enviar" : "Aprobar y enviar"}
        </button>
      </>
    }>
      <Encabezado volver={{ texto: "Borrador", href: "/borrador" }} />
      <div className={v.titulo}>
        <b>Vista previa del PDF</b>
        {listo && <span className={s.textoSuave}>Pág. {pagina.actual} de {pagina.total}</span>}
      </div>

      {estado.tipo === "generando" && (
        <div className={s.centro}>
          <Giro />
          <b>Generando el PDF en el teléfono…</b>
          <p className={s.textoSuave}>No necesita señal.</p>
        </div>
      )}
      {estado.tipo === "sin_resolver" && (
        <Aviso tono="ambar" icono={<IcoAlerta />} titulo={estado.n === 1 ? "Falta resolver 1 área" : `Faltan resolver ${estado.n} áreas`}>
          Vuelve al borrador: cada área debe tener registro o declararse sin actividad.
        </Aviso>
      )}
      {estado.tipo === "error" && (
        <>
          <Aviso tono="rojo" icono={<IcoAlerta />} titulo="No se pudo generar el PDF">{estado.mensaje}</Aviso>
          <button className={`${s.botonSecundario} ${s.botonChico}`} onClick={() => generar(true)}>Reintentar</button>
        </>
      )}
      {listo && (
        <div className={v.visor}>
          <VistaPreviaPdf pdf={estado.pdf} alCambiarPagina={alCambiarPagina} />
        </div>
      )}
    </Pantalla>
  );
}

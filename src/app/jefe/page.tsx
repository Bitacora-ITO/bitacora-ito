"use client";
// Consolidación del turno (jefe de turno, semana 8). Pedido del profesor guía: varios inspectores por
// turno, cada uno entrega su parte y el jefe de turno envía UN solo reporte consolidado al mandante.
// Pasos: lista de partes (Supabase) → consolidar (descarga y fusión, lib/consolidar.ts) → revisión y clima
// → vista previa del PDF → «Aprobar y enviar al mandante» (misma API /api/enviar) → enviado.
// «Descargar paquete (.zip)» deja el PDF, un resumen.md y las fotos con nombres legibles.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { hoyLocal } from "@/lib/db";
import { CLIMA, numeroCorto, turnoActual } from "@/lib/repositorio";
import { obtenerSupabase } from "@/lib/supabase";
import { enviarCuerpoAlMandante } from "@/lib/envio";
import { aDatosInforme, estructurar, masRepetido } from "@/lib/consolidar";
import {
  aprobarYEnviar, descargarPartes, fuenteParaPantalla, leerEstadoTurno,
  type EstadoTurno, type PartesDescargadas,
} from "@/lib/consolidacion-remota";
import { armarPaquete, descargarArchivo, nombreBase } from "@/lib/paquete";
import { generarPdfInforme } from "@/lib/informe/pdf";
import { fechaCorta, hora, nombreCorto } from "@/lib/fechas";
import type { Clima, Turno } from "@/lib/types";
import { useConsulta } from "@/hooks/useConsulta";
import { mensaje, useApp } from "@/components/Proveedor";
import VistaPreviaPdf from "@/components/VistaPreviaPdf";
import { ListaPartes, ListaPendientes } from "@/components/consolidacion/ListaPartes";
import { Aviso, Chip, Encabezado, Etiqueta, Giro, MensajeError, Pantalla, Segmentado, estilos as s } from "@/components/ui";
import { IcoAlerta, IcoCheck, IcoSinSenal } from "@/components/iconos";
import l from "@/components/listas.module.css";
import e from "@/app/enviar/enviar.module.css";
import c from "@/components/consolidacion/consolidacion.module.css";
import { consolidadoLocal, guardarGenerado, idParaConsolidar, marcarAprobado, marcarEnviado } from "./local";

const OPC_CLIMA = (Object.keys(CLIMA) as Clima[]).map((valor) => ({ valor, etiqueta: CLIMA[valor] }));
const OPC_TURNO: { valor: Turno; etiqueta: string }[] = [{ valor: "dia", etiqueta: "Día" }, { valor: "noche", etiqueta: "Noche" }];

type Paso =
  | { tipo: "lista" }
  | { tipo: "descargando"; texto: string }
  | { tipo: "revision" }
  | { tipo: "generando" }
  | { tipo: "vista" }
  | { tipo: "enviando" }
  | { tipo: "enviado"; enviadoEn: string };

type Carga = { tipo: "cargando" } | { tipo: "error"; mensaje: string } | { tipo: "listo"; estado: EstadoTurno };

export default function Jefe() {
  const router = useRouter();
  const { contexto, conectado } = useApp();
  const contratoId = contexto.contrato.id;
  const [fecha, setFecha] = useState(hoyLocal());
  const [turno, setTurno] = useState<Turno>(turnoActual());
  const [carga, setCarga] = useState<Carga>({ tipo: "cargando" });
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [paso, setPaso] = useState<Paso>({ tipo: "lista" });
  const [error, setError] = useState<string>();
  const [descarga, setDescarga] = useState<PartesDescargadas>();
  const [fuentes, setFuentes] = useState<Map<string, string>>(new Map()); // id de foto → data URL
  const [clima, setClima] = useState<{ turno?: Clima; proyeccion?: Clima }>({});
  const [pdf, setPdf] = useState<Blob>();
  const [idConsolidado, setIdConsolidado] = useState<string>();
  const [pagina, setPagina] = useState({ actual: 1, total: 1 });
  const [verEnviado, setVerEnviado] = useState(false);

  const fuente = useMemo(() => fuenteParaPantalla(obtenerSupabase()), []);
  const local = useConsulta(() => consolidadoLocal(contratoId, fecha, turno), [contratoId, fecha, turno]).datos;

  const cargar = useCallback(async () => {
    if (!fuente) return;
    setCarga({ tipo: "cargando" });
    try {
      const estado = await leerEstadoTurno(fuente, contratoId, fecha, turno);
      setCarga({ tipo: "listo", estado });
      setElegidas(new Set(estado.partes.filter((p) => p.entregado).map((p) => p.reporteId)));
    } catch (err) {
      setCarga({ tipo: "error", mensaje: mensaje(err) });
    }
  }, [fuente, contratoId, fecha, turno]);

  useEffect(() => { void cargar(); }, [cargar]);

  const consolidacion = useMemo(() => {
    if (!descarga) return undefined;
    return estructurar(descarga.entrada, {
      climaTurno: clima.turno, climaProyeccion: clima.proyeccion, srcFoto: (f) => fuentes.get(f.id) ?? f.url,
    });
  }, [descarga, fuentes, clima]);

  const alCambiarPagina = useCallback((actual: number, total: number) => setPagina({ actual, total }), []);

  // ───────── Acciones ─────────

  async function consolidar() {
    if (!fuente) return;
    setError(undefined);
    setPaso({ tipo: "descargando", texto: "Leyendo las partes…" });
    try {
      const d = await descargarPartes(fuente, contratoId, fecha, turno, [...elegidas], (texto) => setPaso({ tipo: "descargando", texto }));
      const urls = new Map<string, string>();
      for (const [id, b] of d.fotos) urls.set(id, await blobADataUrl(b));
      setFuentes(urls);
      setDescarga(d);
      setClima({});
      setPdf(undefined);
      setIdConsolidado(await idParaConsolidar(contratoId, fecha, turno));
      setPaso({ tipo: "revision" });
    } catch (err) {
      setError(mensaje(err));
      setPaso({ tipo: "lista" });
    }
  }

  async function verVistaPrevia() {
    if (!consolidacion || !idConsolidado) return;
    setError(undefined);
    setPaso({ tipo: "generando" });
    try {
      const blob = await generarPdfInforme(aDatosInforme(consolidacion), "bitacora");
      await guardarGenerado(idConsolidado, contratoId, contexto.usuario.id, consolidacion, blob);
      setPdf(blob);
      setPaso({ tipo: "vista" });
    } catch (err) {
      setError(`No se pudo generar el PDF: ${mensaje(err)}`);
      setPaso({ tipo: "revision" });
    }
  }

  async function aprobarYEnviarAlMandante() {
    if (!fuente || !consolidacion || !pdf || !idConsolidado || !descarga) return;
    setError(undefined);
    setPaso({ tipo: "enviando" });
    const destinatarios = contexto.contrato.destinatarios.length ? contexto.contrato.destinatarios : descarga.destinatarios;
    const r = await aprobarYEnviar(fuente, {
      id: idConsolidado, contratoId, consolidadoPor: contexto.usuario.id, consolidacion, pdf, destinatarios,
      mandante: descarga.mandante || contexto.contrato.mandante, enviar: enviarCuerpoAlMandante,
    });
    if (r.ruta) await marcarAprobado(idConsolidado, r.ruta).catch(() => undefined);
    if (!r.ok) {
      setError(r.sinRed ? `${r.error} El PDF quedó guardado en el teléfono.` : r.error);
      setPaso({ tipo: "vista" });
      return;
    }
    await marcarEnviado(idConsolidado, contratoId, consolidacion.numero, r.enviadoEn).catch(() => undefined);
    setPaso({ tipo: "enviado", enviadoEn: r.enviadoEn });
  }

  async function descargarPaquete() {
    if (!consolidacion || !pdf || !descarga) return;
    setError(undefined);
    try {
      const fotos = new Map<string, Uint8Array>();
      for (const [id, b] of descarga.fotos) fotos.set(id, new Uint8Array(await b.arrayBuffer()));
      const zip = armarPaquete(consolidacion, new Uint8Array(await pdf.arrayBuffer()), fotos, {
        consolidadoPor: contexto.usuario.nombre, generadoEn: new Date().toISOString(),
      });
      await descargarArchivo(new Blob([zip as BlobPart], { type: "application/zip" }), `${nombreBase(consolidacion)}.zip`);
    } catch (err) {
      setError(`No se pudo armar el paquete: ${mensaje(err)}`);
    }
  }

  function alternar(id: string) {
    setElegidas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  const volverALista = () => { setError(undefined); setPaso({ tipo: "lista" }); };
  const botonPaquete = (
    <button className={`${s.botonSecundario} ${s.botonChico}`} onClick={descargarPaquete}>Descargar paquete (.zip)</button>
  );

  // ───────── Pantallas ─────────

  // Ya enviado (copia local): se muestra el PDF enviado, sin volver a enviarlo.
  if (verEnviado && local?.pdf) {
    return (
      <Pantalla pie={<button className={s.botonPrimario} onClick={() => setVerEnviado(false)}>Volver</button>}>
        <Encabezado volver={{ texto: "Consolidación", onClick: () => setVerEnviado(false) }} />
        <div className={c.titulo}><b>Reporte {numeroCorto(local.correlativo)} enviado</b><span className={s.textoSuave}>Pág. {pagina.actual} de {pagina.total}</span></div>
        <div className={c.visor}><VistaPreviaPdf pdf={local.pdf} alCambiarPagina={alCambiarPagina} /></div>
      </Pantalla>
    );
  }

  if (paso.tipo === "enviado" && consolidacion) {
    const n = contexto.contrato.destinatarios.length || descarga?.destinatarios.length || 0;
    return (
      <Pantalla pie={
        <>
          {error && <MensajeError>{error}</MensajeError>}
          {botonPaquete}
          <button className={s.botonPrimario} onClick={() => router.push("/")}>Volver al inicio</button>
        </>
      }>
        <Encabezado volver={{ texto: "Inicio", href: "/" }} titulo="Consolidación del turno" />
        <div className={e.exito}>
          <span className={e.check}><IcoCheck size={52} /></span>
          <h2 className={s.tituloEstado}>Reporte consolidado enviado</h2>
          <p className={s.textoSuave}>Enviado {hora(paso.enviadoEn)} al mandante · {n} {n === 1 ? "destinatario" : "destinatarios"}</p>
        </div>
        <div className={`${l.tabla} ${l.tablaSinLineas}`} style={{ border: 0, padding: "10px 16px" }}>
          <div className={l.par}><span>Reporte</span><b>{numeroCorto(consolidacion.correlativo)}</b></div>
          <div className={l.par}><span>Elaborado por</span><b>{consolidacion.inspectores.map(nombreCorto).join(" / ")}</b></div>
          <div className={l.par}><span>Aprobado por</span><b>{nombreCorto(contexto.usuario.nombre)} · jefe de turno</b></div>
          <div className={l.par}><span>Partes</span><b>{consolidacion.partes.length}</b></div>
          <div className={l.par}><span>Áreas · alertas · fotos</span><b>{consolidacion.totales.areas} · {consolidacion.totales.alertas} · {consolidacion.totales.fotos}</b></div>
        </div>
        <p className={s.textoSuave} style={{ textAlign: "center", marginTop: 16 }}>
          El reporte enviado no se edita.<br />Queda guardado en el teléfono y en la nube.
        </p>
      </Pantalla>
    );
  }

  if ((paso.tipo === "vista" || paso.tipo === "enviando") && pdf && consolidacion) {
    const enviando = paso.tipo === "enviando";
    const destinatarios = contexto.contrato.destinatarios.length ? contexto.contrato.destinatarios : descarga?.destinatarios ?? [];
    return (
      <Pantalla pie={
        <>
          {error && <Aviso tono="rojo" icono={<IcoAlerta />} titulo="No se pudo enviar">{error}</Aviso>}
          <p className={s.notaPie} style={{ fontSize: 14 }}>
            Se envía a {destinatarios.join(", ") || "—"} · pellizca para acercar
          </p>
          <div className={c.dosBotones} style={{ gridTemplateColumns: "auto 1fr" }}>
            <button className={`${s.botonSecundario} ${s.botonChico}`} style={{ padding: "0 20px" }} onClick={() => setPaso({ tipo: "revision" })} disabled={enviando}>Volver</button>
            <button className={`${s.botonSecundario} ${s.botonChico}`} onClick={descargarPaquete} disabled={enviando}>Descargar paquete (.zip)</button>
          </div>
          <button className={s.botonPrimario} onClick={aprobarYEnviarAlMandante} disabled={enviando}>
            {enviando ? <><Giro chico /> Enviando…</> : error ? "Reintentar envío al mandante" : "Aprobar y enviar al mandante"}
          </button>
        </>
      }>
        <Encabezado volver={{ texto: "Revisión", onClick: () => setPaso({ tipo: "revision" }) }} />
        <div className={c.titulo}>
          <b>Vista previa · Reporte {numeroCorto(consolidacion.correlativo)}</b>
          <span className={s.textoSuave}>Pág. {pagina.actual} de {pagina.total}</span>
        </div>
        <div className={`${c.visor} ${enviando ? s.atenuado : ""}`}><VistaPreviaPdf pdf={pdf} alCambiarPagina={alCambiarPagina} /></div>
      </Pantalla>
    );
  }

  if ((paso.tipo === "revision" || paso.tipo === "generando") && consolidacion && descarga) {
    const generando = paso.tipo === "generando";
    const climaDef = masRepetido(descarga.entrada.partes.map((p) => p.climaTurno));
    const t = consolidacion.totales;
    return (
      <Pantalla pie={
        <>
          {error && <MensajeError>{error}</MensajeError>}
          <button className={s.botonSecundario} onClick={volverALista} disabled={generando}>Volver a las partes</button>
          <button className={s.botonPrimario} onClick={verVistaPrevia} disabled={generando}>
            {generando ? <><Giro chico /> Generando el PDF…</> : "Ver vista previa del PDF"}
          </button>
        </>
      }>
        <Encabezado volver={{ texto: "Partes", onClick: volverALista }} titulo="Revisión del consolidado" />
        <h2 className={s.h1}>Reporte {contexto.contrato.numero}-{numeroCorto(consolidacion.correlativo)}</h2>
        <div><Chip tono="teal">Consolidado de {consolidacion.partes.length} {consolidacion.partes.length === 1 ? "parte" : "partes"}</Chip></div>
        <p className={s.textoSuave}>{fechaCorta(fecha)} · turno {turno === "dia" ? "día" : "noche"} · elaborado por {consolidacion.elaboradoPor}</p>
        {descarga.fotosFallidas > 0 && (
          <Aviso tono="ambar" icono={<IcoAlerta />} titulo={`${descarga.fotosFallidas} ${descarga.fotosFallidas === 1 ? "foto no se pudo descargar" : "fotos no se pudieron descargar"}`}>
            El reporte se arma sin ellas. Puedes volver y consolidar de nuevo.
          </Aviso>
        )}

        <div className={c.numeros}>
          <div className={c.numero}><b>{t.areas}</b><span>{t.areas === 1 ? "área" : "áreas"}</span></div>
          <div className={c.numero}><b style={{ color: t.alertasAltas ? "var(--rojo)" : undefined }}>{t.alertas}</b><span>{t.alertas === 1 ? "alerta" : "alertas"}{t.alertasAltas ? ` · ${t.alertasAltas} alta` : ""}</span></div>
          <div className={c.numero}><b>{t.fotos}</b><span>{t.fotos === 1 ? "foto" : "fotos"}</span></div>
        </div>

        <Etiqueta derecha={climaDef ? `Más repetido: ${CLIMA[climaDef].toLowerCase()}` : undefined}>Clima del turno</Etiqueta>
        <Segmentado etiqueta="Clima del turno" opciones={OPC_CLIMA} valor={consolidacion.climaTurno}
          onChange={(v) => setClima((x) => ({ ...x, turno: v }))} deshabilitado={generando} />
        <Etiqueta>Proyección de mañana</Etiqueta>
        <Segmentado etiqueta="Proyección de mañana" opciones={OPC_CLIMA} valor={consolidacion.climaProyeccion}
          onChange={(v) => setClima((x) => ({ ...x, proyeccion: v }))} deshabilitado={generando} />

        <Etiqueta>Áreas del reporte</Etiqueta>
        <div className={l.tabla}>
          {consolidacion.areas.map((a) => (
            <div key={a.numero} className={c.seccion}>
              <b>{a.numero} {a.nombre}</b>
              {a.empresas.map((em) => (
                <small key={em.numero}>
                  {em.numero} {em.nombre} · {em.lineas.some((x) => x.sinActividad) ? "sin actividad" : `${em.lineas.length} ${em.lineas.length === 1 ? "línea" : "líneas"}`}
                  {" · "}{em.inspectores.map(nombreCorto).join(", ")}
                </small>
              ))}
            </div>
          ))}
        </div>
        <p className={s.textoSuave} style={{ fontSize: 14 }}>
          Las áreas con el mismo nombre se juntan; dentro de cada una, una subsección por empresa con las líneas de todos los inspectores, por hora.
        </p>
      </Pantalla>
    );
  }

  // Lista de partes (y descargando).
  const descargando = paso.tipo === "descargando";
  const estado = carga.tipo === "listo" ? carga.estado : undefined;
  const yaEnviado = local?.estado === "enviado";
  const nElegidas = estado ? estado.partes.filter((p) => elegidas.has(p.reporteId)).length : 0;
  const sinEntregar = estado ? estado.partes.filter((p) => elegidas.has(p.reporteId) && !p.entregado).length : 0;

  return (
    <Pantalla pie={
      <>
        {error && <MensajeError>{error}</MensajeError>}
        {yaEnviado ? (
          <button className={s.botonPrimario} onClick={() => setVerEnviado(true)}>Ver el PDF enviado</button>
        ) : (
          <>
            {sinEntregar > 0 && <p className={s.notaPie} style={{ fontSize: 14 }}>Incluyes {sinEntregar} {sinEntregar === 1 ? "parte que aún no se entrega" : "partes que aún no se entregan"}</p>}
            <button className={s.botonPrimario} onClick={consolidar} disabled={!fuente || !estado || nElegidas === 0 || descargando || !conectado}>
              {descargando ? <><Giro chico /> {paso.texto}</> : nElegidas ? `Consolidar ${nElegidas} ${nElegidas === 1 ? "parte" : "partes"}` : "Consolidar"}
            </button>
          </>
        )}
      </>
    }>
      <Encabezado volver={{ texto: "Inicio", href: "/" }} titulo="Consolidación del turno" />

      <div className={c.selector}>
        <div>
          <Etiqueta htmlFor="fecha-turno">Fecha</Etiqueta>
          <input id="fecha-turno" type="date" className={c.fecha} value={fecha} max={hoyLocal()}
            onChange={(ev) => ev.target.value && setFecha(ev.target.value)} disabled={descargando} />
        </div>
        <div>
          <Etiqueta>Turno</Etiqueta>
          <Segmentado etiqueta="Turno" opciones={OPC_TURNO} valor={turno} onChange={setTurno} deshabilitado={descargando} />
        </div>
      </div>

      {yaEnviado && (
        <Aviso tono="verde" icono={<IcoCheck />} titulo={`Reporte ${numeroCorto(local.correlativo)} enviado ${hora(local.enviadoEn)}`}>
          {local.elaboradoPorTexto}. El reporte enviado no se edita.
        </Aviso>
      )}
      {local && !yaEnviado && local.estado === "aprobado" && (
        <Aviso tono="ambar" icono={<IcoAlerta />} titulo={`Reporte ${numeroCorto(local.correlativo)} aprobado, sin enviar`}>
          Consolida de nuevo y toca «Aprobar y enviar al mandante» para reintentar.
        </Aviso>
      )}

      {!fuente ? (
        <Aviso tono="gris" icono={<IcoAlerta />} titulo="Este teléfono no tiene la nube configurada">
          Las partes de los inspectores se leen de Supabase. Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </Aviso>
      ) : !conectado && carga.tipo !== "listo" ? (
        <Aviso tono="ambar" icono={<IcoSinSenal />} titulo="Sin señal">
          Para ver las partes del turno necesitas conexión. Se cargarán al volver la señal.
        </Aviso>
      ) : carga.tipo === "cargando" ? (
        <div className={s.centro}><Giro /><p className={s.textoSuave}>Buscando las partes del turno…</p></div>
      ) : carga.tipo === "error" ? (
        <>
          <Aviso tono="rojo" icono={<IcoAlerta />} titulo="No se pudieron leer las partes">{carga.mensaje}</Aviso>
          <button className={`${s.botonSecundario} ${s.botonChico}`} onClick={() => void cargar()}>Reintentar</button>
        </>
      ) : estado && (
        <>
          <Etiqueta derecha={`${estado.partes.filter((p) => p.entregado).length} entregadas`}>Partes del turno</Etiqueta>
          <ListaPartes partes={estado.partes} elegidas={elegidas} alCambiar={alternar} deshabilitado={descargando || yaEnviado} />
          <ListaPendientes pendientes={estado.pendientes} />
          <button className={s.enlace} style={{ alignSelf: "flex-start" }} onClick={() => void cargar()} disabled={descargando}>Actualizar lista</button>
        </>
      )}
    </Pantalla>
  );
}

function blobADataUrl(b: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result));
    lector.onerror = () => mal(lector.error ?? new Error("No se pudo leer la fotografía."));
    lector.readAsDataURL(b);
  });
}

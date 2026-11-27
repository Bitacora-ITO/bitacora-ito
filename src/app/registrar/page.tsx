"use client";
// P2 · Registrar avance (HU-02 y HU-04): foto, GPS, empresa, descripción dictada o escrita, sin actividad.
// Prueba de usuarios (hallazgo 3): el interruptor pregunta «¿Hoy NO hubo trabajos en esta área?», explica cuándo
// usarlo y se apaga solo al escribir una descripción; si ya hay texto escrito, pide confirmar antes de activarlo.
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/db";
import {
  empresasDelContrato, esEditable, fotosDeRegistro, guardarRegistro, quitarRegistro, restaurarRegistro,
} from "@/lib/repositorio";
import { obtenerUbicacion, type FotoCapturada, type Ubicacion } from "@/lib/nativo";
import type { Area, AreaTurno, Empresa, Registro } from "@/lib/types";
import { hora } from "@/lib/fechas";
import { DESCRIPCION_MAX, FOTOS_MAX_REGISTRO, MENSAJES, errorDescripcion } from "@/lib/reglas";
import { useConsulta } from "@/hooks/useConsulta";
import { mensaje, useApp } from "@/components/Proveedor";
import CampoDescripcion, { type Origen } from "@/components/CampoDescripcion";
import SelectorFotos from "@/components/SelectorFotos";
import SelectorEmpresa from "@/components/SelectorEmpresa";
import {
  Aviso, Cargando, cx, Encabezado, Etiqueta, Giro, HojaInferior, Interruptor, MensajeError, Pantalla, estilos as s,
} from "@/components/ui";
import { IcoAlerta, IcoUbicacion } from "@/components/iconos";

export default function Pagina() {
  return <Suspense fallback={<Cargando />}><Registrar /></Suspense>;
}

interface Base {
  at: AreaTurno;
  area: Area;
  empresas: Empresa[];
  editable: boolean;
  editando?: Registro;
  fotosEditando: FotoCapturada[];
}

function Registrar() {
  const router = useRouter();
  const params = useSearchParams();
  const atId = params.get("at") ?? "";
  const regId = params.get("reg") ?? undefined;
  const { contexto, conectado, refrescar } = useApp();

  const [base, setBase] = useState<Base | null>();
  /** Por qué no se puede abrir el formulario: el área salió del turno o el registro pedido no existe. */
  const [falta, setFalta] = useState<"area" | "registro">("area");
  const [fotos, setFotos] = useState<FotoCapturada[]>([]);
  const [ubic, setUbic] = useState<Ubicacion | null | "buscando">("buscando");
  const [empresaId, setEmpresaId] = useState<string>();
  const [origen, setOrigen] = useState<Origen>("dictado");
  const [descripcion, setDescripcion] = useState("");
  const [sinActividad, setSinActividad] = useState(false);
  const [confirmarSin, setConfirmarSin] = useState(false);
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string>();
  /** Último registro quitado en esta pantalla, para ofrecer «Restaurar» de inmediato. */
  const [recienQuitado, setRecienQuitado] = useState<string>();

  useEffect(() => {
    let vivo = true;
    (async () => {
      const at = await db.areasTurno.get(atId);
      if (!at) { if (vivo) { setFalta("area"); setBase(null); } return; }
      const [area, empresas, reporte, editando] = await Promise.all([
        db.areas.get(at.areaId), empresasDelContrato(contexto.contrato.id), db.reportes.get(at.reporteId),
        regId ? db.registros.get(regId) : Promise.resolve(undefined),
      ]);
      const fotosEditando = editando
        ? (await fotosDeRegistro(editando.id)).map((f) => ({ imagen: f.imagen, capturadaEn: f.capturadaEn, latitud: f.latitud, longitud: f.longitud }))
        : [];
      if (!vivo || !area || !reporte) { if (vivo) { setFalta("area"); setBase(null); } return; }
      // Un enlace a un registro que no existe (o que ya se quitó) no abre un formulario vacío: avisa.
      if (regId && (!editando || editando.areaTurnoId !== at.id)) { setFalta("registro"); setBase(null); return; }
      setBase({ at, area, empresas, editable: await esEditable(reporte), editando, fotosEditando });
      setEmpresaId(at.empresaId);
      if (editando) {
        setFotos(fotosEditando);
        setDescripcion(editando.descripcion);
        setOrigen(editando.origenDescripcion);
        setSinActividad(editando.sinActividad);
      } else {
        // Si el área ya está declarada sin actividad, el interruptor parte encendido.
        const previos = await db.registros.where("areaTurnoId").equals(at.id).toArray();
        if (vivo && previos.length > 0 && previos.every((r) => r.sinActividad)) setSinActividad(true);
      }
    })().catch((e) => vivo && setError(mensaje(e)));
    return () => { vivo = false; };
  }, [atId, regId, contexto.contrato.id]);

  // GPS precargado al abrir la pantalla.
  useEffect(() => {
    let vivo = true;
    obtenerUbicacion().then((u) => vivo && setUbic(u)).catch(() => vivo && setUbic(null));
    return () => { vivo = false; };
  }, []);

  const { datos: registros = [] } = useConsulta(
    () => db.registros.where("areaTurnoId").equals(atId).sortBy("registradoEn"), [atId],
  );
  const { datos: quitados = [] } = useConsulta(
    () => db.registrosQuitados.where("areaTurnoId").equals(atId).sortBy("quitadoEn"), [atId],
  );

  if (base === undefined) return error ? <Pantalla><MensajeError>{error}</MensajeError></Pantalla> : <Cargando />;
  if (base === null) {
    return (
      <Pantalla pie={<button className={s.botonPrimario} onClick={() => router.push("/")}>Volver al turno</button>}>
        <Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Registrar avance" />
        {falta === "registro"
          ? <Aviso tono="rojo" icono={<IcoAlerta />} titulo="Este registro no existe o fue quitado.">Vuelve al turno para ver los registros de hoy.</Aviso>
          : <Aviso tono="rojo" icono={<IcoAlerta />} titulo="El área ya no está en el turno." />}
      </Pantalla>
    );
  }

  const otrosAvances = registros.filter((r) => !r.sinActividad && r.id !== base.editando?.id);
  const errFoto = sinActividad ? undefined
    : fotos.length === 0 ? MENSAJES.fotoFalta
      : fotos.length > FOTOS_MAX_REGISTRO ? MENSAJES.fotosMax : undefined;
  const errDesc = errorDescripcion(descripcion, sinActividad);
  const errEmp = !empresaId ? MENSAJES.empresaFalta : undefined;
  const faltan = [errFoto, errDesc, errEmp].filter(Boolean).length;
  const bloqueado = !base.editable || guardando;
  const lat = ubic && ubic !== "buscando" ? ubic.latitud : undefined;
  const lng = ubic && ubic !== "buscando" ? ubic.longitud : undefined;

  async function quitar(id: string) {
    setError(undefined);
    try { await quitarRegistro(id); setRecienQuitado(id); refrescar(); } catch (e) { setError(mensaje(e)); }
  }

  async function restaurar(id: string) {
    setError(undefined);
    try { await restaurarRegistro(id); setRecienQuitado(undefined); refrescar(); } catch (e) { setError(mensaje(e)); }
  }

  function cambiarSinActividad(v: boolean) {
    if (v && (otrosAvances.length > 0 || descripcion.trim())) { setConfirmarSin(true); return; }
    setSinActividad(v);
  }

  /** Escribir o dictar el avance significa que sí hubo trabajos: el interruptor se apaga solo. */
  function cambiarDescripcion(v: string) {
    setDescripcion(v);
    if (sinActividad && v.trim()) setSinActividad(false);
  }

  async function guardar() {
    setIntento(true);
    setError(undefined);
    if (faltan > 0 || !base) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setGuardando(true);
    try {
      await guardarRegistro({
        areaTurnoId: base.at.id, empresaId: empresaId!, sinActividad, descripcion, origen, fotos,
        latitud: lat, longitud: lng, registroId: base.editando?.id,
      });
      refrescar();
      router.push("/");
    } catch (e) {
      setError(mensaje(e));
      setGuardando(false);
    }
  }

  return (
    <Pantalla
      pie={
        <>
          <p className={s.notaPie}>{conectado ? "Se guarda en el teléfono y se sincroniza solo" : "Sin señal: se guarda y sincroniza después"}</p>
          <button className={s.botonPrimario} onClick={guardar} disabled={bloqueado}>
            {guardando ? <><Giro chico /> Guardando registro…</> : base.editando ? "Guardar cambios" : sinActividad ? "Guardar sin actividad" : "Guardar registro"}
          </button>
        </>
      }
    >
      <Encabezado volver={{ texto: "Turno", href: "/" }} titulo={base.area.nombre} />

      {!base.editable && <Aviso tono="gris" titulo="El reporte de hoy ya fue aprobado o enviado.">No se puede modificar.</Aviso>}
      {intento && faltan > 0 && (
        <Aviso tono="rojo" icono={<IcoAlerta />} titulo={faltan === 1 ? "Falta 1 dato para guardar" : `Faltan ${faltan} datos para guardar`} />
      )}
      {error && <Aviso tono="rojo" icono={<IcoAlerta />} titulo="No se guardó el registro">{error}</Aviso>}
      {recienQuitado && quitados.some((q) => q.id === recienQuitado) && (
        <Aviso tono="gris" titulo="Registro quitado.">
          Puedes restaurarlo mientras el reporte siga editable.{" "}
          <button className={s.enlace} onClick={() => restaurar(recienQuitado)}>Restaurar</button>
        </Aviso>
      )}

      <div className={cx(guardando && s.atenuado)} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className={cx(sinActividad && s.atenuado)} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Etiqueta obligatorio derecha="* obligatorio">Fotografía</Etiqueta>
          <SelectorFotos fotos={fotos} onChange={setFotos} error={intento ? errFoto : undefined} deshabilitado={bloqueado} etiquetaFoto="foto del avance" maximo={FOTOS_MAX_REGISTRO} />

          <Etiqueta derecha="Precargada">Ubicación</Etiqueta>
          <div className={s.campo}>
            <IcoUbicacion />
            {ubic === "buscando" ? <span className={s.textoSuave}>Buscando ubicación…</span>
              : ubic ? <span>GPS {ubic.latitud.toFixed(4)}, {ubic.longitud.toFixed(4)}</span>
                : <span className={s.textoSuave} style={{ fontWeight: 400 }}>Sin GPS: activa la ubicación (se guarda igual)</span>}
          </div>
        </div>

        <Etiqueta obligatorio>Empresa</Etiqueta>
        <SelectorEmpresa empresas={base.empresas} valor={empresaId} onChange={setEmpresaId} error={intento ? errEmp : undefined} deshabilitado={bloqueado} />

        {/* Atenuada pero escribible: al escribir se apaga «sin actividad». */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: sinActividad ? 0.55 : 1 }}>
          <Etiqueta obligatorio htmlFor="descripcion">Descripción del avance</Etiqueta>
          <CampoDescripcion id="descripcion" valor={descripcion} onChange={cambiarDescripcion} origen={origen} onOrigen={setOrigen}
            error={intento ? errDesc : undefined} deshabilitado={bloqueado} maximo={DESCRIPCION_MAX} />
        </div>

        <Interruptor destacado titulo="¿Hoy NO hubo trabajos en esta área?" activo={sinActividad}
          onChange={cambiarSinActividad} deshabilitado={bloqueado}
          detalle={<span style={{ display: "block", fontSize: 13, lineHeight: 1.45, marginTop: 2 }}>
            Actívalo solo si no hubo actividad.<br />
            Si ya escribiste el avance, déjalo apagado.<br />
            Se apaga solo al escribir una descripción.
          </span>} />
      </div>

      {registros.length > 0 && !base.editando && (
        <>
          <Etiqueta>Registrado hoy en esta área ({registros.length})</Etiqueta>
          <div className={s.lista}>
            {registros.map((r) => (
              <div key={r.id} className={s.tarjeta} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14 }}>{hora(r.registradoEn)} · {r.sinActividad ? "Sin actividad" : r.origenDescripcion === "dictado" ? "Dictado" : "Escrito"}</b>
                  {!r.sinActividad && <p className={s.textoSuave} style={{ whiteSpace: "pre-line", fontSize: 14 }}>{r.descripcion}</p>}
                </div>
                {base.editable && (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {!r.sinActividad && <button className={s.enlace} onClick={() => router.push(`/registrar?at=${atId}&reg=${r.id}`)}>Editar</button>}
                    <button className={s.enlace} style={{ color: "var(--rojo)" }}
                      onClick={() => quitar(r.id)}>Quitar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {quitados.length > 0 && !base.editando && (
        <>
          <Etiqueta>Quitados de esta área ({quitados.length})</Etiqueta>
          <div className={s.lista}>
            {quitados.map((q) => (
              <div key={q.id} className={s.tarjeta} style={{ display: "flex", gap: 8, alignItems: "flex-start", opacity: 0.75 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14 }}>Quitado a las {hora(q.quitadoEn)} · {q.registro.sinActividad ? "Sin actividad" : `${q.fotos.length} ${q.fotos.length === 1 ? "foto" : "fotos"}`}</b>
                  {!q.registro.sinActividad && <p className={s.textoSuave} style={{ whiteSpace: "pre-line", fontSize: 14 }}>{q.registro.descripcion}</p>}
                </div>
                {base.editable && <button className={s.enlace} onClick={() => restaurar(q.id)}>Restaurar</button>}
              </div>
            ))}
          </div>
          <p className={s.textoSuave} style={{ fontSize: 13, margin: 0 }}>
            Lo quitado no aparece en el reporte ni se sube a la nube. Se puede restaurar mientras el reporte siga editable.
          </p>
        </>
      )}

      {confirmarSin && (
        <HojaInferior titulo={otrosAvances.length > 0 ? "El área ya tiene registros" : "Ya escribiste un avance"} onCerrar={() => setConfirmarSin(false)}>
          <p style={{ margin: 0 }}>
            {otrosAvances.length > 0
              ? <>{base.area.nombre} tiene {otrosAvances.length === 1 ? "1 avance registrado" : `${otrosAvances.length} avances registrados`} hoy.
                Si la declaras sin actividad, esos registros se quitan del reporte.</>
              : <>Escribiste una descripción del avance. Si hubo trabajos, deja el interruptor apagado y guarda el registro.
                Si lo activas, la descripción se borra.</>}
          </p>
          <button className={s.botonSecundario} onClick={() => setConfirmarSin(false)}>{otrosAvances.length > 0 ? "Mantener los registros" : "Mantener lo escrito"}</button>
          <button className={s.botonPrimario} onClick={() => { setSinActividad(true); setDescripcion(""); setConfirmarSin(false); }}>Declarar sin actividad</button>
        </HojaInferior>
      )}
    </Pantalla>
  );
}

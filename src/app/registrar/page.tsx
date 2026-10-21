"use client";
// P2 · Registrar avance (HU-02 y HU-04): foto, GPS, empresa, descripción dictada o escrita, sin actividad.
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/db";
import {
  eliminarRegistro, empresasDelContrato, esEditable, fotosDeRegistro, guardarRegistro,
} from "@/lib/repositorio";
import { obtenerUbicacion, type FotoCapturada, type Ubicacion } from "@/lib/nativo";
import type { Area, AreaTurno, Empresa, Registro } from "@/lib/types";
import { hora } from "@/lib/fechas";
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

  useEffect(() => {
    let vivo = true;
    (async () => {
      const at = await db.areasTurno.get(atId);
      if (!at) { if (vivo) setBase(null); return; }
      const [area, empresas, reporte, editando] = await Promise.all([
        db.areas.get(at.areaId), empresasDelContrato(contexto.contrato.id), db.reportes.get(at.reporteId),
        regId ? db.registros.get(regId) : Promise.resolve(undefined),
      ]);
      const fotosEditando = editando
        ? (await fotosDeRegistro(editando.id)).map((f) => ({ imagen: f.imagen, capturadaEn: f.capturadaEn, latitud: f.latitud, longitud: f.longitud }))
        : [];
      if (!vivo || !area || !reporte) { if (vivo) setBase(null); return; }
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

  if (base === undefined) return error ? <Pantalla><MensajeError>{error}</MensajeError></Pantalla> : <Cargando />;
  if (base === null) {
    return (
      <Pantalla pie={<button className={s.botonPrimario} onClick={() => router.push("/")}>Volver al turno</button>}>
        <Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Registrar avance" />
        <Aviso tono="rojo" icono={<IcoAlerta />} titulo="El área ya no está en el turno." />
      </Pantalla>
    );
  }

  const otrosAvances = registros.filter((r) => !r.sinActividad && r.id !== base.editando?.id);
  const errFoto = !sinActividad && fotos.length === 0 ? "Toma al menos 1 fotografía del avance." : undefined;
  const errDesc = !sinActividad && !descripcion.trim() ? "Dicta o escribe qué se avanzó." : undefined;
  const errEmp = !empresaId ? "Elige la empresa." : undefined;
  const faltan = [errFoto, errDesc, errEmp].filter(Boolean).length;
  const bloqueado = !base.editable || guardando;
  const lat = ubic && ubic !== "buscando" ? ubic.latitud : undefined;
  const lng = ubic && ubic !== "buscando" ? ubic.longitud : undefined;

  function cambiarSinActividad(v: boolean) {
    if (v && otrosAvances.length > 0) { setConfirmarSin(true); return; }
    setSinActividad(v);
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

      <div className={cx(guardando && s.atenuado)} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className={cx(sinActividad && s.atenuado)} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Etiqueta obligatorio derecha="* obligatorio">Fotografía</Etiqueta>
          <SelectorFotos fotos={fotos} onChange={setFotos} error={intento ? errFoto : undefined} deshabilitado={bloqueado} etiquetaFoto="foto del avance" />

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

        <div className={cx(sinActividad && s.atenuado)} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Etiqueta obligatorio htmlFor="descripcion">Descripción del avance</Etiqueta>
          <CampoDescripcion id="descripcion" valor={descripcion} onChange={setDescripcion} origen={origen} onOrigen={setOrigen}
            error={intento ? errDesc : undefined} deshabilitado={bloqueado} />
        </div>

        <Interruptor titulo="Declarar sin actividad" detalle="Área sin trabajos hoy (HU-04)" activo={sinActividad}
          onChange={cambiarSinActividad} deshabilitado={bloqueado} />
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
                      onClick={() => eliminarRegistro(r.id).catch((e) => setError(mensaje(e)))}>Quitar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {confirmarSin && (
        <HojaInferior titulo="El área ya tiene registros" onCerrar={() => setConfirmarSin(false)}>
          <p style={{ margin: 0 }}>
            {base.area.nombre} tiene {otrosAvances.length === 1 ? "1 avance registrado" : `${otrosAvances.length} avances registrados`} hoy.
            Si la declaras sin actividad, esos registros se quitan del reporte.
          </p>
          <button className={s.botonSecundario} onClick={() => setConfirmarSin(false)}>Mantener los registros</button>
          <button className={s.botonPrimario} onClick={() => { setSinActividad(true); setConfirmarSin(false); }}>Declarar sin actividad</button>
        </HojaInferior>
      )}
    </Pantalla>
  );
}

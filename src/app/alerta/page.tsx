"use client";
// P3 · Nueva alerta (HU-03). Regla 4: criticidad alta exige al menos una fotografía (03b).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import {
  areasDelReporte, COLUMNA, CRITICIDAD, empresasDelContrato, esEditable, guardarAlerta,
} from "@/lib/repositorio";
import type { FotoCapturada } from "@/lib/nativo";
import type { ColumnaAlerta, Criticidad } from "@/lib/types";
import { useConsulta } from "@/hooks/useConsulta";
import { mensaje, useApp } from "@/components/Proveedor";
import CampoDescripcion, { type Origen } from "@/components/CampoDescripcion";
import SelectorFotos from "@/components/SelectorFotos";
import SelectorEmpresa from "@/components/SelectorEmpresa";
import {
  Aviso, Cargando, cx, Encabezado, Etiqueta, Giro, HojaInferior, Pantalla, Segmentado, estilos as s,
} from "@/components/ui";
import { IcoAlerta, IcoFlecha, IcoUbicacion } from "@/components/iconos";
import l from "@/components/listas.module.css";

const COLUMNAS = (Object.keys(COLUMNA) as ColumnaAlerta[]).map((valor) => ({ valor, etiqueta: COLUMNA[valor].corto }));
const CRITICIDADES = (["baja", "media", "alta"] as Criticidad[]).map((valor) => ({ valor, etiqueta: CRITICIDAD[valor] }));

export default function NuevaAlerta() {
  const router = useRouter();
  const { contexto, reporteHoyId, refrescar } = useApp();
  const [columna, setColumna] = useState<ColumnaAlerta>("construccion");
  const [criticidad, setCriticidad] = useState<Criticidad>();
  const [empresaId, setEmpresaId] = useState<string>();
  const [areaTurnoId, setAreaTurnoId] = useState<string>();
  const [descripcion, setDescripcion] = useState("");
  const [origen, setOrigen] = useState<Origen>("escrito");
  const [fotos, setFotos] = useState<FotoCapturada[]>([]);
  const [eligeArea, setEligeArea] = useState(false);
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string>();

  const { datos } = useConsulta(async () => {
    const reporte = await db.reportes.get(reporteHoyId);
    const [empresas, areas] = await Promise.all([empresasDelContrato(contexto.contrato.id), areasDelReporte(reporteHoyId)]);
    return { empresas, areas, editable: reporte ? await esEditable(reporte) : false };
  }, [reporteHoyId]);

  if (!datos) return <Cargando />;
  const area = datos.areas.find((a) => a.areaTurno.id === areaTurnoId);

  const errCrit = !criticidad ? "Elige la criticidad." : undefined;
  const errEmp = !empresaId ? "Elige la empresa involucrada." : undefined;
  const errDesc = !descripcion.trim() ? "Describe lo observado." : undefined;
  const errFoto = criticidad === "alta" && fotos.length === 0 ? "Adjunta al menos 1 foto para alerta alta." : undefined;
  const faltan = [errCrit, errEmp, errDesc, errFoto].filter(Boolean).length;
  const bloqueado = !datos.editable || guardando;

  async function guardar() {
    setIntento(true); setError(undefined);
    if (faltan > 0) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setGuardando(true);
    try {
      await guardarAlerta({ reporteId: reporteHoyId, columna, criticidad: criticidad!, empresaId, areaTurnoId, descripcion, fotos });
      refrescar();
      router.push("/");
    } catch (e) { setError(mensaje(e)); setGuardando(false); }
  }

  const soloFaltaFoto = intento && faltan === 1 && !!errFoto;

  return (
    <Pantalla pie={
      <button className={s.botonPrimario} onClick={guardar} disabled={bloqueado}>
        {guardando ? <><Giro chico /> Guardando alerta…</> : "Guardar alerta"}
      </button>
    }>
      <Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Nueva alerta" />
      {!datos.editable && <Aviso tono="gris" titulo="El reporte de hoy ya fue aprobado o enviado.">No se pueden agregar alertas.</Aviso>}
      {soloFaltaFoto && <Aviso tono="rojo" icono={<IcoAlerta />} titulo="No se guardó la alerta">Criticidad alta exige fotografía.</Aviso>}
      {intento && faltan > 0 && !soloFaltaFoto && (
        <Aviso tono="rojo" icono={<IcoAlerta />} titulo={faltan === 1 ? "Falta 1 dato para guardar" : `Faltan ${faltan} datos para guardar`} />
      )}
      {error && <Aviso tono="rojo" icono={<IcoAlerta />} titulo="No se guardó la alerta">{error}</Aviso>}

      <div className={cx(guardando && s.atenuado)} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Etiqueta obligatorio>Columna del reporte</Etiqueta>
        <Segmentado etiqueta="Columna del reporte" opciones={COLUMNAS} valor={columna} onChange={setColumna} deshabilitado={bloqueado} />

        <Etiqueta obligatorio>Criticidad</Etiqueta>
        <Segmentado etiqueta="Criticidad" opciones={CRITICIDADES} valor={criticidad} onChange={setCriticidad} deshabilitado={bloqueado} />
        {intento && errCrit && <p className={s.textoError}><IcoAlerta size={16} /> {errCrit}</p>}

        <Etiqueta obligatorio>Empresa</Etiqueta>
        <SelectorEmpresa empresas={datos.empresas} valor={empresaId} onChange={setEmpresaId} error={intento ? errEmp : undefined} deshabilitado={bloqueado} />

        <Etiqueta derecha="Opcional">Área</Etiqueta>
        <button type="button" className={s.campo} onClick={() => setEligeArea(true)} disabled={bloqueado}>
          <IcoUbicacion />
          <span className={s.crece} style={{ color: area ? undefined : "var(--gris)", fontWeight: area ? 600 : 400 }}>
            {area ? area.area.nombre : "Sin área específica"}
          </span>
          <IcoFlecha className={s.filaFlecha} />
        </button>

        <Etiqueta obligatorio htmlFor="desc-alerta">Descripción</Etiqueta>
        <CampoDescripcion id="desc-alerta" valor={descripcion} onChange={setDescripcion} origen={origen} onOrigen={setOrigen}
          error={intento ? errDesc : undefined} deshabilitado={bloqueado} placeholder="Dicta o escribe lo observado." />

        <Etiqueta obligatorio={criticidad === "alta"}>Fotografía de respaldo</Etiqueta>
        <SelectorFotos fotos={fotos} onChange={setFotos} error={intento ? errFoto : undefined} deshabilitado={bloqueado} etiquetaFoto="foto de la alerta" />
        {fotos.length > 0 && <p className={s.textoSuave}>{fotos.length === 1 ? "1 fotografía adjunta" : `${fotos.length} fotografías adjuntas`}</p>}
        {!(intento && errFoto) && fotos.length === 0 && <p className={s.textoSuave}>Obligatoria si la criticidad es alta.</p>}
      </div>

      {eligeArea && (
        <HojaInferior titulo="Área de la alerta" onCerrar={() => setEligeArea(false)}>
          <div className={l.caja}>
            <button className={`${l.item} ${!areaTurnoId ? l.itemActivo : ""}`} onClick={() => { setAreaTurnoId(undefined); setEligeArea(false); }}>
              <span className={l.texto}>Sin área específica</span>
            </button>
            {datos.areas.map((a) => (
              <button key={a.areaTurno.id} className={`${l.item} ${areaTurnoId === a.areaTurno.id ? l.itemActivo : ""}`}
                onClick={() => { setAreaTurnoId(a.areaTurno.id); if (!empresaId) setEmpresaId(a.empresa.id); setEligeArea(false); }}>
                <span className={l.texto}><b>{a.area.nombre}</b><small>{a.empresa.nombre}</small></span>
              </button>
            ))}
          </div>
        </HojaInferior>
      )}
    </Pantalla>
  );
}

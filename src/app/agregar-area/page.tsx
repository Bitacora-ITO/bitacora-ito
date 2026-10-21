"use client";
// P6 · Agregar área (HU-05): 06a elige del catálogo del contrato, 06b elige la empresa. No se escribe nada.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { agregarAreaAlTurno, areasDelContrato, empresasDelContrato } from "@/lib/repositorio";
import { useConsulta } from "@/hooks/useConsulta";
import { mensaje, useApp } from "@/components/Proveedor";
import ListaEmpresas from "@/components/ListaEmpresas";
import { Aviso, Cargando, Encabezado, Etiqueta, Giro, Pantalla, estilos as s } from "@/components/ui";
import { IcoAlerta, IcoCheck, IcoFlecha } from "@/components/iconos";
import l from "@/components/listas.module.css";

export default function AgregarArea() {
  const router = useRouter();
  const { contexto, reporteHoyId } = useApp();
  const [paso, setPaso] = useState<1 | 2>(1);
  const [areaId, setAreaId] = useState<string>();
  const [empresaId, setEmpresaId] = useState<string>();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string>();

  const { datos } = useConsulta(async () => {
    const [areas, empresas, enTurno, historico] = await Promise.all([
      areasDelContrato(contexto.contrato.id),
      empresasDelContrato(contexto.contrato.id),
      db.areasTurno.where("reporteId").equals(reporteHoyId).toArray(),
      db.areasTurno.toArray(),
    ]);
    // Empresa sugerida: la última que ejecutó esa área en un turno anterior.
    const ultima = new Map<string, { empresaId: string; en: string }>();
    for (const at of historico) {
      const u = ultima.get(at.areaId);
      if (!u || at.agregadaEn > u.en) ultima.set(at.areaId, { empresaId: at.empresaId, en: at.agregadaEn });
    }
    return { areas, empresas, enTurno: new Set(enTurno.map((a) => a.areaId)), ultima };
  }, [reporteHoyId]);

  if (!datos) return <Cargando />;
  const area = datos.areas.find((a) => a.id === areaId);

  function elegirEmpresa() {
    if (!areaId) return;
    setEmpresaId((e) => e ?? datos!.ultima.get(areaId)?.empresaId ?? datos!.empresas[0]?.id);
    setPaso(2);
  }

  async function agregar() {
    if (!areaId || !empresaId) return;
    setGuardando(true); setError(undefined);
    try {
      await agregarAreaAlTurno(reporteHoyId, areaId, empresaId);
      router.push("/");
    } catch (e) { setError(mensaje(e)); setGuardando(false); }
  }

  if (paso === 1) {
    return (
      <Pantalla pie={<button className={s.botonPrimario} disabled={!areaId} onClick={elegirEmpresa}>Elegir empresa</button>}>
        <Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Agregar área" />
        <p className={s.textoSuave} style={{ fontSize: 14, marginTop: -6 }}>Elige del catálogo del contrato. No se escribe.</p>
        <div className={l.caja} role="listbox" aria-label="Áreas del contrato">
          {datos.areas.map((a) => {
            const incluida = datos.enTurno.has(a.id);
            const activa = a.id === areaId;
            return (
              <button key={a.id} role="option" aria-selected={activa} disabled={incluida}
                className={`${l.item} ${activa ? l.itemActivo : ""}`} onClick={() => setAreaId(a.id)}>
                <span className={l.texto}>{a.nombre}</span>
                {incluida ? <span className={l.marca}>En el turno</span> : activa ? <IcoCheck /> : <IcoFlecha className={s.filaFlecha} />}
              </button>
            );
          })}
        </div>
      </Pantalla>
    );
  }

  return (
    <Pantalla pie={
      <button className={s.botonPrimario} disabled={!empresaId || guardando} onClick={agregar}>
        {guardando ? <><Giro chico /> Agregando…</> : "Agregar al turno"}
      </button>
    }>
      <Encabezado volver={{ texto: "Áreas", onClick: () => setPaso(1) }} titulo="Agregar área" />
      <Etiqueta>Área</Etiqueta>
      <div className={s.campo}>
        <span className={s.crece}>{area?.nombre}</span>
        <button className={s.enlace} onClick={() => setPaso(1)}>Cambiar</button>
      </div>
      <Etiqueta obligatorio>Empresa que ejecuta</Etiqueta>
      <ListaEmpresas empresas={datos.empresas} valor={empresaId} onChange={setEmpresaId} />
      {error && <Aviso tono="rojo" icono={<IcoAlerta />} titulo="No se agregó el área">{error}</Aviso>}
      <Aviso tono="gris">
        <span style={{ fontSize: 14 }}>
          Áreas y empresas vienen precargadas con el contrato: el inspector solo las elige. En el reporte, el área se numera sola (n.0) y la empresa queda como subsección (n.1).
        </span>
      </Aviso>
    </Pantalla>
  );
}

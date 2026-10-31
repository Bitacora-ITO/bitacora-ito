"use client";
// Inicio del jefe de turno (rol "jefatura"): acceso a la consolidación y, si también inspecciona, a sus registros.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { db, hoyLocal } from "@/lib/db";
import { numeroCorto, turnoActual } from "@/lib/repositorio";
import { fechaCorta, hora, nombreCorto } from "@/lib/fechas";
import { useConsulta } from "@/hooks/useConsulta";
import { useApp } from "@/components/Proveedor";
import MenuAjustes from "@/components/MenuAjustes";
import AvisoCatalogo from "@/components/catalogo/AvisoCatalogo";
import { Aviso, Chip, Pantalla, estilos as s } from "@/components/ui";
import { IcoAjustes, IcoCalendario, IcoCheck, IcoDocumento, IcoSinSenal } from "@/components/iconos";
import p from "@/app/turno.module.css";
import c from "./consolidacion.module.css";

export const CLAVE_MIS_REGISTROS = "inicio.misRegistros";

export default function InicioJefe({ alVerMisRegistros }: { alVerMisRegistros: () => void }) {
  const router = useRouter();
  const { contexto, conectado } = useApp();
  const [ajustes, setAjustes] = useState(false);
  const hoy = hoyLocal();
  const turno = turnoActual();

  const { datos } = useConsulta(async () => {
    const [consolidado, miParte] = await Promise.all([
      db.consolidados.where("[contratoId+fecha+turno]").equals([contexto.contrato.id, hoy, turno]).last(),
      db.reportes.where("[contratoId+fecha+turno]").equals([contexto.contrato.id, hoy, turno]).first(),
    ]);
    return { consolidado, miParte };
  }, [contexto.contrato.id, hoy, turno]);

  const consolidado = datos?.consolidado;
  return (
    <Pantalla pie={
      <>
        <button className={s.botonSecundario} onClick={alVerMisRegistros}>
          <IcoDocumento /> Mis registros del turno
        </button>
        <button className={s.botonPrimario} onClick={() => router.push("/jefe")}>
          {consolidado?.estado === "enviado" ? "Ver consolidación del turno" : "Consolidar el turno"}
        </button>
      </>
    }>
      <div className={p.cabecera}>
        <div style={{ minWidth: 0 }}>
          <h1 className={`${s.h1} ${p.titulo}`}>{turno === "dia" ? "Turno día" : "Turno noche"} · {fechaCorta(hoy)}</h1>
          <p className={s.subtitulo}>Contrato {contexto.contrato.numero} · {nombreCorto(contexto.usuario.nombre)} · jefe de turno</p>
        </div>
        <div className={p.iconos}>
          <button className={p.iconoPlano} onClick={() => setAjustes(true)} aria-label="Ajustes de la demostración"><IcoAjustes /></button>
          <button className={s.botonIcono} onClick={() => router.push("/historial")} aria-label="Historial"><IcoCalendario /></button>
        </div>
      </div>

      <AvisoCatalogo />

      <div className={c.inicio}>
        <h2>Consolidación del turno</h2>
        <p className={s.textoSuave}>
          Cada inspector entrega su parte. Tú las juntas en un solo reporte, lo revisas en PDF y lo envías al mandante.
        </p>
        {consolidado?.estado === "enviado" ? (
          <div><Chip tono="verde">Reporte {numeroCorto(consolidado.correlativo)} enviado {hora(consolidado.enviadoEn)}</Chip></div>
        ) : consolidado ? (
          <div><Chip tono="ambar">Reporte {numeroCorto(consolidado.correlativo)} {consolidado.estado === "aprobado" ? "aprobado, sin enviar" : "en revisión"}</Chip></div>
        ) : (
          <div><Chip tono="gris">Aún no consolidado</Chip></div>
        )}
      </div>

      {!conectado && (
        <Aviso tono="ambar" icono={<IcoSinSenal />} titulo="Sin señal">
          Para consolidar necesitas conexión: las partes de los inspectores están en la nube.
        </Aviso>
      )}
      {datos?.miParte?.estado === "entregado" && (
        <p className={s.textoSuave} style={{ display: "flex", gap: 6, alignItems: "center" }}><IcoCheck size={18} /> Tu propia parte del turno está entregada.</p>
      )}

      {ajustes && <MenuAjustes onCerrar={() => setAjustes(false)} />}
    </Pantalla>
  );
}

/** Barra fina sobre P1 cuando el jefe de turno abre «Mis registros»: vuelve a la consolidación. */
export function BarraJefe({ alVolver }: { alVolver: () => void }) {
  return (
    <div className={c.barraJefe}>
      <span>Jefe de turno · mis registros</span>
      <button className={s.enlace} onClick={alVolver}>← Consolidación</button>
    </div>
  );
}

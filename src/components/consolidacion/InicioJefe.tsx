"use client";
// Inicio del jefe de turno (rol "jefatura"): solo la consolidación del día (semana 8 v2: el jefe no registra).
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
import { IcoAjustes, IcoSinSenal } from "@/components/iconos";
import p from "@/app/turno.module.css";
import c from "./consolidacion.module.css";

export default function InicioJefe() {
  const router = useRouter();
  const { contexto, conectado } = useApp();
  const [ajustes, setAjustes] = useState(false);
  const hoy = hoyLocal();
  const turno = turnoActual();

  const { datos } = useConsulta(async () => {
    const consolidado = await db.consolidados.where("[contratoId+fecha+turno]").equals([contexto.contrato.id, hoy, turno]).last();
    return { consolidado };
  }, [contexto.contrato.id, hoy, turno]);

  const consolidado = datos?.consolidado;
  return (
    <Pantalla pie={
      <button className={s.botonPrimario} onClick={() => router.push("/jefe")}>
        {consolidado?.estado === "enviado" ? "Ver consolidación del día" : "Consolidar el día"}
      </button>
    }>
      <div className={p.cabecera}>
        <div style={{ minWidth: 0 }}>
          <h1 className={`${s.h1} ${p.titulo}`}>Turno día · {fechaCorta(hoy)}</h1>
          <p className={s.subtitulo}>Contrato {contexto.contrato.numero} · {nombreCorto(contexto.usuario.nombre)} · jefe de turno</p>
        </div>
        <div className={p.iconos}>
          <button className={p.iconoPlano} onClick={() => setAjustes(true)} aria-label="Ajustes y sesión"><IcoAjustes /></button>
        </div>
      </div>

      <AvisoCatalogo />

      <div className={c.inicio}>
        <h2>Consolidación del día</h2>
        <p className={s.textoSuave}>
          Ves las partes que los inspectores cerraron, firmaron y te enviaron. Las juntas en un solo reporte,
          lo revisas en PDF y, al aprobarlo, se envía el correo al mandante.
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
      {ajustes && <MenuAjustes onCerrar={() => setAjustes(false)} />}
    </Pantalla>
  );
}

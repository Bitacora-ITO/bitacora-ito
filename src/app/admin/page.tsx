"use client";
// Modo administrador: catálogo del contrato desde un Excel común.
// Descargar plantilla (llena con el catálogo actual) → Cargar Excel → vista previa con validación
// y resumen de cambios → Publicar catálogo (Supabase o simulación) → los teléfonos ven «Hay un catálogo nuevo».
import { useRef, useState } from "react";
import Link from "next/link";
import { catalogoActual, haySupabase, publicarCatalogo, usarSimulacion, type CatalogoActual } from "@/lib/catalogo";
import {
  frasesCambios, HOJAS, interpretarLibro, MARCA_EJEMPLO, NOMBRE_PLANTILLA, NOMBRE_PLANTILLA_EN_BLANCO, type Problema, type ResultadoLectura, type ResumenCambios,
} from "@/lib/catalogo-excel";
import { useSesion } from "@/lib/sesion";
import { hoyLocal } from "@/lib/db";
import { fechaCorta, hora } from "@/lib/fechas";
import { useConsulta } from "@/hooks/useConsulta";
import { guardarArchivo, leerLibro, plantillaEnBlancoXlsx, plantillaXlsx } from "@/components/catalogo/excel";
import { mensaje, useApp } from "@/components/Proveedor";
import { Aviso, Cargando, Chip, Encabezado, Etiqueta, Giro, Interruptor, MensajeError, Pantalla, estilos as s } from "@/components/ui";
import { IcoAlerta, IcoCheck, IcoDocumento } from "@/components/iconos";
import a from "./admin.module.css";

interface Carga {
  nombre: string;
  resultado: ResultadoLectura;
  base: CatalogoActual;
}

export default function Admin() {
  const sesion = useSesion();
  const { recargar, conectado } = useApp();
  const archivoRef = useRef<HTMLInputElement>(null);
  const [recarga, setRecarga] = useState(0);
  const [carga, setCarga] = useState<Carga>();
  const [trabajando, setTrabajando] = useState<"plantilla" | "blanco" | "leer" | "publicar">();
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState<string>();

  const { datos: actual, error: errorActual } = useConsulta(() => catalogoActual(), [recarga]);

  if (!sesion) return <Cargando texto="Cargando…" />;
  if (sesion.rol !== "admin") {
    return (
      <Pantalla>
        <Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Catálogo" />
        <Aviso tono="ambar" icono={<IcoAlerta />} titulo="Solo para administradores">
          Para cargar el catálogo, elige un usuario con rol Administrador en Ajustes → «¿Quién usa este teléfono?».
        </Aviso>
        <Link href="/" className={s.botonSecundario}>Volver al turno</Link>
      </Pantalla>
    );
  }

  async function descargarPlantilla(enBlanco: boolean) {
    if (!actual) return;
    setTrabajando(enBlanco ? "blanco" : "plantilla"); setError(undefined); setOk(undefined);
    try {
      const donde = enBlanco
        ? await guardarArchivo(await plantillaEnBlancoXlsx(), NOMBRE_PLANTILLA_EN_BLANCO)
        : await guardarArchivo(await plantillaXlsx(actual.catalogo), NOMBRE_PLANTILLA);
      setOk(`Plantilla guardada en ${donde}.`);
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setTrabajando(undefined);
    }
  }

  async function alElegirArchivo(f: File | undefined) {
    if (!f) return;
    setTrabajando("leer"); setError(undefined); setOk(undefined); setCarga(undefined);
    try {
      const base = await catalogoActual();
      const hojas = await leerLibro(f);
      setCarga({ nombre: f.name, resultado: interpretarLibro(hojas, base.catalogo), base });
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setTrabajando(undefined);
      if (archivoRef.current) archivoRef.current.value = ""; // permite volver a cargar el mismo archivo corregido
    }
  }

  async function publicar() {
    const cat = carga?.resultado.catalogo;
    if (!cat || !carga.resultado.cambios) return;
    setTrabajando("publicar"); setError(undefined); setOk(undefined);
    try {
      const version = await publicarCatalogo(cat, frasesCambios(carga.resultado.cambios), sesion?.usuario?.id);
      setCarga(undefined);
      setRecarga((n) => n + 1);
      await recargar();
      setOk(`Catálogo publicado · versión ${version}. Los teléfonos verán «Hay un catálogo nuevo · Actualizar».`);
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setTrabajando(undefined);
    }
  }

  async function cambiarSimulacion(v: boolean) {
    await usarSimulacion(v);
    setCarga(undefined);
    setRecarga((n) => n + 1);
  }

  const r = carga?.resultado;
  const v = actual?.version;
  // La primera publicación va aunque el Excel sea igual al catálogo del teléfono: arriba aún no hay versión.
  const primeraVez = !v;
  const puedePublicar = !!r?.catalogo && (!!r.cambios?.hayCambios || primeraVez) && !trabajando;

  return (
    <Pantalla
      pie={r?.catalogo ? (
        <>
          {!r.cambios?.hayCambios && (primeraVez
            ? <p className={s.notaPie}>Primera publicación: el catálogo quedará disponible para todos los teléfonos</p>
            : <p className={s.notaPie}>El Excel es igual al catálogo publicado: no hay nada que publicar</p>)}
          {actual?.fuente.tipo === "supabase" && !conectado && <p className={s.notaPie}>Sin señal: para publicar se necesita conexión</p>}
          <button className={s.botonPrimario} onClick={publicar} disabled={!puedePublicar || (actual?.fuente.tipo === "supabase" && !conectado)}>
            {trabajando === "publicar" ? <><Giro chico /> Publicando…</> : <><IcoCheck /> Publicar catálogo</>}
          </button>
        </>
      ) : undefined}
    >
      <Encabezado volver={{ texto: "Turno", href: "/" }} titulo="Catálogo del contrato" />

      {errorActual && <MensajeError>{errorActual.message}</MensajeError>}
      {!actual ? <p className={s.textoSuave}><Giro chico /> Leyendo el catálogo…</p> : (
        <div className={a.grupo}>
          <div className={a.grupoTitulo}>
            <span>Contrato {actual.catalogo.contrato.numero}</span>
            <Chip tono={v ? "teal" : "gris"}>{v ? `Versión ${v.version}` : "Sin publicar"}</Chip>
          </div>
          <div className={a.fuente}>
            <span className={a.totales}>
              {actual.catalogo.areas.filter((x) => x.vigente).length} áreas vigentes · {actual.catalogo.empresas.length} empresas ·{" "}
              {actual.catalogo.usuarios.filter((u) => u.activo !== false).length} usuarios activos
            </span>
            <span className={a.totales}>
              {v?.cargadoEn ? `Publicado el ${fechaCorta(hoyLocal(new Date(v.cargadoEn)))} a las ${hora(v.cargadoEn)} · ` : actual.origen === "telefono" ? "Aún no se publica: se compara con el catálogo de este teléfono · " : ""}
              {actual.fuente.descripcion}
            </span>
          </div>
        </div>
      )}
      {haySupabase && (
        <Interruptor titulo="Simular la publicación" detalle="Prueba en este teléfono sin escribir en Supabase"
          activo={actual?.fuente.tipo === "simulada"} onChange={cambiarSimulacion} deshabilitado={!!trabajando} />
      )}

      <div className={a.paso}>
        <span className={a.numero}>1</span>
        <div className={a.pasoCuerpo}>
          <b>Descargar la plantilla</b>
          <span className={s.textoSuave}>
            Con el catálogo actual, para editarlo, o en blanco, para llenarla desde cero. No cambie las hojas ni los encabezados.
          </span>
          <button className={`${s.botonSecundario} ${s.botonChico}`} onClick={() => descargarPlantilla(false)} disabled={!actual || !!trabajando}>
            {trabajando === "plantilla" ? <><Giro chico /> Preparando…</> : <><IcoDocumento /> Con el catálogo actual</>}
          </button>
          <button className={`${s.botonSecundario} ${s.botonChico}`} onClick={() => descargarPlantilla(true)} disabled={!actual || !!trabajando}>
            {trabajando === "blanco" ? <><Giro chico /> Preparando…</> : <><IcoDocumento /> En blanco, para llenar</>}
          </button>
          <span className={a.archivo}>La plantilla en blanco trae una fila de ejemplo marcada «{MARCA_EJEMPLO}» en cada hoja: la app la omite.</span>
        </div>
      </div>

      <div className={a.paso}>
        <span className={a.numero}>2</span>
        <div className={a.pasoCuerpo}>
          <b>Cargar el Excel</b>
          <span className={s.textoSuave}>Se revisa antes de publicar: nada cambia hasta tocar «Publicar catálogo».</span>
          <input ref={archivoRef} id="excel-catalogo" type="file" className={s.oculto}
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => alElegirArchivo(e.target.files?.[0])} />
          <button className={`${s.botonSecundario} ${s.botonChico}`} onClick={() => archivoRef.current?.click()} disabled={!actual || !!trabajando}>
            {trabajando === "leer" ? <><Giro chico /> Leyendo…</> : "Cargar Excel"}
          </button>
          {carga && <span className={a.archivo}>{carga.nombre}</span>}
        </div>
      </div>

      {error && <MensajeError>{error}</MensajeError>}
      {ok && <Aviso tono="verde" icono={<IcoCheck />}>{ok}</Aviso>}

      {r && <VistaPrevia r={r} />}
    </Pantalla>
  );
}

const ORDEN_HOJAS: Problema["hoja"][] = ["Libro", HOJAS.contrato, HOJAS.areas, HOJAS.empresas, HOJAS.usuarios];

function porHoja(lista: Problema[]) {
  return ORDEN_HOJAS.map((hoja) => ({ hoja, items: lista.filter((p) => p.hoja === hoja) })).filter((g) => g.items.length);
}

function VistaPrevia({ r }: { r: ResultadoLectura }) {
  const n = r.errores.length;
  return (
    <>
      <Etiqueta derecha={n ? `${n} ${n === 1 ? "error" : "errores"}` : "Sin errores"}>Vista previa</Etiqueta>
      {n > 0 && (
        <Aviso tono="rojo" icono={<IcoAlerta />} titulo={n === 1 ? "Hay 1 error en el Excel" : `Hay ${n} errores en el Excel`}>
          Corríjalos en el archivo y vuelva a cargarlo. No se publicó nada.
        </Aviso>
      )}
      {porHoja(r.errores).map((g) => (
        <div key={`e-${g.hoja}`} className={a.grupo}>
          <div className={a.grupoTitulo}>
            <span>{g.hoja === "Libro" ? "Archivo" : `Hoja «${g.hoja}»`}</span>
            <Chip tono="rojo">{g.items.length}</Chip>
          </div>
          <ul className={a.problemas}>
            {g.items.map((p, i) => (
              <li key={i}>{p.fila ? <span className={a.fila}>Fila {p.fila}</span> : null}<span>{p.mensaje}</span></li>
            ))}
          </ul>
        </div>
      ))}
      {r.avisos.length > 0 && (
        <div className={a.grupo}>
          <div className={a.grupoTitulo}><span>Para revisar</span><Chip tono="ambar">{r.avisos.length}</Chip></div>
          <ul className={a.problemas}>
            {r.avisos.map((p, i) => (
              <li key={i}><span className={`${a.fila} ${a.filaAviso}`}>{p.hoja}</span><span>{p.mensaje}</span></li>
            ))}
          </ul>
        </div>
      )}
      {r.cambios && <ResumenDeCambios c={r.cambios} />}
    </>
  );
}

function Linea({ cifra, texto, nombres }: { cifra: number; texto: string; nombres: string[] }) {
  if (!cifra) return null;
  return (
    <li>
      <span><span className={a.cifra}>{cifra}</span> {texto}</span>
      <span className={a.nombres}>{nombres.join(" · ")}</span>
    </li>
  );
}

function ResumenDeCambios({ c }: { c: ResumenCambios }) {
  const uno = (k: number, singular: string, plural: string) => (k === 1 ? singular : plural);
  const sinCambios = <span className={a.nombres}>Sin cambios</span>;
  const areas = c.areas, emp = c.empresas, us = c.usuarios;
  const hayA = areas.nuevas.length + areas.dejanDeEstarVigentes.length + areas.vuelvenAEstarVigentes.length + areas.cambianOrden.length > 0;
  const hayE = emp.nuevas.length + emp.cambianTipo.length + emp.seMantienen.length > 0;
  const hayU = us.nuevos.length + us.desactivados.length + us.reactivados.length + us.cambianRol.length + us.cambianCorreo.length > 0;
  return (
    <>
      {!c.hayCambios && <Aviso tono="gris" icono={<IcoCheck />}>El Excel no tiene errores y es igual al catálogo publicado.</Aviso>}
      <div className={a.grupo}>
        <div className={a.grupoTitulo}><span>Contrato</span></div>
        {c.contrato.length ? <span className={a.nombres}>Cambia: {c.contrato.join(", ")}</span> : sinCambios}
      </div>
      <div className={a.grupo}>
        <div className={a.grupoTitulo}><span>Áreas</span><span className={a.totales}>{areas.vigentes} vigentes de {areas.total}</span></div>
        {hayA ? (
          <ul className={a.cambios}>
            <Linea cifra={areas.nuevas.length} texto={uno(areas.nuevas.length, "área nueva", "áreas nuevas")} nombres={areas.nuevas} />
            <Linea cifra={areas.dejanDeEstarVigentes.length} texto={uno(areas.dejanDeEstarVigentes.length, "deja de estar vigente (no se borra: hay reportes que la usan)", "dejan de estar vigentes (no se borran: hay reportes que las usan)")} nombres={areas.dejanDeEstarVigentes} />
            <Linea cifra={areas.vuelvenAEstarVigentes.length} texto={uno(areas.vuelvenAEstarVigentes.length, "vuelve a estar vigente", "vuelven a estar vigentes")} nombres={areas.vuelvenAEstarVigentes} />
            <Linea cifra={areas.cambianOrden.length} texto={uno(areas.cambianOrden.length, "cambia de orden", "cambian de orden")} nombres={areas.cambianOrden} />
          </ul>
        ) : sinCambios}
      </div>
      <div className={a.grupo}>
        <div className={a.grupoTitulo}><span>Empresas</span><span className={a.totales}>{emp.total} en el Excel</span></div>
        {hayE ? (
          <ul className={a.cambios}>
            <Linea cifra={emp.nuevas.length} texto={uno(emp.nuevas.length, "empresa nueva", "empresas nuevas")} nombres={emp.nuevas} />
            <Linea cifra={emp.cambianTipo.length} texto={uno(emp.cambianTipo.length, "cambia de tipo", "cambian de tipo")} nombres={emp.cambianTipo} />
            <Linea cifra={emp.seMantienen.length} texto={uno(emp.seMantienen.length, "no viene en el Excel: se mantiene en los reportes, pero deja de ofrecerse", "no vienen en el Excel: se mantienen en los reportes, pero dejan de ofrecerse")} nombres={emp.seMantienen} />
          </ul>
        ) : sinCambios}
      </div>
      <div className={a.grupo}>
        <div className={a.grupoTitulo}><span>Usuarios</span><span className={a.totales}>{us.activos} activos de {us.total}</span></div>
        {hayU ? (
          <ul className={a.cambios}>
            <Linea cifra={us.nuevos.length} texto={uno(us.nuevos.length, "usuario nuevo", "usuarios nuevos")} nombres={us.nuevos} />
            <Linea cifra={us.desactivados.length} texto={uno(us.desactivados.length, "queda inactivo", "quedan inactivos")} nombres={us.desactivados} />
            <Linea cifra={us.reactivados.length} texto={uno(us.reactivados.length, "vuelve a estar activo", "vuelven a estar activos")} nombres={us.reactivados} />
            <Linea cifra={us.cambianRol.length} texto={uno(us.cambianRol.length, "cambia de rol", "cambian de rol")} nombres={us.cambianRol} />
            <Linea cifra={us.cambianCorreo.length} texto={uno(us.cambianCorreo.length, "cambia de correo", "cambian de correo")} nombres={us.cambianCorreo} />
          </ul>
        ) : sinCambios}
      </div>
    </>
  );
}

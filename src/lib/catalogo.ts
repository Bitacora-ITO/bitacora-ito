// Catálogo del contrato (áreas, empresas, usuarios y datos del contrato) entre el administrador y los teléfonos.
//
// - El administrador publica desde /admin: sube contrato, `frente`, `empresa` y `usuario` y aumenta
//   `catalogo_version.version`. Nunca borra: las áreas que salen quedan `vigente=false`, los usuarios
//   `activo=false` y las empresas se conservan (la tabla no tiene «vigente»; la lista de empresas
//   vigentes viaja en `catalogo_version.nota`).
// - Cada teléfono compara su versión local (en `ajustes`) con la remota al abrir y al volver la red
//   (`verificarCatalogo`) y, si hay una nueva, ofrece «Actualizar» (`descargarCatalogo`).
//
// El acceso remoto pasa por `FuenteCatalogo`: Supabase del equipo o una simulación guardada en el
// propio teléfono (`ajustes`), para probar sin escribir en Supabase. Sin Supabase configurado se usa
// siempre la simulación.
import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "./db";
import { hayRed } from "./nativo";
import { CLAVES } from "./repositorio";
import { obtenerSupabase, supabaseConfigurado } from "./supabase";
import type { Area, Contrato, Empresa, RolApp, TipoEmpresa, Usuario } from "./types";
import type { CatalogoDatos, CatalogoPublicable } from "./catalogo-excel";

export const CLAVES_CATALOGO = {
  versionLocal: "catalogo.versionLocal",
  versionRemota: "catalogo.versionRemota",
  verificadoEn: "catalogo.verificadoEn",
  empresasVigentes: "catalogo.empresasVigentes",
  /** "simulada" para publicar y leer en el teléfono sin tocar Supabase. */
  fuente: "catalogo.fuente",
  simulado: "catalogo.simulado",
} as const;

/** Misma clave que usa sesion.ts para el rol: si no existe, nadie ha elegido quién usa el teléfono. */
const CLAVE_ROL_SESION = "rolActual";

export interface NotaVersion {
  resumen?: string[];
  /** Ids de las empresas que venían en el Excel publicado. */
  empresas?: string[];
}

export interface VersionRemota {
  version: number;
  cargadoEn?: string;
  cargadoPor?: string;
  nota?: NotaVersion;
}

export interface CatalogoRemoto extends CatalogoDatos {
  version: VersionRemota | null;
}

export interface FuenteCatalogo {
  tipo: "supabase" | "simulada";
  descripcion: string;
  leerVersion(contratoId: string): Promise<VersionRemota | null>;
  /** null si el contrato aún no existe en la fuente. */
  leerCatalogo(contratoId: string): Promise<CatalogoRemoto | null>;
  /** Publica y devuelve el número de la versión nueva. */
  publicar(cat: CatalogoPublicable, opciones: { cargadoPor?: string; resumen: string[] }): Promise<number>;
}

// ───────────────────────── Ajustes ─────────────────────────

async function leer(clave: string): Promise<string | undefined> {
  return (await db.ajustes.get(clave))?.valor;
}

const entero = (s: string | undefined) => (s && Number.isFinite(Number(s)) ? Number(s) : 0);

function json<T>(s: string | null | undefined): T | undefined {
  if (!s) return undefined;
  try {
    return JSON.parse(s) as T;
  } catch {
    return undefined;
  }
}

async function contratoActualId(): Promise<string> {
  const id = (await leer(CLAVES.contrato)) ?? (await db.contratos.toCollection().first())?.id;
  if (!id) throw new Error("No hay contrato cargado en el teléfono.");
  return id;
}

// ───────────────────────── Fuente: Supabase ─────────────────────────

type FilaRemota = Record<string, unknown>;

const deContrato = (r: FilaRemota): Contrato => ({
  id: String(r.id), nombre: String(r.nombre ?? ""), numero: String(r.numero ?? ""), mandante: String(r.mandante ?? ""),
  codigoProyecto: String(r.codigo_proyecto ?? ""), codigoInterno: String(r.codigo_interno ?? ""),
  revisionFormato: String(r.revision_formato ?? ""), fechaFormato: String(r.fecha_formato ?? ""),
  prefijoCorrelativo: String(r.prefijo_correlativo ?? ""), ultimoCorrelativo: Number(r.ultimo_correlativo ?? 0),
  destinatarios: Array.isArray(r.destinatarios) ? (r.destinatarios as string[]) : [],
  horaCierreTurnoDia: String(r.hora_cierre_turno_dia ?? "19:00"),
});
const deFrente = (r: FilaRemota): Area => ({
  id: String(r.id), contratoId: String(r.contrato_id), nombre: String(r.nombre), orden: Number(r.orden ?? 0), vigente: r.vigente !== false,
});
const deEmpresa = (r: FilaRemota): Empresa => ({
  id: String(r.id), contratoId: String(r.contrato_id), nombre: String(r.nombre), tipo: String(r.tipo) as TipoEmpresa,
});
const deUsuario = (r: FilaRemota): Usuario => ({
  id: String(r.id), nombre: String(r.nombre), correo: String(r.correo ?? ""), rol: String(r.rol) as RolApp,
  contratoId: r.contrato_id ? String(r.contrato_id) : undefined, activo: r.activo !== false,
});

export const aFilaContrato = (c: Contrato) => ({
  id: c.id, nombre: c.nombre, numero: c.numero, mandante: c.mandante, codigo_proyecto: c.codigoProyecto,
  codigo_interno: c.codigoInterno, revision_formato: c.revisionFormato, fecha_formato: c.fechaFormato,
  prefijo_correlativo: c.prefijoCorrelativo, ultimo_correlativo: c.ultimoCorrelativo,
  destinatarios: c.destinatarios, hora_cierre_turno_dia: c.horaCierreTurnoDia,
});
export const aFilaFrente = (a: Area) => ({ id: a.id, contrato_id: a.contratoId, nombre: a.nombre, orden: a.orden, vigente: a.vigente });
export const aFilaEmpresa = (e: Empresa) => ({ id: e.id, contrato_id: e.contratoId, nombre: e.nombre, tipo: e.tipo });
export const aFilaUsuario = (u: Usuario, contratoId?: string) => ({
  id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, activo: u.activo !== false, contrato_id: u.contratoId ?? contratoId ?? null,
});

function errorRemoto(que: string, e: { message?: string } | null): Error {
  return new Error(`No se pudo ${que} en Supabase${e?.message ? `: ${e.message}` : "."}`);
}

export function fuenteSupabase(sb: SupabaseClient): FuenteCatalogo {
  async function leerVersion(contratoId: string): Promise<VersionRemota | null> {
    const { data, error } = await sb.from("catalogo_version").select("version, cargado_en, cargado_por, nota").eq("contrato_id", contratoId).maybeSingle();
    if (error) throw errorRemoto("leer la versión del catálogo", error);
    if (!data) return null;
    return {
      version: Number(data.version ?? 0), cargadoEn: data.cargado_en ?? undefined, cargadoPor: data.cargado_por ?? undefined,
      nota: json<NotaVersion>(data.nota) ?? (data.nota ? { resumen: [String(data.nota)] } : undefined),
    };
  }
  return {
    tipo: "supabase",
    descripcion: "Supabase del equipo",
    leerVersion,
    async leerCatalogo(contratoId) {
      const [c, f, e, u, version] = await Promise.all([
        sb.from("contrato").select("*").eq("id", contratoId).maybeSingle(),
        sb.from("frente").select("id, contrato_id, nombre, orden, vigente").eq("contrato_id", contratoId),
        sb.from("empresa").select("id, contrato_id, nombre, tipo").eq("contrato_id", contratoId),
        sb.from("usuario").select("id, nombre, correo, rol, activo, contrato_id").eq("contrato_id", contratoId),
        leerVersion(contratoId),
      ]);
      for (const [que, r] of [["leer el contrato", c], ["leer las áreas", f], ["leer las empresas", e], ["leer los usuarios", u]] as const) {
        if (r.error) throw errorRemoto(que, r.error);
      }
      if (!c.data) return null;
      return {
        contrato: deContrato(c.data),
        areas: (f.data ?? []).map(deFrente).sort((a, b) => a.orden - b.orden),
        empresas: (e.data ?? []).map(deEmpresa),
        usuarios: (u.data ?? []).map(deUsuario),
        version,
      };
    },
    async publicar(cat, { cargadoPor, resumen }) {
      const cid = cat.contrato.id;
      // Orden por las llaves foráneas: contrato → empresa → frente → usuario → versión. Solo upsert: nada se borra.
      const pasos: [string, string, FilaRemota[]][] = [
        ["contrato", "guardar el contrato", [aFilaContrato(cat.contrato)]],
        ["empresa", "guardar las empresas", cat.empresas.map(aFilaEmpresa)],
        ["frente", "guardar las áreas", cat.areas.map(aFilaFrente)],
        ["usuario", "guardar los usuarios", cat.usuarios.map((x) => aFilaUsuario(x, cid))],
      ];
      for (const [tabla, que, filas] of pasos) {
        if (!filas.length) continue;
        const { error } = await sb.from(tabla).upsert(filas, { onConflict: "id" });
        if (error) throw errorRemoto(que, error);
      }
      const previa = await leerVersion(cid);
      const version = (previa?.version ?? 0) + 1;
      const nota: NotaVersion = { resumen, empresas: cat.empresasVigentes };
      const { error } = await sb.from("catalogo_version").upsert({
        contrato_id: cid, version, cargado_en: new Date().toISOString(),
        cargado_por: cargadoPor && cat.usuarios.some((x) => x.id === cargadoPor) ? cargadoPor : null,
        nota: JSON.stringify(nota),
      }, { onConflict: "contrato_id" });
      if (error) throw errorRemoto("aumentar la versión del catálogo", error);
      return version;
    },
  };
}

// ───────────────────────── Fuente: simulación local ─────────────────────────

interface Simulado {
  version: VersionRemota;
  catalogo: CatalogoDatos;
}

/** Guarda lo «publicado» en `ajustes` del propio teléfono: sirve para probar sin escribir en Supabase. */
export function fuenteSimulada(): FuenteCatalogo {
  const leerSim = async () => json<Simulado>(await leer(CLAVES_CATALOGO.simulado));
  return {
    tipo: "simulada",
    descripcion: "Simulación en este teléfono (no escribe en Supabase)",
    async leerVersion(contratoId) {
      const s = await leerSim();
      return s && s.catalogo.contrato.id === contratoId ? s.version : null;
    },
    async leerCatalogo(contratoId) {
      const s = await leerSim();
      return s && s.catalogo.contrato.id === contratoId ? { ...s.catalogo, version: s.version } : null;
    },
    async publicar(cat, { cargadoPor, resumen }) {
      const previa = await leerSim();
      const version = (previa?.catalogo.contrato.id === cat.contrato.id ? previa.version.version : 0) + 1;
      const { empresasVigentes, ...catalogo } = cat;
      // Como en Supabase, las empresas que no vienen se conservan.
      const conservadas = (previa?.catalogo.empresas ?? []).filter((e) => !catalogo.empresas.some((x) => x.id === e.id));
      const s: Simulado = {
        version: { version, cargadoEn: new Date().toISOString(), cargadoPor, nota: { resumen, empresas: empresasVigentes } },
        catalogo: { ...catalogo, empresas: [...catalogo.empresas, ...conservadas] },
      };
      await db.ajustes.put({ clave: CLAVES_CATALOGO.simulado, valor: JSON.stringify(s) });
      return version;
    },
  };
}

/** Fuente en uso: la simulación si se eligió o si no hay Supabase configurado; si no, Supabase. */
export async function fuenteActiva(): Promise<FuenteCatalogo> {
  const sb = obtenerSupabase();
  if (!sb || (await leer(CLAVES_CATALOGO.fuente)) === "simulada") return fuenteSimulada();
  return fuenteSupabase(sb);
}

export async function usarSimulacion(simular: boolean): Promise<void> {
  if (simular) await db.ajustes.put({ clave: CLAVES_CATALOGO.fuente, valor: "simulada" });
  else await db.ajustes.delete(CLAVES_CATALOGO.fuente);
}

export const haySupabase = supabaseConfigurado;

// ───────────────────────── Catálogo local ─────────────────────────

/** Catálogo que tiene este teléfono (para comparar si el contrato aún no está en la fuente). */
export async function catalogoLocal(contratoId?: string): Promise<CatalogoDatos> {
  const cid = contratoId ?? (await contratoActualId());
  const [contrato, areas, empresas, usuarios] = await Promise.all([
    db.contratos.get(cid),
    db.areas.where("contratoId").equals(cid).sortBy("orden"),
    db.empresas.where("contratoId").equals(cid).toArray(),
    db.usuarios.toArray(),
  ]);
  if (!contrato) throw new Error("No hay contrato cargado en el teléfono.");
  return { contrato, areas, empresas, usuarios: usuarios.filter((u) => !u.contratoId || u.contratoId === cid) };
}

export interface CatalogoActual {
  catalogo: CatalogoDatos;
  origen: "fuente" | "telefono";
  version: VersionRemota | null;
  fuente: FuenteCatalogo;
}

/** Catálogo contra el que se comparan los cambios: el publicado si existe; si no, el del teléfono. */
export async function catalogoActual(): Promise<CatalogoActual> {
  const cid = await contratoActualId();
  const fuente = await fuenteActiva();
  const remoto = await fuente.leerCatalogo(cid);
  if (remoto) {
    const { version, ...catalogo } = remoto;
    // Las empresas fuera de la lista publicada ya no se ofrecen: no cuentan como «actuales».
    const vigentes = version?.nota?.empresas;
    if (vigentes) catalogo.empresas = catalogo.empresas.filter((e) => vigentes.includes(e.id));
    return { catalogo, origen: "fuente", version, fuente };
  }
  return { catalogo: await catalogoLocal(cid), origen: "telefono", version: null, fuente };
}

/**
 * Deja en Dexie el catálogo recibido, sin romper los reportes existentes:
 * - el correlativo local nunca retrocede y se conserva el destinatario de prueba si se fijó en Ajustes;
 * - las áreas que ya no vienen quedan no vigentes (no se borran);
 * - las empresas fuera de la lista vigente se quitan del teléfono solo si ningún reporte las usa;
 * - los usuarios que ya no vienen quedan inactivos.
 */
export async function aplicarCatalogoLocal(cat: CatalogoDatos, version: number, empresasVigentes?: string[]): Promise<void> {
  const cid = cat.contrato.id;
  const vigentes = new Set(empresasVigentes ?? cat.empresas.map((e) => e.id));
  await db.transaction("rw", [db.contratos, db.areas, db.empresas, db.usuarios, db.areasTurno, db.alertas, db.ajustes], async () => {
    const local = await db.contratos.get(cid);
    const destinatarioPrueba = (await db.ajustes.get(CLAVES.destinatario))?.valor;
    await db.contratos.put({
      ...cat.contrato,
      ultimoCorrelativo: Math.max(local?.ultimoCorrelativo ?? 0, cat.contrato.ultimoCorrelativo),
      destinatarios: destinatarioPrueba && local ? local.destinatarios : cat.contrato.destinatarios,
    });

    const idsAreas = new Set(cat.areas.map((a) => a.id));
    await db.areas.bulkPut(cat.areas);
    const viejas = await db.areas.where("contratoId").equals(cid).filter((a) => !idsAreas.has(a.id) && a.vigente).toArray();
    for (const a of viejas) await db.areas.update(a.id, { vigente: false });

    const [ats, alertas] = await Promise.all([db.areasTurno.toArray(), db.alertas.toArray()]);
    const usadas = new Set<string>([...ats.map((a) => a.empresaId), ...alertas.map((a) => a.empresaId ?? "")]);
    const locales = await db.empresas.where("contratoId").equals(cid).toArray();
    const porId = new Map([...locales, ...cat.empresas].map((e) => [e.id, e]));
    const guardar = [...porId.values()].filter((e) => vigentes.has(e.id) || usadas.has(e.id))
      .map((e) => cat.empresas.find((x) => x.id === e.id) ?? e);
    const quitar = [...porId.keys()].filter((id) => !vigentes.has(id) && !usadas.has(id));
    await db.empresas.bulkPut(guardar);
    if (quitar.length) await db.empresas.bulkDelete(quitar);

    const idsUsuarios = new Set(cat.usuarios.map((u) => u.id));
    await db.usuarios.bulkPut(cat.usuarios.map((u) => ({ ...u, contratoId: u.contratoId ?? cid })));
    const otros = await db.usuarios.filter((u) => !idsUsuarios.has(u.id) && (!u.contratoId || u.contratoId === cid) && u.activo !== false).toArray();
    for (const u of otros) await db.usuarios.update(u.id, { activo: false });

    const remota = entero((await db.ajustes.get(CLAVES_CATALOGO.versionRemota))?.valor);
    await db.ajustes.bulkPut([
      { clave: CLAVES_CATALOGO.versionLocal, valor: String(version) },
      { clave: CLAVES_CATALOGO.versionRemota, valor: String(Math.max(remota, version)) },
      { clave: CLAVES_CATALOGO.empresasVigentes, valor: JSON.stringify([...vigentes]) },
    ]);
  });
}

// ───────────────────────── Teléfono: verificar y descargar ─────────────────────────

export interface EstadoCatalogo {
  local: number;
  remota: number;
  hayNuevo: boolean;
  error?: string;
}

async function estadoGuardado(): Promise<EstadoCatalogo> {
  const local = entero(await leer(CLAVES_CATALOGO.versionLocal));
  const remota = entero(await leer(CLAVES_CATALOGO.versionRemota));
  return { local, remota, hayNuevo: remota > local };
}

/**
 * Con red, compara la versión remota del catálogo con la local y deja la remota en `ajustes`
 * (el aviso «Hay un catálogo nuevo» la lee de ahí). Nunca lanza errores.
 */
export async function verificarCatalogo(): Promise<EstadoCatalogo> {
  if (typeof window === "undefined" || !db) return { local: 0, remota: 0, hayNuevo: false };
  try {
    const fuente = await fuenteActiva();
    if (fuente.tipo === "supabase" && !(await hayRed())) return { ...(await estadoGuardado()), error: "Sin conexión" };
    const v = await fuente.leerVersion(await contratoActualId());
    await db.ajustes.bulkPut([
      { clave: CLAVES_CATALOGO.versionRemota, valor: String(v?.version ?? 0) },
      { clave: CLAVES_CATALOGO.verificadoEn, valor: new Date().toISOString() },
    ]);
    return estadoGuardado();
  } catch (e) {
    return { ...(await estadoGuardado().catch(() => ({ local: 0, remota: 0, hayNuevo: false }))), error: e instanceof Error ? e.message : String(e) };
  }
}

/** Trae el catálogo publicado a Dexie (mismos ids) para trabajar sin señal. Devuelve la versión aplicada. */
export async function descargarCatalogo(): Promise<number> {
  const fuente = await fuenteActiva();
  if (fuente.tipo === "supabase" && !(await hayRed())) throw new Error("Sin conexión: el catálogo se podrá actualizar al volver la señal.");
  const remoto = await fuente.leerCatalogo(await contratoActualId());
  if (!remoto || !remoto.version) throw new Error("Aún no hay un catálogo publicado para este contrato.");
  const { version, ...catalogo } = remoto;
  await aplicarCatalogoLocal(catalogo, version.version, version.nota?.empresas);
  return version.version;
}

/** Publica el catálogo revisado en /admin y lo deja también aplicado en este teléfono. */
export async function publicarCatalogo(cat: CatalogoPublicable, resumen: string[], cargadoPor?: string): Promise<number> {
  const fuente = await fuenteActiva();
  if (fuente.tipo === "supabase" && !(await hayRed())) throw new Error("Sin conexión: para publicar el catálogo se necesita señal.");
  const version = await fuente.publicar(cat, { cargadoPor, resumen });
  const { empresasVigentes, ...catalogo } = cat;
  await aplicarCatalogoLocal(catalogo, version, empresasVigentes);
  return version;
}

// ───────────────────────── Identidad ─────────────────────────

/** Usuarios activos del contrato, ordenados por rol (inspectores, jefes de turno, administradores) y nombre. */
export async function usuariosDelContrato(): Promise<Usuario[]> {
  const cid = await contratoActualId();
  const orden: RolApp[] = ["inspector", "jefatura", "admin"];
  return (await db.usuarios.toArray())
    .filter((u) => u.activo !== false && (!u.contratoId || u.contratoId === cid))
    .sort((a, b) => orden.indexOf(a.rol) - orden.indexOf(b.rol) || a.nombre.localeCompare(b.nombre, "es"));
}

/** true si alguien ya eligió en este teléfono quién lo usa (sesion.ts guarda el rol al elegir). */
export async function sesionElegida(): Promise<boolean> {
  return !!(await leer(CLAVE_ROL_SESION));
}

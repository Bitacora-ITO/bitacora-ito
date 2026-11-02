"use client";
// Quién usa este teléfono y con qué rol. Semana 8 v2 (pedido de Marcela): se entra eligiendo el usuario de
// una lista y escribiendo la clave; cada rol ve solo sus pantallas. Es una maqueta: la clave es la misma
// para todos (CLAVE_MAQUETA) y no hay cuentas reales. La sesión se guarda en `ajustes` hasta «Cerrar sesión».
import { db } from "./db";
import { useConsulta } from "@/hooks/useConsulta";
import type { RolApp, Usuario } from "./types";

const CLAVE_USUARIO = "usuarioActual"; // misma clave que ya usan repositorio.ts y envio.ts
const CLAVE_ROL = "rolActual"; // misma clave que catalogo.ts (sesionElegida)

/** Clave única de la maqueta. En producción se reemplaza por Supabase Auth. */
export const CLAVE_MAQUETA = "1234";

export interface Sesion {
  usuario?: Usuario;
  rol: RolApp;
}

export async function obtenerSesion(): Promise<Sesion> {
  const [u, r] = await Promise.all([db.ajustes.get(CLAVE_USUARIO), db.ajustes.get(CLAVE_ROL)]);
  const usuario = u ? await db.usuarios.get(u.valor) : undefined;
  const rol = (r?.valor as RolApp | undefined) ?? usuario?.rol ?? "inspector";
  return { usuario, rol };
}

/** Fija el usuario y, si no se indica, toma su rol del catálogo. */
export async function fijarSesion(usuarioId: string, rol?: RolApp): Promise<void> {
  const usuario = await db.usuarios.get(usuarioId);
  await db.ajustes.bulkPut([
    { clave: CLAVE_USUARIO, valor: usuarioId },
    { clave: CLAVE_ROL, valor: rol ?? usuario?.rol ?? "inspector" },
  ]);
}

/** Valida la clave de la maqueta y abre la sesión con el rol que el catálogo le da al usuario. */
export async function iniciarSesion(usuarioId: string, clave: string): Promise<void> {
  if (!usuarioId) throw new Error("Elige tu nombre en la lista.");
  if (clave.trim() !== CLAVE_MAQUETA) throw new Error("La clave no es correcta.");
  await fijarSesion(usuarioId);
}

/** Firma de la maqueta: la persona confirma con su clave (la misma de ingreso). */
export function firmaValida(clave: string): boolean {
  return clave.trim() === CLAVE_MAQUETA;
}

export async function cerrarSesion(): Promise<void> {
  await db.ajustes.bulkDelete([CLAVE_USUARIO, CLAVE_ROL]);
}

export async function fijarRol(rol: RolApp): Promise<void> {
  await db.ajustes.put({ clave: CLAVE_ROL, valor: rol });
}

/** Pantalla de inicio de cada rol. */
export function inicioDeRol(rol: RolApp): string {
  return rol === "admin" ? "/admin" : "/";
}

/**
 * Qué pantallas ve cada rol: el inspector todo menos /jefe, /admin y la vista previa del PDF (el PDF es solo
 * del jefe de turno); el jefe, su inicio y /jefe; el administrador, /admin.
 */
export function rutaPermitida(rol: RolApp, ruta: string): boolean {
  const r = ruta.replace(/\/+$/, "") || "/";
  if (rol === "admin") return r === "/admin";
  if (rol === "jefatura") return r === "/" || r === "/jefe";
  return r !== "/jefe" && r !== "/admin" && r !== "/vista-previa";
}

/** Sesión reactiva para las pantallas (undefined mientras carga). */
export function useSesion(): Sesion | undefined {
  return useConsulta(() => obtenerSesion(), []).datos;
}

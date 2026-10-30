"use client";
// Quién usa este teléfono y con qué rol. La maqueta no tiene inicio de sesión: se elige en Ajustes
// (o al primer uso) entre los usuarios del catálogo del contrato. Se guarda en `ajustes`.
import { db } from "./db";
import { useConsulta } from "@/hooks/useConsulta";
import type { RolApp, Usuario } from "./types";

const CLAVE_USUARIO = "usuarioActual"; // misma clave que ya usan repositorio.ts y envio.ts
const CLAVE_ROL = "rolActual";

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

export async function fijarRol(rol: RolApp): Promise<void> {
  await db.ajustes.put({ clave: CLAVE_ROL, valor: rol });
}

/** Sesión reactiva para las pantallas (undefined mientras carga). */
export function useSesion(): Sesion | undefined {
  return useConsulta(() => obtenerSesion(), []).datos;
}

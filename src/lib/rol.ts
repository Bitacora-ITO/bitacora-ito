// Rol de turnos 7x7 y estado de cada día del calendario (docs/01-estructura-datos.md §4.11 y regla 10).
import type { EstadoDia, RolTurno } from "./types";
import { celdasMes, diferenciaDias, sumarDias } from "./fechas";

type RolBasico = Pick<RolTurno, "diasTrabajo" | "diasDescanso" | "fechaInicio">;

const ciclo = (rol: RolBasico) => rol.diasTrabajo + rol.diasDescanso;

/** Día del ciclo (0 = inicio de turno). Funciona también para fechas anteriores al inicio. */
export function diaDelCiclo(fecha: string, rol: RolBasico): number {
  const c = ciclo(rol);
  return (((diferenciaDias(rol.fechaInicio, fecha)) % c) + c) % c;
}

export function esDiaTrabajo(fecha: string, rol: RolBasico): boolean {
  return diaDelCiclo(fecha, rol) < rol.diasTrabajo;
}

/** Cada `fechaInicio + k × (trabajo + descanso)` es inicio de turno. */
export function esInicioTurno(fecha: string, rol: RolBasico): boolean {
  return diaDelCiclo(fecha, rol) === 0;
}

/** Inicio del turno vigente o del último turno antes de `fecha`. */
export function inicioTurnoVigente(fecha: string, rol: RolBasico): string {
  return sumarDias(fecha, -diaDelCiclo(fecha, rol));
}

/** Próximo inicio de turno estrictamente después de `fecha`. */
export function proximoInicioTurno(fecha: string, rol: RolBasico): string {
  return sumarDias(inicioTurnoVigente(fecha, rol), ciclo(rol));
}

/**
 * Estado de un día (regla 10):
 * - con envío enviado → "enviado" (aunque después cambie el rol: lo enviado no se altera);
 * - hoy → "hoy";
 * - día de trabajo pasado sin envío enviado → "no_entregado";
 * - día de trabajo futuro → "programado";
 * - descanso pasado o futuro → "descanso" / "descanso_futuro".
 */
export function estadoDia(fecha: string, hoy: string, rol: RolBasico, enviados: Set<string>): EstadoDia {
  if (enviados.has(fecha)) return "enviado";
  if (fecha === hoy) return "hoy";
  const trabajo = esDiaTrabajo(fecha, rol);
  if (fecha < hoy) return trabajo ? "no_entregado" : "descanso";
  return trabajo ? "programado" : "descanso_futuro";
}

export interface TotalesMes {
  enviados: number;
  noEntregados: number;
  descanso: number;
  programados: number;
  /** Último día considerado en el resumen ("al 14-10"); null si el mes es futuro. */
  hasta: string | null;
}

/** Totales del mes hasta hoy (incluido) si es el mes en curso; el mes completo si ya pasó. */
export function totalesMes(anio: number, mes0: number, hoy: string, rol: RolBasico, enviados: Set<string>): TotalesMes {
  const dias = celdasMes(anio, mes0).filter((d): d is string => !!d);
  const t: TotalesMes = { enviados: 0, noEntregados: 0, descanso: 0, programados: 0, hasta: null };
  for (const d of dias) {
    const e = estadoDia(d, hoy, rol, enviados);
    if (d <= hoy) t.hasta = d;
    if (e === "enviado") t.enviados++;
    else if (e === "no_entregado") t.noEntregados++;
    else if (e === "descanso") t.descanso++;
    else if (e === "programado" || e === "hoy") t.programados++;
  }
  return t;
}

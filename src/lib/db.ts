// Base de datos local del teléfono (IndexedDB vía Dexie).
// Funciona sin señal; lib/sync.ts sube a Supabase lo pendiente cuando hay red.
import Dexie, { type Table } from "dexie";
import type {
  Ajuste, Alerta, Area, AreaTurno, Contrato, Empresa, Envio, Fotografia,
  PdfReporte, Registro, Reporte, RolTurno, Usuario,
} from "./types";

export class BitacoraDB extends Dexie {
  usuarios!: Table<Usuario, string>;
  contratos!: Table<Contrato, string>;
  empresas!: Table<Empresa, string>;
  areas!: Table<Area, string>;
  reportes!: Table<Reporte, string>;
  areasTurno!: Table<AreaTurno, string>;
  registros!: Table<Registro, string>;
  alertas!: Table<Alerta, string>;
  fotografias!: Table<Fotografia, string>;
  pdfs!: Table<PdfReporte, string>;
  envios!: Table<Envio, string>;
  rolesTurno!: Table<RolTurno, string>;
  ajustes!: Table<Ajuste, string>;

  constructor() {
    super("bitacora-ito");
    this.version(1).stores({
      usuarios: "id",
      contratos: "id",
      empresas: "id, contratoId",
      areas: "id, contratoId, orden",
      reportes: "id, contratoId, fecha, [contratoId+fecha+turno], estado",
      areasTurno: "id, reporteId, [reporteId+orden]",
      registros: "id, reporteId, areaTurnoId, sincronizadoEn",
      alertas: "id, reporteId, sincronizadoEn",
      fotografias: "id, registroId, alertaId, sincronizadoEn",
      pdfs: "reporteId",
      envios: "id, reporteId, estado",
      rolesTurno: "id, usuarioId",
      ajustes: "clave",
    });
  }
}

// Una sola instancia, solo en el navegador (los componentes que la usan son "use client").
export const db = typeof window !== "undefined" ? new BitacoraDB() : (null as unknown as BitacoraDB);

export const nuevoId = () => crypto.randomUUID();
export const ahoraISO = () => new Date().toISOString();

/** Fecha local del teléfono como "YYYY-MM-DD" (no UTC: en Chile la diferencia cambia el día). */
export function hoyLocal(d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

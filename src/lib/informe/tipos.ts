// Datos que necesita el informe PDF. Es independiente de la base: lib/informe/armar.ts los arma
// desde Dexie y lib/informe/fixture-27-09.ts los replica desde el informe real del 27-09-2026.
import type { Clima, ColumnaAlerta, Criticidad, Turno } from "../types";

export interface LineaInforme {
  /** Texto de la viñeta, sin el guion inicial (el PDF lo agrega). */
  texto: string;
  /** "sin_actividad" se imprime en rojo, como en el formato real. */
  tipo: "normal" | "sin_actividad";
  /** Prefijo en negrita, p. ej. "Calicatas OA-13 (Macrogranulometría):". */
  destacado?: string;
  /**
   * `ref` de las fotos del registro que termina en esta línea. El formato «bitacora» las imprime justo
   * después de la descripción (prueba de usuarios, hallazgo 5); el del mandante las sigue mostrando en su columna.
   */
  fotos?: string[];
}

export interface SubseccionInforme {
  numero: string; // "1.2"
  titulo: string; // "EXCAVACIÓN Y RELLENOS DE 1A ZANJA CORTAFUGA."
  lineas: LineaInforme[];
}

export interface FotoInforme {
  /** data URL (image/jpeg o image/png) o ruta pública "/demo/fotos/x.jpg". */
  src: string;
  pie?: string;
  /** Identificador estable (id de la fotografía) para ubicarla junto a su registro o alerta. */
  ref?: string;
}

export interface SeccionInforme {
  numero: string; // "1.0"
  titulo: string; // "MURO SOTELO"
  subsecciones: SubseccionInforme[];
  /** Título azul de la columna de fotos (p. ej. "Muro Sotelo"); si no hay fotos, no se imprime. */
  tituloFotos?: string;
  fotos: FotoInforme[];
}

export interface AlertaInforme {
  empresa?: string; // "TECNASIC"
  texto: string;
  criticidad?: Criticidad; // el formato real no la trae; la app sí
  /** `ref` de las fotos de la alerta: el formato «bitacora» las imprime junto a la alerta. */
  fotos?: string[];
}

export interface DatosInforme {
  contrato: {
    nombreServicio: string; // "Servicio de Inspección Técnica de Obras y Apoyo a la Construcción de Carén"
    numero: string; // "4600026893"
    codigoInterno: string;
    codigoProyecto: string;
    revision: string;
    fechaFormato: string; // "02-07-2024"
  };
  /** "27-09-2026" tal como se imprime. */
  fecha: string;
  turno: Turno;
  correlativo: string;
  /** "Jorge Orellana S. / Alberto Castillo / Arnoldi Díaz" */
  elaboradoPor: string;
  climaTurno: Clima;
  climaProyeccion: Clima;
  alertas: Record<ColumnaAlerta, AlertaInforme[]>;
  secciones: SeccionInforme[];
}

"use client";
// Consulta reactiva a Dexie: se vuelve a ejecutar sola cuando cambian las tablas que lee.
import { liveQuery } from "dexie";
import { useEffect, useState } from "react";

export interface EstadoConsulta<T> {
  datos: T | undefined;
  error: Error | null;
  cargando: boolean;
}

export function useConsulta<T>(consulta: () => Promise<T>, deps: unknown[] = []): EstadoConsulta<T> {
  const [estado, setEstado] = useState<EstadoConsulta<T>>({ datos: undefined, error: null, cargando: true });
  useEffect(() => {
    setEstado((e) => ({ ...e, cargando: true }));
    const sub = liveQuery(consulta).subscribe({
      next: (datos) => setEstado({ datos, error: null, cargando: false }),
      error: (err) => setEstado({ datos: undefined, error: err instanceof Error ? err : new Error(String(err)), cargando: false }),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return estado;
}

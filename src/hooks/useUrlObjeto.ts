"use client";
// URL temporal para mostrar un Blob (foto o PDF) en un <img>; se libera al desmontar.
import { useEffect, useState } from "react";

export function useUrlObjeto(blob?: Blob | null): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) { setUrl(undefined); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

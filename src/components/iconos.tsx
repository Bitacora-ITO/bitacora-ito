// Íconos de trazo (24 × 24), en el color del texto.
type P = { size?: number; className?: string };

function Svg({ size = 22, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export const IcoAtras = (p: P) => <Svg {...p}><path d="M15 18l-6-6 6-6" /></Svg>;
export const IcoFlecha = (p: P) => <Svg {...p}><path d="M9 18l6-6-6-6" /></Svg>;
export const IcoMas = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IcoCheck = (p: P) => <Svg {...p}><path d="M20 6L9 17l-5-5" /></Svg>;
export const IcoAlerta = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9.5" /><path d="M12 7.5v5.5M12 16.5v.01" /></Svg>;
export const IcoCalendario = (p: P) => (
  <Svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>
);
export const IcoCamara = (p: P) => (
  <Svg {...p}><path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 011 1v9.5a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" /><circle cx="12" cy="13.5" r="3.5" /></Svg>
);
export const IcoUbicacion = (p: P) => (
  <Svg {...p}><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0113 0C18.5 14.8 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.3" /></Svg>
);
export const IcoDocumento = (p: P) => (
  <Svg {...p}><path d="M14 3H7a1.5 1.5 0 00-1.5 1.5v15A1.5 1.5 0 007 21h10a1.5 1.5 0 001.5-1.5V7.5L14 3z" /><path d="M14 3v4.5h4.5M9 13h6M9 16.5h6" /></Svg>
);
export const IcoEmpresa = IcoDocumento;
export const IcoMicrofono = (p: P) => (
  <Svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" /></Svg>
);
export const IcoSinSenal = (p: P) => (
  <Svg {...p}><path d="M4 20v-2M8.5 20v-5M13 20v-8M17.5 20V8M3 3l18 18" /></Svg>
);
export const IcoAjustes = (p: P) => (
  <Svg {...p}><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></Svg>
);
export const IcoCerrar = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const IcoBasura = (p: P) => (
  <Svg {...p}><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></Svg>
);
export const IcoTeclado = (p: P) => (
  <Svg {...p}><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></Svg>
);

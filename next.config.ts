import type { NextConfig } from "next";

// Dos compilaciones del mismo código:
// - web (Vercel): incluye las rutas de API (archivos route.api.ts).
// - capacitor (APK): exportación estática en out/, sin rutas de API.
const esApp = process.env.BUILD_TARGET === "capacitor";

const config: NextConfig = {
  output: esApp ? "export" : undefined,
  pageExtensions: esApp ? ["tsx", "ts"] : ["tsx", "ts", "api.ts"],
  trailingSlash: esApp,
  images: { unoptimized: true },
  // No crear AGENTS.md en el repositorio del equipo al ejecutar `next dev`.
  agentRules: false,
  env: { NEXT_PUBLIC_BUILD_TARGET: esApp ? "capacitor" : "web" },
};

export default config;

#!/usr/bin/env bash
# Prueba de la consolidación en Node (sin red, sin Supabase, sin correo).
# Uso (desde bitacora-ito/):  bash scripts/consolidacion/probar.sh [ruta_del_pdf_de_muestra]
set -euo pipefail
mkdir -p scripts/consolidacion/salida
npx --yes esbuild scripts/consolidacion/probar.ts --bundle --platform=node --format=esm \
  --packages=external --jsx=automatic --log-level=warning --outfile=scripts/consolidacion/salida/probar.mjs
node scripts/consolidacion/salida/probar.mjs "$@"

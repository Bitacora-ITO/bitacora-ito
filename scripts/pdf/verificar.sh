#!/usr/bin/env bash
# Genera el PDF del fixture 27-09 y lo compara con el informe real.
# Uso (desde bitacora-ito/):  bash scripts/pdf/verificar.sh PYTHON_CON_PYMUPDF [carpeta_salida]
set -euo pipefail
PY="${1:?indique el python que tiene pymupdf, pillow y numpy}"
SALIDA="${2:-scripts/pdf/salida}"
REAL="../otrosdoc/01.- 4600026893-8211-FRMCS-00001 FORMATO REPORTE DIARIO CONSTRUCCIÓN_REV1_27.09.26 (Turno día).pdf"
mkdir -p "$SALIDA"
npx --yes esbuild scripts/pdf/generar-fixture.ts --bundle --platform=node --format=esm \
  --packages=external --jsx=automatic --log-level=warning --outfile=scripts/pdf/salida/generar.mjs
node scripts/pdf/salida/generar.mjs "$SALIDA/generado-27-09.pdf" 27-09
node scripts/pdf/salida/generar.mjs "$SALIDA/generado-largo.pdf" largo
"$PY" -I scripts/pdf/comparar.py "$REAL" "$SALIDA/generado-27-09.pdf" "$SALIDA/comparacion"

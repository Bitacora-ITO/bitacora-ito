#!/usr/bin/env bash
# Regenera los íconos del APK (mipmap-*) desde el dibujo de gen_iconos.py.
# Usa Microsoft Edge sin ventana para rasterizar el SVG y Python + Pillow para reducirlo.
#
#   bash scripts/apk/iconos.sh
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RES="$AQUI/../../android/app/src/main/res"
TMP="$(mktemp -d)"
EDGE="${EDGE:-/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe}"

python "$AQUI/gen_iconos.py" "$(cygpath -m "$TMP")"
for v in ic_launcher ic_launcher_round ic_launcher_foreground play_store_512; do
  "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --virtual-time-budget=2000 \
    --user-data-dir="$(cygpath -w "$TMP/perfil-$v")" --window-size=1024,1024 \
    --screenshot="$(cygpath -w "$TMP/$v-1024.png")" "file:///$(cygpath -m "$TMP/$v.html")" >/dev/null 2>&1
done
python - "$(cygpath -m "$TMP")" "$(cygpath -m "$RES")" "$(cygpath -m "$AQUI")" <<'PY'
import sys
from PIL import Image
tmp, res, aqui = sys.argv[1:4]
dens = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for v, base in [("ic_launcher", 48), ("ic_launcher_round", 48), ("ic_launcher_foreground", 108)]:
    im = Image.open(f"{tmp}/{v}-1024.png").convert("RGBA")
    if not im.getbbox():
        sys.exit(f"Edge entregó una captura vacía de {v}: vuelve a ejecutar el script.")
    for d, f in dens.items():
        n = int(base * f)
        im.resize((n, n), Image.LANCZOS).save(f"{res}/mipmap-{d}/{v}.png", optimize=True)
Image.open(f"{tmp}/play_store_512-1024.png").resize((512, 512), Image.LANCZOS).save(f"{aqui}/icono-512.png", optimize=True)
print("Íconos actualizados en", res)
PY
rm -rf "$TMP"

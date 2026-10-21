#!/usr/bin/env bash
# Compila el APK de Bitácora ITO desde Git Bash (Windows).
#
#   bash scripts/apk/compilar.sh [carpeta_destino]
#
# Requisitos: JDK 21 y Android SDK (platforms;android-36). Las variables NEXT_PUBLIC_* que
# quedan dentro del APK (Supabase, token y NEXT_PUBLIC_API_URL) se leen de .env.local al compilar.
# Firma: si existe android/keystore.properties se genera el APK release firmado;
# si no, uno de depuración (instalable, pero no sirve para actualizar uno firmado).
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
DESTINO="${1:-$RAIZ/../entregables}"

export JAVA_HOME="${JAVA_HOME:-$USERPROFILE\Android\jdk-21}"
export ANDROID_HOME="${ANDROID_HOME:-$USERPROFILE\Android\Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$(cygpath -u "$JAVA_HOME")/bin:$PATH"

cd "$RAIZ"
if [ ! -f .env.local ] || ! grep -q '^NEXT_PUBLIC_API_URL=https' .env.local; then
  echo "AVISO: falta NEXT_PUBLIC_API_URL en .env.local: el APK no podrá enviar correos." >&2
fi

echo "1/3 Exportación estática de la app (out/)…"
npm run build:app

echo "2/3 Copiando la app al proyecto Android…"
npx cap sync android

echo "3/3 Compilando con Gradle…"
cd android
[ -f local.properties ] || printf 'sdk.dir=%s\n' "$(cygpath -m "$ANDROID_HOME" | sed 's/:/\:/')" > local.properties
if [ -f keystore.properties ]; then
  ./gradlew.bat assembleRelease
  APK=app/build/outputs/apk/release/app-release.apk
else
  echo "AVISO: no hay android/keystore.properties; se compila la versión de depuración." >&2
  ./gradlew.bat assembleDebug
  APK=app/build/outputs/apk/debug/app-debug.apk
fi

mkdir -p "$DESTINO"
cp "$APK" "$DESTINO/bitacora-ito.apk"
echo "Listo: $DESTINO/bitacora-ito.apk ($(du -h "$DESTINO/bitacora-ito.apk" | cut -f1))"

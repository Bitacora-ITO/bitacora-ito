import type { CapacitorConfig } from "@capacitor/cli";

// Configuración del APK de Android.
// La app web va empaquetada dentro del APK (webDir = out, generado por `npm run build:app`),
// así que funciona sin señal. Solo el envío de correo y la sincronización usan internet.
const config: CapacitorConfig = {
  appId: "cl.usach.bitacoraito",
  appName: "Bitácora ITO",
  webDir: "out",
  android: {
    // La app se sirve como https://localhost dentro del WebView (origen seguro:
    // habilita cámara, micrófono, geolocalización e IndexedDB persistente).
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
  },
  plugins: {
    SpeechRecognition: {},
  },
};

export default config;

# Dibujo de los íconos de Bitácora ITO (turquesa 35D2C3 y tinta 1E2B38): tablilla de bitácora con visto bueno.
# Escribe un SVG y un HTML por variante en la carpeta indicada. Lo usa scripts/apk/iconos.sh.
import os, sys
S = sys.argv[1]
TUR, INK = "#35D2C3", "#1E2B38"
# Dibujo en el lienzo de 108 dp del ícono adaptativo (zona segura: círculo de 66 dp al centro).
DIBUJO = f'''
  <g>
    <!-- bitácora: tablilla con pinza, hoja con líneas y visto bueno -->
    <rect x="33" y="30" width="42" height="54" rx="6" fill="{INK}"/>
    <rect x="38.5" y="37" width="31" height="41.5" rx="2.5" fill="#FFFFFF"/>
    <path d="M45 27 h18 a3 3 0 0 1 3 3 v7 a2 2 0 0 1 -2 2 h-20 a2 2 0 0 1 -2 -2 v-7 a3 3 0 0 1 3 -3 z" fill="{INK}" stroke="#FFFFFF" stroke-width="1.6"/>
    <circle cx="54" cy="31.5" r="2" fill="{TUR}"/>
    <rect x="43.5" y="45" width="21" height="3.2" rx="1.6" fill="{INK}" opacity=".4"/>
    <rect x="43.5" y="52" width="14" height="3.2" rx="1.6" fill="{INK}" opacity=".4"/>
    <path d="M45 65 l5.5 5.5 l12 -12.5" fill="none" stroke="{TUR}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>'''
def svg(fondo, forma, vb):
    bg = ""
    if fondo:
        if forma == "circulo":
            bg = f'<circle cx="54" cy="54" r="{vb[2]/2}" fill="{TUR}"/>'
        else:
            bg = f'<rect x="{vb[0]}" y="{vb[1]}" width="{vb[2]}" height="{vb[3]}" rx="{vb[2]*0.18}" fill="{TUR}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{" ".join(map(str,vb))}" width="100%" height="100%">{bg}{DIBUJO}</svg>'
VARIANTES = {
  # legado (Android < 8): ícono cuadrado redondeado y redondo, recorte 18..90 (72 dp)
  "ic_launcher": (True, "cuadrado", (16, 16, 76, 76)),
  "ic_launcher_round": (True, "circulo", (16, 16, 76, 76)),
  # adaptativo: primer plano transparente en 108 dp (el fondo es un color)
  "ic_launcher_foreground": (False, None, (0, 0, 108, 108)),
  "play_store_512": (True, "cuadrado", (16, 16, 76, 76)),
}
for n, (f, forma, vb) in VARIANTES.items():
    s = svg(f, forma, vb)
    open(os.path.join(S, n + ".svg"), "w", encoding="utf-8").write(s)
    html = f'<!doctype html><html><head><style>html,body{{margin:0;padding:0;background:transparent;overflow:hidden;width:100vw;height:100vh}}</style></head><body>{s}</body></html>'
    open(os.path.join(S, n + ".html"), "w", encoding="utf-8").write(html)
print("ok")

"""Compara el PDF generado con el informe real del mandante.

Uso (con un Python que tenga PyMuPDF, Pillow y numpy; ejecútese con -I):
    python -I scripts/pdf/comparar.py REAL.pdf GENERADO.pdf CARPETA_SALIDA [dpi]

Produce en CARPETA_SALIDA:
- real.png, generado.png       : página 1 de cada uno a la misma escala (carta a `dpi`, 110 por defecto)
- lado-a-lado.png              : real | generado
- superposicion.png            : real en rojo y generado en azul (lo que coincide queda gris/negro)
- diferencia.png               : diferencia absoluta (negro = igual)
- textos.txt                   : cada texto del real con su desplazamiento de línea base en el generado
"""
import sys

sys.stdout.reconfigure(encoding="utf-8")
import os

import numpy as np
import pymupdf
from PIL import Image, ImageDraw, ImageFont

real_pdf, gen_pdf, salida = sys.argv[1], sys.argv[2], sys.argv[3]
dpi = float(sys.argv[4]) if len(sys.argv) > 4 else 110.0
os.makedirs(salida, exist_ok=True)

CARTA_ANCHO = 612.0


def rasterizar(ruta, n=0):
    doc = pymupdf.open(ruta)
    p = doc[n]
    escala = (CARTA_ANCHO / p.rect.width) * dpi / 72.0
    pix = p.get_pixmap(matrix=pymupdf.Matrix(escala, escala), alpha=False)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    return img, doc


real, doc_real = rasterizar(real_pdf)
gen, doc_gen = rasterizar(gen_pdf)
if gen.size != real.size:
    gen = gen.resize(real.size, Image.LANCZOS)
real.save(os.path.join(salida, "real.png"))
gen.save(os.path.join(salida, "generado.png"))

# Lado a lado con rótulos
w, h = real.size
margen = 40
lado = Image.new("RGB", (w * 2 + 30, h + margen), "white")
lado.paste(real, (0, margen))
lado.paste(gen, (w + 30, margen))
d = ImageDraw.Draw(lado)
try:
    f = ImageFont.truetype("arial.ttf", 22)
except OSError:
    f = ImageFont.load_default()
d.text((10, 8), "Informe real del mandante (27-09-2026)", fill=(0, 0, 0), font=f)
d.text((w + 40, 8), "Generado por Bitácora ITO", fill=(0, 0, 0), font=f)
d.line([(w + 15, 0), (w + 15, h + margen)], fill=(180, 180, 180), width=2)
lado.save(os.path.join(salida, "lado-a-lado.png"))

# Superposición: lo que solo está en el real queda rojo, lo que solo está en el generado queda azul,
# y lo que coincide queda negro/gris.
a = np.asarray(real.convert("L"), dtype=np.uint8)
b = np.asarray(gen.convert("L"), dtype=np.uint8)
Image.fromarray(np.stack([b, np.minimum(a, b), a], axis=-1)).save(os.path.join(salida, "superposicion.png"))
dif = np.abs(np.asarray(real, dtype=np.int16) - np.asarray(gen, dtype=np.int16)).astype(np.uint8)
Image.fromarray(255 - dif).save(os.path.join(salida, "diferencia.png"))
print("pixeles distintos (>40):", float((dif.max(axis=-1) > 40).mean()) * 100, "%")


# Textos: compara líneas base en unidades del original
def spans(doc, escala):
    out = []
    for blk in doc[0].get_text("dict")["blocks"]:
        for ln in blk.get("lines", []):
            for s in ln["spans"]:
                t = s["text"].strip()
                if t:
                    out.append((t, s["origin"][0] * escala, s["origin"][1] * escala, s["size"] * escala, s["font"], s["color"]))
    return out


k_real = 1.0
k_gen = doc_real[0].rect.width / doc_gen[0].rect.width
sr = spans(doc_real, k_real)
sg = spans(doc_gen, k_gen)
lineas = []
usados = set()
for t, x, y, tam, fuente, color in sorted(sr, key=lambda s: (s[2], s[1])):
    mejor = None
    for i, (t2, x2, y2, tam2, f2, c2) in enumerate(sg):
        if i in usados:
            continue
        if t2 == t or t2.startswith(t[:25]) or t.startswith(t2[:25]):
            dist = abs(y2 - y) + abs(x2 - x)
            if mejor is None or dist < mejor[0]:
                mejor = (dist, i)
    if mejor is None:
        lineas.append(f"FALTA            y={y:7.1f} x={x:7.1f}  {t[:70]}")
        continue
    usados.add(mejor[1])
    t2, x2, y2, tam2, f2, c2 = sg[mejor[1]]
    lineas.append(
        f"dx={x2 - x:+6.1f} dy={y2 - y:+6.1f} tam {tam:5.2f}->{tam2:5.2f} color {color:06x}->{c2:06x}  {t[:60]}"
    )
for i, s in enumerate(sg):
    if i not in usados:
        lineas.append(f"SOLO GENERADO    y={s[2]:7.1f} x={s[1]:7.1f}  {s[0][:70]}")
open(os.path.join(salida, "textos.txt"), "w", encoding="utf-8").write("\n".join(lineas))
print("\n".join(lineas))
print("páginas generado:", len(doc_gen))

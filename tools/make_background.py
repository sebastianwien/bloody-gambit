"""Rechnet das gemalte Hintergrundbild auf 960x540 Pixelart um (Ausschnitt, Verkleinern, Farbreduktion).
Aufruf: python tools/make_background.py bilder/background_v1.png public/assets/background.png
"""
import sys
from PIL import Image, ImageEnhance

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
W, H = im.size
y0 = 100
crop = im.crop((0, y0, W, y0 + int(W * 9 / 16)))
small = crop.resize((960, 540), Image.LANCZOS)
small = ImageEnhance.Contrast(small).enhance(1.08)
q = small.quantize(colors=56, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
q.save(out, optimize=True)
print('ok', q.size)

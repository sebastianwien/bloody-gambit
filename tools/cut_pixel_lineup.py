"""Schneidet die 6 Figuren aus einer echten Pixelart-Aufstellung auf Grün (ohne Skalierung).
Aufruf: python tools/cut_pixel_lineup.py art/ref/lineup_pixel.png art/ref
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

NAMES = ['p', 'n', 'b', 'r', 'q', 'k']
CANVAS, FOOT = int(sys.argv[3]) if len(sys.argv) > 3 else 64, int(sys.argv[3]) if len(sys.argv) > 3 else 64

def main(src, out):
    rgba = np.array(Image.open(src).convert("RGBA")).astype(int)
    a = rgba[..., :3]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    fg = ~((g > 120) & (g - r > 50) & (g - b > 50)) & (rgba[..., 3] > 0)
    cols = np.where(fg.sum(axis=0) > 0)[0]
    groups, start, prev = [], cols[0], cols[0]
    for c in cols[1:]:
        if c - prev > 2:
            groups.append((start, prev)); start = c
        prev = c
    groups.append((start, prev))
    groups = [x for x in groups if x[1] - x[0] > 6]
    assert len(groups) == 6, groups
    for name, (x0, x1) in zip(NAMES, groups):
        rows = np.where(fg[:, x0:x1 + 1].any(axis=1))[0]
        y0, y1 = rows[0], rows[-1]
        crop = np.zeros((y1 - y0 + 1, x1 - x0 + 1, 4), np.uint8)
        crop[..., :3] = a[y0:y1 + 1, x0:x1 + 1]
        crop[..., 3] = fg[y0:y1 + 1, x0:x1 + 1] * 255
        # Grünstich an Kanten entfernen
        edge = crop[..., 1].astype(int) - np.maximum(crop[..., 0], crop[..., 2]).astype(int) > 25
        crop[edge, 3] = 0
        im = Image.fromarray(crop)
        c = Image.new('RGBA', (CANVAS, CANVAS))
        c.paste(im, ((CANVAS - im.width) // 2, FOOT - im.height), im)
        c.save(Path(out) / f'{name}.png')
        print(name, im.size)

main(sys.argv[1], sys.argv[2])

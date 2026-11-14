"""Schneidet die Figuren aus einer Aufstellung auf Grün und rechnet sie auf ein Pixelraster herunter.
Aufruf: python tools/cut_lineup.py bilder/lineup_v2_front.png art/ref
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

NAMES = ['p', 'n', 'b', 'r', 'q', 'k']
CANVAS = 64
FOOT = 61  # Fußlinie im Zielbild


def is_green(a):
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (g > 150) & (g - r > 70) & (g - b > 70)


def main(src, out):
    img = np.array(Image.open(src).convert('RGB'))
    fg = ~is_green(img)
    cols = np.where(fg.sum(axis=0) > 3)[0]
    # Spalten in Gruppen trennen (Lücken > 15 px)
    groups, start, prev = [], cols[0], cols[0]
    for c in cols[1:]:
        if c - prev > 15:
            groups.append((start, prev))
            start = c
        prev = c
    groups.append((start, prev))
    groups = [g for g in groups if g[1] - g[0] > 40]
    assert len(groups) == 6, groups
    boxes = []
    for x0, x1 in groups:
        rows = np.where(fg[:, x0:x1 + 1].sum(axis=1) > 0)[0]
        boxes.append((x0, rows[0], x1, rows[-1]))
    tallest = max(b[3] - b[1] for b in boxes)
    scale = tallest / 60.0  # größte Figur 60 px hoch
    print('Maßstab', round(scale, 2))
    Path(out).mkdir(parents=True, exist_ok=True)
    for name, (x0, y0, x1, y1) in zip(NAMES, boxes):
        w = int(round((x1 - x0 + 1) / scale))
        h = int(round((y1 - y0 + 1) / scale))
        crop = img[y0:y1 + 1, x0:x1 + 1]
        mask = fg[y0:y1 + 1, x0:x1 + 1]
        small = np.zeros((h, w, 4), np.uint8)
        for ty in range(h):
            for tx in range(w):
                sy0, sy1 = int(ty * scale), max(int(ty * scale) + 1, int((ty + 1) * scale))
                sx0, sx1 = int(tx * scale), max(int(tx * scale) + 1, int((tx + 1) * scale))
                m = mask[sy0:sy1, sx0:sx1]
                if m.mean() < 0.5:
                    continue
                # Mitte des Blocks bevorzugen (scharfe Pixelkanten der Vorlage)
                cy, cx = (sy0 + sy1) // 2, (sx0 + sx1) // 2
                block = crop[max(sy0, cy - 1):min(sy1, cy + 2), max(sx0, cx - 1):min(sx1, cx + 2)].reshape(-1, 3)
                bm = mask[max(sy0, cy - 1):min(sy1, cy + 2), max(sx0, cx - 1):min(sx1, cx + 2)].reshape(-1)
                px = np.median(block[bm], axis=0) if bm.any() else np.median(crop[sy0:sy1, sx0:sx1][m], axis=0)
                small[ty, tx, :3] = px
                small[ty, tx, 3] = 255
        im = Image.fromarray(small, 'RGBA')
        # Farbreduktion auf 24 Farben, Transparenz bleibt
        alpha = im.getchannel('A')
        q = im.convert('RGB').quantize(colors=24, method=Image.Quantize.MEDIANCUT).convert('RGB')
        q.putalpha(alpha.point(lambda a: 255 if a > 0 else 0))
        canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
        ox = (CANVAS - w) // 2
        oy = FOOT - h
        canvas.paste(q, (ox, max(0, oy)), q)
        canvas.save(Path(out) / f'{name}.png')
        canvas.resize((CANVAS * 6, CANVAS * 6), Image.NEAREST).save(Path(out) / f'{name}_x6.png')
        print(name, w, h)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

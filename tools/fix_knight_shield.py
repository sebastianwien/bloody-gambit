"""Entfernt das kreuzähnliche Wappen vom Springer-Schild (Auftrag: kein Kreuz).
Helle Wappenpixel, die links und rechts von Schildrot umgeben sind, werden zu Schildrot.
Aufruf: python tools/fix_knight_shield.py art/chars/n
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

RED = [(0x8d, 0x1c, 0x29), (0xa6, 0x12, 0x25)]

def is_red(px):
    r, g, b = int(px[0]), int(px[1]), int(px[2])
    return px[3] > 0 and r > 110 and r > g * 2.2 and r > b * 1.8

def is_light(px):
    r, g, b = int(px[0]), int(px[1]), int(px[2])
    return px[3] > 0 and r > 120 and g > 100 and abs(r - g) < 50

def fix(path):
    a = np.array(Image.open(path).convert('RGBA'))
    h, w, _ = a.shape
    out = a.copy()
    n = 0
    for y in range(h):
        for x in range(w):
            if not is_light(a[y, x]):
                continue
            left = any(is_red(a[y, xx]) for xx in range(max(0, x - 4), x))
            right = any(is_red(a[y, xx]) for xx in range(x + 1, min(w, x + 5)))
            up = any(is_red(a[yy, x]) for yy in range(max(0, y - 5), y))
            down = any(is_red(a[yy, x]) for yy in range(y + 1, min(h, y + 6)))
            if (left and right) or (up and down):
                out[y, x, :3] = RED[0]
                n += 1
    Image.fromarray(out).save(path)
    return n

total = 0
for p in Path(sys.argv[1]).rglob('*.png'):
    # mehrfach, bis nichts mehr übrig ist (Ränder des Wappens werden schrittweise erreicht)
    for _ in range(4):
        n = fix(p)
        total += n
        if not n:
            break
print('Wappenpixel ersetzt:', total)

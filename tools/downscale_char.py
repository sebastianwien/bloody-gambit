"""Verkleinert eine Kampf-Figur (128 px) auf Brettgröße, damit Brett und Kampf dieselbe Figur zeigen.

Aufruf: python tools/downscale_char.py <quelle art/battle/n> <ziel art/chars/n> <animationen,komma>
Übernimmt alle Drehungen und die genannten Animationen, halbe Größe, harte Kanten.
"""
import shutil
import sys
from pathlib import Path

from PIL import Image


def half(src: Path, dst: Path):
    im = Image.open(src).convert('RGBA')
    small = im.resize((im.width // 2, im.height // 2), Image.BOX)
    px = small.load()
    for y in range(small.height):
        for x in range(small.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 110 else (0, 0, 0, 0)
    dst.parent.mkdir(parents=True, exist_ok=True)
    small.save(dst)


def main():
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    anims = sys.argv[3].split(',') if len(sys.argv) > 3 else []
    state = next(src.glob('*/rotations')).parent
    if dst.exists():
        shutil.rmtree(dst)
    out = dst / state.name
    for p in (state / 'rotations').glob('*.png'):
        half(p, out / 'rotations' / p.name)
    for a in anims:
        for p in (state / 'animations' / a).glob('*/*.png'):
            half(p, out / 'animations' / a / p.parent.name / p.name)
    (dst / 'ID').write_text((src / 'ID').read_text() if (src / 'ID').exists() else '')
    (dst / 'QUELLE').write_text(f'verkleinert aus {src}\n')
    print('fertig', dst)


if __name__ == '__main__':
    main()

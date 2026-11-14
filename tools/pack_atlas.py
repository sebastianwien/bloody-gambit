"""Packt alle Figurenbilder aus art/chars/<kind>/ in einen Sprite-Atlas.

Ausgabe: public/assets/pieces.png + public/assets/pieces.json
Schlüssel: "<kind>/rot/<dir>" für Drehungen, "<kind>/<anim>/<dir>/<i>" für Animationen.
Jeder Eintrag: [x, y, w, h, ox, oy] - Ausschnitt im Atlas und Versatz der linken oberen Ecke zum Fußpunkt.
Aufruf: python tools/pack_atlas.py
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CHARS = ROOT / 'art' / 'chars'
OUT = ROOT / 'public' / 'assets'
DIRS = {'south': 's', 'north': 'n', 'east': 'e', 'west': 'w', 'south-east': 'se', 'south-west': 'sw', 'north-east': 'ne', 'north-west': 'nw'}
BASE = 64


def foot_y(img):
    a = np.array(img)[..., 3]
    rows = np.where(a.max(axis=1) > 0)[0]
    return int(rows[-1]) + 1 if len(rows) else BASE


def main():
    entries = []  # (key, image, anchor_x, anchor_y)
    for kdir in sorted(CHARS.iterdir()):
        if not kdir.is_dir():
            continue
        kind = kdir.name
        rot_dir = next(kdir.glob('*/rotations'), None)
        if rot_dir is None:
            continue
        south = Image.open(rot_dir / 'south.png').convert('RGBA')
        size = south.height
        fy = max(foot_y(Image.open(p).convert('RGBA')) for p in rot_dir.glob('*.png'))
        fy = min(fy, size) - 1
        for p in rot_dir.glob('*.png'):
            entries.append((f'{kind}/rot/{DIRS[p.stem]}', Image.open(p).convert('RGBA'), south.width / 2, fy))
        for anim_root in kdir.glob('*/animations/*'):
            anim = anim_root.name.lower().split('_')[0].split('-')[0]
            for d in anim_root.iterdir():
                if d.name not in DIRS:
                    continue
                for i, fp in enumerate(sorted(d.glob('frame_*.png'))):
                    im = Image.open(fp).convert('RGBA')
                    # Größere Animationsleinwand ist mittig um die 64er-Leinwand gelegt
                    ax = im.width / 2
                    ay = fy + (im.height - size) / 2
                    entries.append((f'{kind}/{anim}/{DIRS[d.name]}/{i}', im, ax, ay))
        _ = south

    # Zuschneiden auf sichtbaren Bereich
    crops = []
    for key, im, ax, ay in entries:
        bbox = im.getbbox() or (0, 0, 1, 1)
        c = im.crop(bbox)
        crops.append((key, c, int(round(bbox[0] - ax)), int(round(bbox[1] - ay))))

    # Regalpacken nach Höhe
    crops.sort(key=lambda e: -e[1].height)
    width = 1024
    x = y = shelf = 0
    places = []
    for key, c, ox, oy in crops:
        if x + c.width + 1 > width:
            x = 0
            y += shelf + 1
            shelf = 0
        places.append((key, c, x, y, ox, oy))
        x += c.width + 1
        shelf = max(shelf, c.height)
    height = y + shelf + 1
    atlas = Image.new('RGBA', (width, height))
    frames = {}
    for key, c, px, py, ox, oy in places:
        atlas.paste(c, (px, py))
        frames[key] = [px, py, c.width, c.height, ox, oy]
    OUT.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT / 'pieces.png', optimize=True)
    (OUT / 'pieces.json').write_text(json.dumps({'frames': frames}, separators=(',', ':')))
    print(f'Atlas {width}x{height}, {len(frames)} Bilder')


if __name__ == '__main__':
    main()

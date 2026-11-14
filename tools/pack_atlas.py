"""Packt alle Figurenbilder aus art/chars/<kind>/ in einen Sprite-Atlas.

Ausgabe: public/assets/pieces.png + public/assets/pieces.json
Schlüssel: "<kind>/rot/<dir>" für Drehungen, "<kind>/<anim>/<dir>/<i>" für Animationen.
Jeder Eintrag: [x, y, w, h, ox, oy] - Ausschnitt im Atlas und Versatz der linken oberen Ecke zum Fußpunkt.
Aufruf: python tools/pack_atlas.py [quellordner] [ausgabename]
  Standard: art/chars -> public/assets/pieces.*; Kampf-Sprites: art/battle battle
"""
import sys
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CHARS = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'art/chars')
OUTNAME = sys.argv[2] if len(sys.argv) > 2 else 'pieces'
OUT = ROOT / 'public' / 'assets'
DIRS = {'south': 's', 'north': 'n', 'east': 'e', 'west': 'w', 'south-east': 'se', 'south-west': 'sw', 'north-east': 'ne', 'north-west': 'nw'}
BASE = 64


def foot_y(img):
    a = np.array(img)[..., 3]
    rows = np.where(a.max(axis=1) > 0)[0]
    return int(rows[-1]) + 1 if len(rows) else BASE


def palette_of(images):
    cols = set()
    for im in images:
        a = np.array(im)
        m = a[..., 3] > 0
        for c in a[m][:, :3]:
            cols.add(tuple(int(x) for x in c))
    return np.array(sorted(cols), dtype=np.int32)


def snap(im, pal):
    """Jedes Pixel auf die nächste Farbe der Ruhebilder (gegen Farbdrift der Animationen)."""
    a = np.array(im).astype(np.int32)
    m = a[..., 3] > 0
    px = a[m][:, :3]
    if not len(px):
        return im
    d = ((px[:, None, :] - pal[None, :, :]) ** 2).sum(axis=2)
    a[m, :3] = pal[d.argmin(axis=1)]
    a[..., 3] = np.where(m, 255, 0)
    return Image.fromarray(a.astype(np.uint8))


def main():
    entries = []  # (key, image, anchor_x, anchor_y)
    joints = {}
    for kdir in sorted(CHARS.iterdir()):
        if not kdir.is_dir():
            continue
        kind = kdir.name
        rot_dir = next(kdir.glob('*/rotations'), None)
        if rot_dir is None:
            continue
        south = Image.open(rot_dir / 'south.png').convert('RGBA')
        size = south.height
        rots = {p.stem: Image.open(p).convert('RGBA') for p in rot_dir.glob('*.png')}
        # Fußpunkt je Richtung: unterste Pixelzeile dieser Ansicht (Pferd ist je nach Blick verschieden tief)
        feet = {stem: min(foot_y(im), size) - 1 for stem, im in rots.items()}
        pal = palette_of(rots.values())
        # Gelenke (Bruchteile der Leinwand) in Pixel relativ zum Fußpunkt umrechnen
        jf = kdir / 'joints.json'
        if jf.exists():
            raw = json.loads(jf.read_text())
            joints[kind] = {
                DIRS[d]: {n: [round(x * south.width - south.width / 2, 1), round(y * size - feet[d], 1)] for n, (x, y) in pts.items()}
                for d, pts in raw.items()
            }
        for stem, im in rots.items():
            entries.append((f'{kind}/rot/{DIRS[stem]}', im, south.width / 2, feet[stem]))
        # Verworfene Animationen: art/chars/<kind>/SKIP, Zeilen "ordnername/richtung"
        skip_file = kdir / 'SKIP'
        skip = set(skip_file.read_text().split()) if skip_file.exists() else set()
        # Umleitungen: art/chars/<kind>/REMAP, Zeilen "ordner/richtung neue_richtung bilder_vorne_weglassen"
        remap = {}
        remap_file = kdir / 'REMAP'
        if remap_file.exists():
            for line in remap_file.read_text().splitlines():
                parts = line.split()
                if len(parts) == 3:
                    remap[parts[0]] = (parts[1], int(parts[2]))
        for anim_root in kdir.glob('*/animations/*'):
            anim = anim_root.name.lower().split('_')[0].split('-')[0]
            if anim.startswith('walk'):
                anim = 'walk'
            for d in anim_root.iterdir():
                if d.name not in DIRS or f'{anim_root.name}/{d.name}' in skip:
                    continue
                target, drop = remap.get(f'{anim_root.name}/{d.name}', (d.name, 0))
                for i, fp in enumerate(sorted(d.glob('frame_*.png'))[drop:]):
                    im = snap(Image.open(fp).convert('RGBA'), pal)
                    # Größere Animationsleinwand ist mittig um die Ruhe-Leinwand gelegt
                    ax = im.width / 2
                    ay = feet[d.name] + (im.height - size) / 2
                    entries.append((f'{kind}/{anim}/{DIRS[target]}/{i}', im, ax, ay))
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
    atlas.save(OUT / f'{OUTNAME}.png', optimize=True)
    (OUT / f'{OUTNAME}.json').write_text(json.dumps({'frames': frames, 'joints': joints}, separators=(',', ':')))
    print(f'Atlas {width}x{height}, {len(frames)} Bilder')


if __name__ == '__main__':
    main()

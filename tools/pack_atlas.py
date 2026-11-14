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


def drop_specks(im, keep_ratio=0.12):
    """Entfernt lose Flecken (Rauch, Schlieren der Bildmodelle): nur Teile behalten, die groß sind
    oder nah am Hauptkörper liegen. Waffen hängen am Körper und bleiben."""
    a = np.array(im)
    alpha = a[..., 3] > 0
    h, w = alpha.shape
    labels = np.zeros((h, w), np.int32)
    sizes = [0]
    cur = 0
    for y in range(h):
        for x in range(w):
            if not alpha[y, x] or labels[y, x]:
                continue
            cur += 1
            stack = [(y, x)]
            labels[y, x] = cur
            n = 0
            while stack:
                cy, cx = stack.pop()
                n += 1
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and alpha[ny, nx] and not labels[ny, nx]:
                            labels[ny, nx] = cur
                            stack.append((ny, nx))
            sizes.append(n)
    if cur <= 1:
        return im
    biggest = max(sizes)
    keep = {i for i, n in enumerate(sizes) if i and n >= biggest * keep_ratio}
    mask = np.isin(labels, list(keep))
    a[~mask, 3] = 0
    return Image.fromarray(a)


def main():
    entries = []  # (key, image, anchor_x, anchor_y)
    joints = {}
    meta = {}  # "<kind>/<anim>/<dir>": {impact, reach}
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
        # Körperausdehnung in der Seitenansicht (für Abstände ohne Überlappung)
        if 'east' in rots:
            bb = rots['east'].getbbox()
            if bb:
                meta[f'{kind}/rot/e'] = {'impact': 0, 'reach': round(bb[2] - south.width / 2, 1), 'back': round(south.width / 2 - bb[0], 1)}
        # Verworfene Animationen: art/chars/<kind>/SKIP, Zeilen "ordnername/richtung"
        skip_file = kdir / 'SKIP'
        skip = set(skip_file.read_text().split()) if skip_file.exists() else set()
        # Umleitungen: art/chars/<kind>/REMAP, Zeilen "ordner/richtung neue_richtung bilder_vorne_weglassen [neuer_name]"
        remap = {}
        remap_file = kdir / 'REMAP'
        if remap_file.exists():
            for line in remap_file.read_text().splitlines():
                parts = line.split()
                if len(parts) in (3, 4):
                    remap[parts[0]] = (parts[1], int(parts[2]), parts[3] if len(parts) == 4 else None)
        # Trefferbild von Hand: art/chars/<kind>/IMPACT, Zeilen "animation bild" (wenn die Weite es nicht zeigt,
        # z. B. Hufe, die beim Niedertrampeln von oben kommen)
        impact_file = kdir / 'IMPACT'
        impact = {}
        if impact_file.exists():
            for line in impact_file.read_text().splitlines():
                parts = line.split()
                if len(parts) == 2:
                    impact[parts[0]] = int(parts[1])
        for anim_root in kdir.glob('*/animations/*'):
            base = anim_root.name.lower().split('_')[0].split('-')[0]
            if base.startswith('walk'):
                base = 'walk'
            for d in anim_root.iterdir():
                if d.name not in DIRS or f'{anim_root.name}/{d.name}' in skip:
                    continue
                target, drop, rename = remap.get(f'{anim_root.name}/{d.name}', (d.name, 0, None))
                anim = rename or base
                best = (-1, -1)
                back = (-1, -1)
                for i, fp in enumerate(sorted(d.glob('frame_*.png'))[drop:]):
                    im = snap(drop_specks(Image.open(fp).convert('RGBA')), pal)
                    # Größere Animationsleinwand ist mittig um die Ruhe-Leinwand gelegt
                    ax = im.width / 2
                    ay = feet[d.name] + (im.height - size) / 2
                    entries.append((f'{kind}/{anim}/{DIRS[target]}/{i}', im, ax, ay))
                    # Reichweite: wie weit ragt das Bild in Blickrichtung über den Fußpunkt hinaus
                    bb = im.getbbox()
                    if bb:
                        east = DIRS[target] in ('e', 'se', 'ne')
                        reach = (bb[2] - ax) if east else (ax - bb[0])
                        if reach > best[1]:
                            best = (i, reach)
                        # Nach hinten (Ausschlagen mit den Hinterhufen)
                        rear = (ax - bb[0]) if east else (bb[2] - ax)
                        if rear > back[1]:
                            back = (i, rear)
                if best[0] >= 0:
                    hit = impact.get(anim)
                    meta[f'{kind}/{anim}/{DIRS[target]}'] = {
                        'impact': best[0] if hit is None else hit,
                        'reach': round(best[1], 1),
                        'impactBack': back[0] if hit is None else hit,
                        'back': round(back[1], 1),
                    }
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
    (OUT / f'{OUTNAME}.json').write_text(json.dumps({'frames': frames, 'joints': joints, 'meta': meta}, separators=(',', ':')))
    print(f'Atlas {width}x{height}, {len(frames)} Bilder')


if __name__ == '__main__':
    main()

import type { Color, GameEnd } from '../../shared/rules.ts';
import type { Actor } from './actor.ts';
import { PAL } from './palette.ts';
import { ctx2d, makeCanvas } from './sprites.ts';
import type { Stage } from './stage.ts';
import { ease } from './tween.ts';

/** Sprechblasen-Zeichen als Pixelbild. */
function glyph(kind: '!' | '?', color: string): HTMLCanvasElement {
  const rows =
    kind === '!'
      ? ['.##.', '.##.', '.##.', '.##.', '.##.', '....', '.##.']
      : ['.###.', '##.##', '...##', '..##.', '..#..', '.....', '..#..'];
  const w = rows[0].length;
  const c = makeCanvas(w + 2, rows.length + 2);
  const g = ctx2d(c);
  for (const [dx, dy, col] of [
    [0, 1, PAL.ink],
    [2, 1, PAL.ink],
    [1, 0, PAL.ink],
    [1, 2, PAL.ink],
    [1, 1, color],
  ] as const) {
    g.fillStyle = col;
    rows.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && g.fillRect(x + dx, y + dy, 1, 1)));
  }
  return c;
}

const BANG = glyph('!', '#ff4a3a');
const ASK = glyph('?', '#ffd25e');

/** Kleine Szenen außerhalb der Kämpfe: Schach, Matt, Patt, Sieg und Niederlage. */
export class Scenes {
  sfx: (name: string) => void = () => {};
  constructor(private stage: Stage) {}

  private king(color: Color): Actor | undefined {
    return this.stage.actors.find((a) => a.kind === 'k' && a.side === color && a.visible);
  }

  private bubble(a: Actor, img: HTMLCanvasElement, life = 1.4) {
    const p = a.screen(this.stage.flipped);
    const f = a.frame(this.stage.sprites).f;
    this.stage.effects.addProp({ img, w: img.width, h: img.height, x: p.x + 6, y: p.y + 1, z: f.ay + 2, px: img.width / 2, py: img.height, gravity: false, still: true, life });
  }

  /** König im Schach: zuckt hoch, rotes Ausrufezeichen. */
  async check(color: Color) {
    const k = this.king(color);
    if (!k) return;
    this.bubble(k, BANG);
    k.flash = 0.8;
    await this.stage.tweens.run(0.35, (t) => {
      k.z = Math.sin(t * Math.PI) * 7;
      k.flash = 0.8 * (1 - t);
    });
    k.z = 0;
    k.flash = 0;
  }

  /** Spielende: Matt stürzt den König, Patt lässt beide ratlos, danach Jubel und Trauer. */
  async end(end: GameEnd) {
    const st = this.stage;
    const t = st.tweens;
    t.skipping = false;
    if (end.reason === 'checkmate' && end.winner) {
      const loser: Color = end.winner === 'w' ? 'b' : 'w';
      const k = this.king(loser);
      if (k) {
        this.bubble(k, BANG, 1);
        this.sfx('scream');
        await t.run(0.4, (x) => (k.rot = Math.sin(x * Math.PI * 5) * 0.12));
        const side = Math.random() < 0.5 ? -1 : 1;
        await t.run(0.5, (x) => (k.rot = side * (Math.PI / 2) * ease.in(x)));
        this.sfx('bodyfall');
        st.shake(5);
        const p = k.screen(st.flipped);
        st.effects.dust(p.x + side * 18, p.y, 14);
        // Krone rollt davon
        const crown = crownImage();
        st.effects.addProp({ img: crown, w: crown.width, h: crown.height, x: p.x + side * 30, y: p.y, z: 6, px: 3, py: 4, vx: side * 50, vz: 60, vrot: side * 8, bounce: 0.5, life: 6 });
      }
      this.celebrate(end.winner);
    } else if (!end.winner) {
      for (const c of ['w', 'b'] as Color[]) {
        const k = this.king(c);
        if (k) this.bubble(k, ASK, 2.4);
      }
      await t.run(0.8, (x) => {
        for (const a of st.actors) a.oy = -Math.abs(Math.sin(x * Math.PI * 2)) * 2;
      });
      for (const a of st.actors) a.oy = 0;
    } else {
      // Aufgabe, Zeit, Abbruch: Sieger jubeln
      this.celebrate(end.winner);
    }
  }

  /** Sieger hüpfen versetzt, Verlierer lassen die Köpfe hängen. */
  private celebrate(winner: Color) {
    const st = this.stage;
    for (const a of st.actors) {
      if (a.side === winner) {
        const delay = Math.random() * 0.5;
        st.tweens.skipping = false;
        st.tweens.run(2.2, (x) => {
          const k = Math.max(0, x * 2.2 - delay);
          a.z = Math.abs(Math.sin(k * Math.PI * 2.5)) * 5 * (1 - x);
        });
      } else if (!(a.kind === 'k' && a.rot)) {
        a.rot = (Math.random() < 0.5 ? -1 : 1) * 0.07;
        a.oy = 1;
      }
    }
  }
}

function crownImage(): HTMLCanvasElement {
  const rows = ['#.#.#', '#####', '#####'];
  const c = makeCanvas(7, 5);
  const g = ctx2d(c);
  g.fillStyle = PAL.ink;
  g.fillRect(0, 0, 7, 5);
  g.clearRect(0, 0, 1, 1);
  g.fillStyle = PAL.gold;
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && g.fillRect(x + 1, y + 1, 1, 1)));
  return c;
}

import type { Move } from '../../shared/rules.ts';
import { ANIM_FPS } from '../config.ts';
import { Actor } from '../scene/actor.ts';
import { cutImage, opaqueRows, splitImage } from '../scene/effects.ts';
import { boardToScreen, dirFromDelta, squareToBoard } from '../scene/iso.ts';
import { PAL } from '../scene/palette.ts';
import { ctx2d, makeCanvas } from '../scene/sprites.ts';
import type { Stage } from '../scene/stage.ts';
import { ease } from '../scene/tween.ts';
import { hashString, mulberry32 } from '../util/random.ts';
import { sever } from './dismember.ts';
import { planBattle, type BattlePlan, type DeathVariant, type Gag, type HitSound, type Step } from './kit.ts';

export type SfxName =
  | HitSound
  | 'swing'
  | 'scream'
  | 'splat'
  | 'crunch'
  | 'bodyfall'
  | 'bowshot'
  | 'zap'
  | 'burn'
  | 'rubble'
  | 'jump'
  | 'land'
  | 'whoosh'
  | 'clank'
  | 'hoof'
  | 'stone'
  | 'grunt';

export interface BattleHooks {
  sfx?(name: SfxName, pan?: number): void;
  /** Wird für jeden Schritt aufgerufen (Tests, Musik-Akzente). */
  step?(s: Step): void;
}

/**
 * Spielt einen geplanten Kampf auf der Bühne ab: Anlauf, Finisher, Tod, Rückkehr der Kamera.
 * Alles läuft über stage.tweens, damit ein Klick vorspult.
 */
export class BattleRunner {
  hooks: BattleHooks = {};
  /** Zuletzt gespielter Plan (für Tests und Anzeige). */
  last: BattlePlan | null = null;

  constructor(private stage: Stage) {}

  private get t() {
    return this.stage.tweens;
  }

  private sfx(name: SfxName, a?: Actor) {
    const pan = a ? (a.screen(this.stage.flipped).x - 480) / 480 : 0;
    this.hooks.sfx?.(name, pan);
  }

  private pos(a: Actor) {
    return boardToScreen(a.bx, a.by, this.stage.flipped);
  }

  async run(a: Actor, v: Actor, move: Move, seedExtra = 0) {
    const plan = planBattle(a.kind, v.kind, hashString(move.lan + ':' + seedExtra + ':' + move.before));
    this.last = plan;
    const st = this.stage;
    const target = squareToBoard(move.to);
    const tx = target.x + 0.5;
    const ty = target.y + 0.5;
    // Kamera auf die Mitte zwischen beiden, etwas über dem Boden
    const pa = this.pos(a);
    const pv = this.pos(v);
    const camX = (pa.x + pv.x) / 2;
    const camY = Math.min(pa.y, pv.y) - 6 + Math.abs(pa.y - pv.y) / 2;
    const dist = Math.hypot(pa.x - pv.x, pa.y - pv.y);
    const zoom = dist > 260 ? 1.4 : dist > 150 ? 1.7 : 2;
    const cam0 = { ...st.camera };
    const camTween = this.t.run(0.55, (k) => {
      const e = ease.inOut(k);
      st.camera.x = cam0.x + (camX - cam0.x) * e;
      st.camera.y = cam0.y + (camY - 18 - cam0.y) * e;
      st.camera.zoom = cam0.zoom + (zoom - cam0.zoom) * e;
      st.dim = e;
    });
    const useHd = !!st.hd?.kinds.has(a.kind) && !!st.hd?.kinds.has(v.kind);
    let fightCam = { x: camX, y: camY - 18, zoom };
    for (const s of plan.steps) {
      this.hooks.step?.(s);
      await this.step(s, a, v, tx, ty);
      if (s.t === 'approach') {
        await camTween;
        if (useHd) {
          // Nahkampf: exakt 2x Zoom auf die Kämpfer, dann Kampf-Sprites in doppelter Auflösung
          const pa2 = this.pos(a);
          const pv2 = this.pos(v);
          const from = { ...st.camera };
          const to = { x: (pa2.x + pv2.x) / 2, y: (pa2.y + pv2.y) / 2 - 30, zoom: 2 };
          await this.t.run(0.35, (k) => {
            const e = ease.inOut(k);
            st.camera.x = from.x + (to.x - from.x) * e;
            st.camera.y = from.y + (to.y - from.y) * e;
            st.camera.zoom = from.zoom + (to.zoom - from.zoom) * e;
          });
          a.hd = v.hd = true;
          fightCam = to;
        }
      }
    }
    // Angreifer geht aufs Zielfeld, Kamera zurück
    await Promise.all([
      this.walk(a, tx, ty),
      this.t.run(0.6, (k) => {
        const e = ease.inOut(k);
        st.camera.x = fightCam.x + (cam0.x - fightCam.x) * e;
        st.camera.y = fightCam.y + (cam0.y - fightCam.y) * e;
        st.camera.zoom = fightCam.zoom + (cam0.zoom - fightCam.zoom) * e;
        st.dim = 1 - e;
        if (e > 0.5) a.hd = v.hd = false;
      }),
    ]);
    a.hd = v.hd = false;
    st.camera.x = cam0.x;
    st.camera.y = cam0.y;
    st.camera.zoom = cam0.zoom;
    st.dim = 0;
    v.visible = false;
  }

  /** Schlagen ohne Kampfszene: hinlaufen, kurzer Treffer, Opfer verblasst. */
  async quick(a: Actor, v: Actor, move: Move) {
    const target = squareToBoard(move.to);
    const tx = target.x + 0.5;
    const ty = target.y + 0.5;
    const dx = tx - a.bx;
    const dy = ty - a.by;
    const d = Math.hypot(dx, dy);
    const k = Math.max(0, (d - 0.6) / d);
    if (a.kind === 'n') await this.hop(a, a.bx + dx * k, a.by + dy * k);
    else await this.walk(a, a.bx + dx * k, a.by + dy * k);
    const p = this.pos(v);
    this.sfx('slash', v);
    this.stage.effects.blood(p.x, p.y, 24, 8, 0, 0.8);
    this.stage.effects.pool(p.x, p.y, 4);
    await this.t.run(0.35, (t) => {
      v.flash = 1 - t;
      v.alpha = 1 - t;
    });
    v.visible = false;
    await this.walk(a, tx, ty);
  }

  /** Laufen mit Laufbildern oder Schaukeln. */
  private async walk(a: Actor, tx: number, ty: number, speed = 1) {
    const sx = a.bx;
    const sy = a.by;
    const d = Math.hypot(tx - sx, ty - sy);
    if (d < 0.02) return;
    const from = boardToScreen(sx, sy, this.stage.flipped);
    const to = boardToScreen(tx, ty, this.stage.flipped);
    a.dir = dirFromDelta(to.x - from.x, to.y - from.y);
    const own = this.stage.srcFor(a).frames(a.kind, a.side, 'walk', a.dir).length > 1;
    a.play(own ? 'walk' : 'idle', true);
    let lastStep = -1;
    await this.t.run(Math.min(1.6, 0.25 + d * 0.32) / speed, (k) => {
      const e = ease.inOut(k);
      a.bx = sx + (tx - sx) * e;
      a.by = sy + (ty - sy) * e;
      if (!own && a.kind !== 'r') a.bob = k < 1 ? a.animT * 4 : 0;
      const step = Math.floor(a.animT * 4);
      if (step !== lastStep && k < 1) {
        lastStep = step;
        if (step % 2 === 0) this.sfx(a.kind === 'n' ? 'hoof' : a.kind === 'r' ? 'stone' : 'clank', a);
      }
    });
    a.bob = 0;
    a.play('idle', true);
  }

  private face(a: Actor, b: Actor) {
    const pa = this.pos(a);
    const pb = this.pos(b);
    a.dir = dirFromDelta(pb.x - pa.x, pb.y - pa.y);
  }

  /** Einheitsvektor in Bildschirmpixeln von a nach b. */
  private toward(a: Actor, b: Actor) {
    const pa = this.pos(a);
    const pb = this.pos(b);
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  }

  private async step(s: Step, a: Actor, v: Actor, tx: number, ty: number) {
    const st = this.stage;
    const fx = st.effects;
    switch (s.t) {
      case 'approach': {
        const dx = tx - a.bx;
        const dy = ty - a.by;
        const d = Math.hypot(dx, dy);
        if (d > s.stop) {
          const k = (d - s.stop) / d;
          if (a.kind === 'n') await this.hop(a, a.bx + dx * k, a.by + dy * k);
          else await this.walk(a, a.bx + dx * k, a.by + dy * k);
        }
        break;
      }
      case 'face': {
        this.face(a, v);
        this.face(v, a);
        // Mit Angriffsbildern (Seitenansicht) stellen sich beide seitlich auf
        if (st.srcFor(a).frames(a.kind, a.side, 'attack', 'e').length > 1) {
          const pa = this.pos(a);
          const pv = this.pos(v);
          let dx = pv.x - pa.x;
          if (Math.abs(dx) < 18) {
            // fast senkrecht übereinander: Angreifer tritt zur Seite
            const side = pa.x < 480 ? -1 : 1;
            await this.t.run(0.2, (k) => (a.ox = side * 20 * k));
            dx = -side * 20;
          }
          a.dir = dx >= 0 ? 'e' : 'w';
          v.dir = dx >= 0 ? 'w' : 'e';
        }
        v.play('idle', true);
        await this.t.wait(0.18);
        break;
      }
      case 'counter': {
        // Opfer stößt zuerst zu, der Angreifer weicht zurück
        const dir = this.toward(v, a);
        this.sfx('swing', v);
        const vf = st.srcFor(v).frames(v.kind, v.side, 'attack', v.dir);
        if (vf.length > 1) v.play('attack', false);
        await this.t.run(0.18, (k) => {
          v.ox = dir.x * 8 * Math.sin(k * Math.PI * 0.5);
          v.oy = dir.y * 8 * Math.sin(k * Math.PI * 0.5);
          a.ox = a.ox + dir.x * 1.2;
        });
        await this.t.run(0.15, (k) => {
          v.ox *= 1 - k;
          v.oy *= 1 - k;
        });
        v.play('idle', true);
        break;
      }
      case 'parry': {
        const pa = this.pos(a);
        this.sfx('slash', a);
        st.effects.sparks(pa.x + a.ox, pa.y, 26, 10);
        st.shake(2);
        await this.t.wait(0.2);
        break;
      }
      case 'rear': {
        const rearFrames = st.srcFor(a).frames(a.kind, a.side, 'attack', a.dir);
        if (rearFrames.length > 1) {
          // Gezeichnetes Aufbäumen, Tritt am Ende
          this.sfx('jump', a);
          a.play('attack', false, 6);
          const dir = this.toward(a, v);
          await this.t.run(rearFrames.length / 6, (k) => {
            a.ox = dir.x * 8 * Math.max(0, k - 0.6) * 2.5;
          });
          break;
        }
        // Pferd steigt: nach hinten kippen, hoch, dann krachend nieder
        const back = this.toward(a, v).x >= 0 ? -1 : 1;
        this.sfx('jump', a);
        await this.t.run(0.35, (k) => {
          a.rot = back * 0.35 * ease.out(k);
          a.z = 10 * ease.out(k);
        });
        await this.t.wait(0.15);
        const dir = this.toward(a, v);
        await this.t.run(0.12, (k) => {
          a.rot = back * 0.35 * (1 - k);
          a.z = 10 * (1 - k);
          a.ox = dir.x * 16 * k;
          a.oy = dir.y * 8 * k;
        });
        a.rot = 0;
        a.z = 0;
        break;
      }
      case 'dizzy': {
        // Sternchen kreisen über dem Kopf, Opfer schwankt
        const pv = this.pos(v);
        const f = this.frameOf(v);
        const top = pv.y - f.ay * st.scaleOf(v) + 6;
        const stars = [0, 1, 2].map(() => st.effects.addProp({ img: starImage(), w: 3, h: 3, x: pv.x, y: pv.y, z: 0, px: 1, py: 1, gravity: false, still: true, life: s.s + 0.2 }));
        this.sfx('grunt', v);
        await this.t.run(s.s, (k) => {
          v.rot = Math.sin(k * Math.PI * 4) * 0.08;
          stars.forEach((p, i) => {
            const ang = k * Math.PI * 4 + (i * Math.PI * 2) / 3;
            p.x = pv.x + Math.cos(ang) * 9;
            p.y = pv.y + 1;
            p.z = pv.y - top + Math.sin(ang) * 3;
          });
        });
        v.rot = 0;
        break;
      }
      case 'sever': {
        const src = st.srcFor(v) as { jointsFor?(k: string, d: string): { joints: Record<string, [number, number]>; mirror: boolean } | null };
        const jf = src.jointsFor?.(v.kind, v.dir);
        if (!jf) break;
        const f = this.frameOf(v);
        const res = sever(f, jf.joints, s.part, jf.mirror);
        if (!res) break;
        const sc = st.scaleOf(v);
        const pv = this.pos(v);
        const dir = this.toward(a, v);
        v.override = res.body;
        v.play('idle', true);
        this.sfx('slash', v);
        this.sfx('scream', v);
        st.shake(4);
        st.effects.flash = 0.5;
        // Abgetrenntes Teil fliegt mit Drehung davon und blutet
        st.effects.addProp({
          img: res.part, w: f.w, h: f.h,
          x: pv.x + (res.center.x - f.ax) * sc, y: pv.y + 2,
          z: (f.ay - res.center.y) * sc,
          px: res.center.x, py: res.center.y,
          vx: dir.x * 70 + (Math.random() - 0.5) * 30, vy: 12, vz: 150, vrot: (dir.x >= 0 ? 1 : -1) * 11,
          bleed: 1.2, bounce: 0.35, life: 6, scale: sc,
        });
        // Die Waffe fällt klappernd um
        if (res.weapon) {
          const wpn = st.effects.addProp({
            img: res.weapon, w: f.w, h: f.h, x: pv.x, y: pv.y + 1, z: 0,
            px: f.ax, py: f.ay, gravity: false, life: 6, scale: sc,
          });
          const side = dir.x >= 0 ? 1 : -1;
          this.t.run(0.5, (k) => (wpn.rot = side * (Math.PI / 2) * ease.in(k))).then(() => this.sfx('clank', v));
        }
        // Fontäne aus dem Stumpf, Opfer taumelt
        const cutX = pv.x + (res.cut.x - f.ax) * sc;
        const cutZ = (f.ay - res.cut.y) * sc;
        await this.t.run(0.8, (k) => {
          if (Math.random() < 0.8) st.effects.blood(cutX, pv.y, cutZ, 2, -dir.x * 0.4, 0.45, 1.2 - k * 0.6);
          v.rot = Math.sin(k * Math.PI * 3) * 0.06;
        });
        v.rot = 0;
        break;
      }
      case 'helmet': {
        // Helm (obere Kopfpartie) fliegt in hohem Bogen davon
        const pv = this.pos(v);
        const f = this.frameOf(v);
        const { top } = opaqueRows(f.img, f.w, f.h);
        const helm = cutImage(f.img, 0, top, f.w, 6);
        const dir = this.toward(a, v);
        const hs = st.scaleOf(v);
        st.effects.addProp({ img: helm, w: f.w, h: 6, x: pv.x, y: pv.y, z: (f.ay - top) * hs, px: f.ax, py: 6, vx: dir.x * 70 + 10, vy: -10, vz: 170, vrot: 12, bounce: 0.5, life: 3, scale: hs });
        this.sfx('clank', v);
        break;
      }
      case 'wait':
        await this.t.wait(s.s);
        break;
      case 'anim': {
        const who = s.who === 'a' ? a : v;
        const frames = st.srcFor(who).frames(who.kind, who.side, s.anim, who.dir);
        const dir = this.toward(who, s.who === 'a' ? v : a);
        if (frames.length > 1) {
          this.sfx('swing', who);
          who.play(s.anim, false);
          const dur = frames.length / ANIM_FPS;
          // Treffer fällt in den hinteren Teil der Bewegung
          await this.t.run(dur * 0.65, (k) => {
            if (s.lunge) {
              who.ox = dir.x * s.lunge * Math.sin(k * Math.PI * 0.5);
              who.oy = dir.y * s.lunge * Math.sin(k * Math.PI * 0.5);
            }
          });
        } else {
          // Ohne Angriffsbilder: ausholen und zustoßen
          await this.t.run(0.22, (k) => {
            who.ox = -dir.x * 4 * k;
            who.oy = -dir.y * 4 * k - 2 * k;
            who.rot = -dir.x * 0.12 * k;
          });
          this.sfx('swing', who);
          const l = s.lunge ?? 8;
          await this.t.run(0.1, (k) => {
            who.ox = -dir.x * 4 + dir.x * (l + 4) * k;
            who.oy = -dir.y * 4 - 2 + dir.y * (l + 4) * k + 2 * k;
            who.rot = -dir.x * 0.12 + dir.x * 0.22 * k;
          });
        }
        break;
      }
      case 'lunge': {
        const dir = this.toward(a, v);
        const ox = a.ox;
        const oy = a.oy;
        this.sfx('swing', a);
        await this.t.run(s.dur, (k) => {
          a.ox = ox + dir.x * s.px * ease.out(k);
          a.oy = oy + dir.y * s.px * ease.out(k);
        });
        break;
      }
      case 'hit': {
        const pv = this.pos(v);
        const dir = this.toward(a, v);
        this.sfx(s.sound, v);
        this.sfx('grunt', v);
        st.shake(s.shake);
        fx.flash = Math.min(1, s.shake / 8);
        v.flash = 1;
        fx.blood(pv.x + v.ox, pv.y, 26, s.blood, dir.x);
        if (!fx.gore) fx.sparks(pv.x, pv.y, 26, 6);
        // Rückstoß
        await this.t.run(0.15, (k) => {
          v.flash = 1 - k;
          v.ox = dir.x * 5 * Math.sin(k * Math.PI);
          v.oy = dir.y * 3 * Math.sin(k * Math.PI);
        });
        v.ox = v.oy = 0;
        // Angreifer zurück in Grundhaltung
        await this.t.run(0.12, (k) => {
          a.ox *= 1 - k;
          a.oy *= 1 - k;
          a.rot *= 1 - k;
        });
        a.ox = a.oy = a.rot = 0;
        break;
      }
      case 'projectile':
        for (let i = 0; i < s.count; i++) await this.projectile(a, v, s.kind, i);
        break;
      case 'leap': {
        const sx = a.bx;
        const sy = a.by;
        this.sfx('jump', a);
        a.play('idle', true);
        await this.t.run(0.5, (k) => {
          const e = ease.inOut(k);
          a.bx = sx + (v.bx - sx) * e;
          a.by = sy + (v.by - sy) * e;
          a.z = Math.sin(k * Math.PI) * s.height + (k > 0.5 ? 0 : 0);
        });
        a.z = 0;
        this.sfx('land', a);
        fx.dust(this.pos(a).x, this.pos(a).y, 12);
        break;
      }
      case 'death':
        await this.death(s.variant, a, v);
        break;
      case 'gag':
        await this.gag(s.gag, a);
        break;
      default:
        break;
    }
  }

  private async hop(a: Actor, tx: number, ty: number) {
    const sx = a.bx;
    const sy = a.by;
    const from = boardToScreen(sx, sy, this.stage.flipped);
    const to = boardToScreen(tx, ty, this.stage.flipped);
    a.dir = dirFromDelta(to.x - from.x, to.y - from.y);
    this.sfx('jump', a);
    await this.t.run(0.55, (k) => {
      const e = ease.inOut(k);
      a.bx = sx + (tx - sx) * e;
      a.by = sy + (ty - sy) * e;
      a.z = Math.sin(k * Math.PI) * 26;
    });
    a.z = 0;
    this.sfx('land', a);
    this.stage.shake(2);
  }

  private async projectile(a: Actor, v: Actor, kind: 'arrow' | 'bolt' | 'spear', i: number) {
    const fx = this.stage.effects;
    const pa = this.pos(a);
    const pv = this.pos(v);
    const startZ = a.kind === 'r' ? 50 : 40;
    const endZ = 18 + (i % 3) * 7;
    const img = projectileImage(kind);
    const prop = fx.addProp({ img, w: img.width, h: img.height, x: pa.x, y: pa.y, z: startZ, px: img.width / 2, py: img.height / 2, gravity: false, life: 5 });
    this.sfx(kind === 'bolt' ? 'zap' : 'bowshot', a);
    const ang = Math.atan2(pv.y - pa.y - (endZ - startZ), pv.x - pa.x);
    await this.t.run(kind === 'bolt' ? 0.22 : 0.32, (k) => {
      prop.x = pa.x + (pv.x - pa.x) * k + (i - 1) * 3 * k;
      prop.y = pa.y + (pv.y - pa.y) * k;
      const arc = kind === 'arrow' ? Math.sin(k * Math.PI) * 18 : 0;
      prop.z = startZ + (endZ - startZ) * k + arc;
      prop.rot = ang + (kind === 'arrow' ? -Math.cos(k * Math.PI) * 0.5 : 0);
      if (kind === 'bolt') fx.sparks(prop.x, prop.y, prop.z, 1, PAL.fire3);
    });
    if (kind === 'bolt') {
      prop.life = 0;
      fx.flash = 0.8;
      fx.flashColor = '#ffe8a0';
      fx.embers(pv.x, pv.y, 10, 14);
    } else {
      // Pfeil bleibt stecken und bewegt sich mit dem Opfer
      prop.still = true;
      prop.life = 1.8;
      prop.x = pv.x + (i - 1) * 4;
      prop.y = pv.y + 1;
      v.flash = 1;
      this.sfx('arrow', v);
      this.stage.effects.blood(pv.x, pv.y, endZ, 4, 0, 0.6);
    }
  }

  private frameOf(v: Actor) {
    return v.frame(this.stage.srcFor(v)).f;
  }

  private async death(variant: DeathVariant, a: Actor, v: Actor) {
    const st = this.stage;
    const fx = st.effects;
    const p = this.pos(v);
    const f = this.frameOf(v);
    const dir = this.toward(a, v);
    const sc = st.scaleOf(v);
    const x0 = p.x - f.ax * sc;
    const y0 = p.y - f.ay * sc;
    this.sfx('scream', v);
    switch (variant) {
      case 'fall':
      case 'pincushion': {
        if (variant === 'pincushion') {
          await this.t.run(0.5, (k) => (v.rot = Math.sin(k * Math.PI * 3) * 0.08));
        }
        const side = dir.x >= 0 ? 1 : -1;
        await this.t.run(0.45, (k) => {
          v.rot = side * (Math.PI / 2) * ease.in(k);
        });
        this.sfx('bodyfall', v);
        st.shake(3);
        fx.dust(p.x + side * 20, p.y, 10);
        fx.pool(p.x + side * 16, p.y, 7);
        fx.blood(p.x + side * 18, p.y, 4, 8, side, 0.5, 0.4);
        await this.t.wait(0.5);
        await this.t.run(0.35, (k) => (v.alpha = 1 - k));
        break;
      }
      case 'behead': {
        const { top, bottom } = opaqueRows(f.img, f.w, f.h);
        const neck = Math.round(top + (bottom - top) * 0.22);
        const head = cutImage(f.img, 0, 0, f.w, neck);
        const body = cutImage(f.img, 0, neck, f.w, f.h - neck);
        v.visible = false;
        const headProp = fx.addProp({ img: head, w: f.w, h: neck, x: p.x, y: p.y, z: (f.ay - neck) * sc, px: f.ax, py: neck, vx: dir.x * 90 + 20, vy: dir.y * 30, vz: 160, vrot: dir.x >= 0 ? 9 : -9, bleed: 1, bounce: 0.45, life: 4, scale: sc });
        const bodyProp = fx.addProp({ img: body, w: f.w, h: f.h - neck, x: p.x, y: p.y, z: 0, px: f.ax, py: f.h - neck - (f.h - f.ay), gravity: false, still: true, life: 4, scale: sc });
        this.sfx('slash', v);
        // Fontäne aus dem Hals
        await this.t.run(0.7, () => fx.blood(p.x, p.y, (f.ay - neck) * sc, 2, 0, 0.35, 1.3));
        this.sfx('splat', v);
        await this.t.run(0.4, (k) => (bodyProp.rot = (dir.x >= 0 ? 1 : -1) * (Math.PI / 2) * ease.in(k)));
        this.sfx('bodyfall', v);
        fx.pool(p.x, p.y, 8);
        st.shake(3);
        await this.t.wait(0.6);
        headProp.life = Math.min(headProp.life, 0.6);
        bodyProp.life = Math.min(bodyProp.life, 0.6);
        break;
      }
      case 'split': {
        const [l, r] = splitImage(f.img, f.w, f.h, dir.x >= 0 ? 0.25 : -0.25);
        v.visible = false;
        const common = { w: f.w, h: f.h, x: p.x, y: p.y, z: 0, px: f.ax, py: f.ay, gravity: false, life: 3, scale: sc };
        const L = fx.addProp({ img: l, ...common });
        const R = fx.addProp({ img: r, ...common });
        this.sfx('splat', v);
        fx.blood(p.x, p.y, 30, 30, 0, 1.2, 0.8);
        await this.t.run(0.5, (k) => {
          const e = ease.in(k);
          L.x = p.x - 6 * e;
          R.x = p.x + 6 * e;
          L.rot = -1.4 * e;
          R.rot = 1.4 * e;
          if (k > 0.2) fx.blood(p.x, p.y, 20, 1, 0, 0.4, 0.6);
        });
        this.sfx('bodyfall', v);
        st.shake(4);
        fx.pool(p.x - 14, p.y, 8);
        fx.pool(p.x + 14, p.y, 8);
        await this.t.wait(0.6);
        L.life = R.life = 0.5;
        break;
      }
      case 'gib': {
        v.visible = false;
        this.sfx('splat', v);
        this.sfx('crunch', v);
        st.shake(6);
        fx.flash = 0.6;
        fx.shatter(f.img, f.w, f.h, x0, y0, p.y, 1.1, 3 / sc, undefined, sc);
        fx.blood(p.x, p.y, 24, 40, dir.x, 1.6, 1);
        fx.pool(p.x, p.y, 9);
        await this.t.wait(1.2);
        break;
      }
      case 'squash': {
        this.sfx('crunch', v);
        st.shake(7);
        fx.blood(p.x, p.y, 4, 34, 0, 1.8, 0.5);
        await this.t.run(0.12, (k) => (v.scale = 1 - 0.0 * k));
        const flat = squashImage(f.img, f.w, f.h);
        v.visible = false;
        const pr = fx.addProp({ img: flat, w: flat.width, h: flat.height, x: p.x, y: p.y + 2, px: flat.width / 2, py: flat.height, gravity: false, still: true, life: 1.6, scale: sc });
        fx.pool(p.x, p.y, 9);
        await this.t.wait(1.2);
        pr.life = 0.4;
        break;
      }
      case 'burn': {
        this.sfx('burn', v);
        const burnt = charImage(f.img, f.w, f.h);
        await this.t.run(0.7, (k) => {
          v.flash = Math.sin(k * Math.PI * 4) * 0.5 + 0.5;
          fx.embers(p.x, p.y, 10, 2);
          fx.smoke(p.x, p.y, 20, 1);
        });
        v.flash = 0;
        v.visible = false;
        const pr = fx.addProp({ img: burnt, w: f.w, h: f.h, x: p.x, y: p.y, px: f.ax, py: f.ay, gravity: false, still: true, life: 2, scale: sc });
        await this.t.wait(0.4);
        pr.life = 0.01;
        fx.shatter(burnt, f.w, f.h, x0, y0, p.y, 0.25, 2 / sc, () => (Math.random() < 0.5 ? PAL.stone2 : PAL.stone1), sc);
        fx.smoke(p.x, p.y, 10, 8);
        await this.t.wait(0.9);
        break;
      }
      case 'launch': {
        // Fliegt im hohen Bogen über das Brett hinaus
        const side = dir.x >= 0 ? 1 : -1;
        this.sfx('blunt', v);
        const sx = p.x;
        const sy = p.y;
        st.camera.shake = 5;
        await this.t.run(0.9, (k) => {
          v.ox = side * 260 * k;
          v.oy = -60 * k;
          v.z = Math.sin(k * Math.PI) * 120;
          v.rot = side * k * Math.PI * 3;
          if (Math.random() < 0.5) fx.blood(sx + v.ox, sy + v.oy, v.z + 20, 1, 0, 0.2, 0.2);
        });
        v.visible = false;
        this.sfx('crunch', v);
        break;
      }
      case 'crumble': {
        this.sfx('rubble', v);
        await this.t.run(0.5, (k) => {
          v.ox = Math.sin(k * 60) * 2;
          if (Math.random() < 0.3) fx.dust(p.x + (Math.random() - 0.5) * 30, p.y, 1);
        });
        v.visible = false;
        st.shake(8);
        fx.shatter(f.img, f.w, f.h, x0, y0, p.y, 0.55, 4 / sc, undefined, sc);
        fx.dust(p.x, p.y, 30, PAL.stone3);
        fx.blood(p.x, p.y, 40, 10, 0, 0.8, 0.8);
        await this.t.wait(1.2);
        break;
      }
    }
  }

  private async gag(g: Gag, a: Actor) {
    switch (g) {
      case 'shrug':
        await this.t.run(0.4, (k) => (a.oy = -Math.abs(Math.sin(k * Math.PI * 2)) * 2));
        break;
      case 'bow':
        await this.t.run(0.5, (k) => (a.rot = Math.sin(k * Math.PI) * 0.18 * (a.dir.includes('w') ? -1 : 1)));
        break;
      case 'bless':
        this.stage.effects.sparks(this.pos(a).x, this.pos(a).y, 44, 6, PAL.fire4);
        await this.t.wait(0.4);
        break;
      case 'wipe':
        await this.t.run(0.5, (k) => (a.ox = Math.sin(k * Math.PI * 4) * 1.5));
        break;
      case 'cheer':
        await this.t.run(0.6, (k) => (a.z = Math.abs(Math.sin(k * Math.PI * 2)) * 6));
        a.z = 0;
        break;
      case 'kickHelmet': {
        // Kickt den herumliegenden Helm weg (falls einer da ist)
        const helm = [...this.stage.effects.props].reverse().find((p) => p.h === 6 && p.life > 0.5);
        if (helm) {
          const pa = this.pos(a);
          await this.t.run(0.2, (k) => (a.ox = (helm.x - pa.x) * 0.3 * k));
          helm.vx = (helm.x >= pa.x ? 1 : -1) * 160;
          helm.vz = 120;
          helm.vrot = 15;
          helm.life = 1.2;
          this.sfx('clank', a);
          await this.t.wait(0.25);
        }
        break;
      }
      default:
        break;
    }
    a.oy = a.ox = a.rot = 0;
  }
}

function starImage(): HTMLCanvasElement {
  const c = makeCanvas(3, 3);
  const g = ctx2d(c);
  g.fillStyle = PAL.fire3;
  g.fillRect(1, 0, 1, 3);
  g.fillRect(0, 1, 3, 1);
  return c;
}

function projectileImage(kind: 'arrow' | 'bolt' | 'spear'): HTMLCanvasElement {
  const c = makeCanvas(kind === 'bolt' ? 8 : 14, 3);
  const g = ctx2d(c);
  if (kind === 'bolt') {
    g.fillStyle = PAL.fire3;
    g.fillRect(0, 0, 8, 3);
    g.fillStyle = PAL.fire4;
    g.fillRect(2, 1, 5, 1);
  } else {
    g.fillStyle = PAL.wood2;
    g.fillRect(0, 1, 12, 1);
    g.fillStyle = PAL.silver;
    g.fillRect(11, 0, 3, 3);
    g.fillStyle = PAL.cream;
    g.fillRect(0, 0, 2, 3);
  }
  return c;
}

function squashImage(img: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = makeCanvas(Math.round(w * 1.4), Math.max(4, Math.round(h * 0.16)));
  const g = ctx2d(c);
  g.drawImage(img, 0, 0, w, h, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.35;
  g.fillStyle = PAL.blood1;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

function charImage(img: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h);
  const r = mulberry32(5);
  for (let i = 0; i < d.data.length; i += 4) {
    if (!d.data[i + 3]) continue;
    const l = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 3;
    const ember = r() < 0.06;
    d.data[i] = ember ? 232 : 20 + l * 0.15;
    d.data[i + 1] = ember ? 134 : 16 + l * 0.1;
    d.data[i + 2] = ember ? 42 : 18 + l * 0.1;
  }
  g.putImageData(d, 0, 0);
  return c;
}

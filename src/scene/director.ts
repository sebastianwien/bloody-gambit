import type { Move, PieceSymbol, Square } from '../../shared/rules.ts';
import { WALK_FPS } from '../config.ts';
import { Actor } from './actor.ts';
import { boardToScreen, dirFromDelta, squareToBoard } from './iso.ts';
import type { Stage } from './stage.ts';
import { ease } from './tween.ts';

export interface MoveHooks {
  /** Wird statt des einfachen Ausblendens für ein Schlagen aufgerufen (Kampf-Baukasten). */
  battle?(attacker: Actor, victim: Actor, move: Move): Promise<void>;
  footstep?(actor: Actor): void;
  promote?(actor: Actor, to: PieceSymbol): Promise<void>;
  land?(actor: Actor): void;
}

/** Spielt Züge auf der Bühne ab: Laufen, Springen, Rochade, Schlagen, Umwandlung. */
export class Director {
  hooks: MoveHooks = {};

  constructor(private stage: Stage) {}

  /** Stellt alle Figuren neu nach der Brettlage auf. */
  setup(pieces: { sq: Square; type: PieceSymbol; color: 'w' | 'b' }[]) {
    this.stage.actors = pieces.map((p) => {
      const a = new Actor(p.type, p.color, p.sq);
      this.orient(a);
      a.rest();
      a.animT = Math.random() * 2;
      return a;
    });
  }

  /** Ruhe-Blickrichtung: beide Armeen schauen zum Gegner, die untere also vom Betrachter weg. */
  orient(a: Actor) {
    const bottom = (a.side === 'w') !== this.stage.flipped;
    a.restDir = bottom ? 'n' : 's';
  }

  reorientAll() {
    for (const a of this.stage.actors) {
      this.orient(a);
      if (a.anim === 'idle') a.rest();
    }
  }

  /** Richtet eine Figur zum Zielpunkt aus (Brettkoordinaten). */
  face(a: Actor, tx: number, ty: number) {
    const from = boardToScreen(a.bx, a.by, this.stage.flipped);
    const to = boardToScreen(tx, ty, this.stage.flipped);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) + Math.abs(dy) > 0.5) a.dir = dirFromDelta(dx, dy);
  }

  walkDuration(dist: number): number {
    // Etwa 1,4 Felder pro Sekunde: Schrittlänge passt zu drei Schritten pro Sekunde
    return Math.min(3.6, 0.4 + dist * 0.7);
  }

  /** Läuft geradlinig zu einem Brettpunkt. */
  async walkTo(a: Actor, tx: number, ty: number, dur?: number) {
    const sx = a.bx;
    const sy = a.by;
    const dist = Math.hypot(tx - sx, ty - sy);
    if (dist < 0.01) return;
    this.face(a, tx, ty);
    const n = this.stage.sprites.frames(a.kind, a.side, 'walk', a.dir).length;
    const own = n > 1;
    // Pferd galoppiert im vollen Takt, alle anderen gehen gemessen
    a.play('walk', true, a.kind === 'n' ? undefined : WALK_FPS);
    let lastStep = -1;
    await this.stage.tweens.run(dur ?? this.walkDuration(dist), (t) => {
      const e = ease.inOut(t);
      a.bx = sx + (tx - sx) * e;
      a.by = sy + (ty - sy) * e;
      // Turm gleitet (kein lebender Turm), alle anderen schaukeln ohne eigene Laufbilder
      if (!own && a.kind !== 'r') a.bob = t < 1 ? a.animT * 4 : 0;
      const step = a.stepIndex(own ? n : 4);
      if (step !== lastStep && t < 1) {
        lastStep = step;
        this.hooks.footstep?.(a);
        if (a.kind === 'r') {
          const p = a.screen(this.stage.flipped);
          this.stage.effects.dust(p.x, p.y, 3);
        }
      }
    });
  }

  /** Springer: Bogensprung über die Figuren. */
  async jumpTo(a: Actor, tx: number, ty: number) {
    const sx = a.bx;
    const sy = a.by;
    this.face(a, tx, ty);
    a.play('walk', true, 12);
    await this.stage.tweens.wait(0.12);
    await this.stage.tweens.run(0.7, (t) => {
      const e = ease.inOut(t);
      a.bx = sx + (tx - sx) * e;
      a.by = sy + (ty - sy) * e;
      a.z = Math.sin(t * Math.PI) * 38;
    });
    a.z = 0;
    this.hooks.land?.(a);
    this.stage.shake(2);
  }

  async moveActor(a: Actor, to: Square, piece: PieceSymbol) {
    const b = squareToBoard(to);
    // Springer galoppiert, wenn es Galopp-Bilder gibt (sonst Bogensprung)
    const gallop = this.stage.sprites.frames(a.kind, a.side, 'walk', 'e').length > 1;
    if (piece === 'n' && !gallop) await this.jumpTo(a, b.x + 0.5, b.y + 0.5);
    else if (piece === 'n') await this.walkTo(a, b.x + 0.5, b.y + 0.5, this.walkDuration(Math.hypot(b.x + 0.5 - a.bx, b.y + 0.5 - a.by)) * 0.8);
    else await this.walkTo(a, b.x + 0.5, b.y + 0.5);
  }

  /** Spielt einen bereits regelkonform ausgeführten Zug ab. */
  async play(move: Move) {
    const stage = this.stage;
    stage.tweens.skipping = false;
    const a = stage.actorAt(move.from);
    if (!a) return;
    let victim: Actor | undefined;
    if (move.captured) {
      const capSq = move.isEnPassant() ? ((move.to[0] + move.from[1]) as Square) : move.to;
      victim = stage.actorAt(capSq);
    }

    if (move.isKingsideCastle() || move.isQueensideCastle()) {
      const rank = move.from[1];
      const rookFrom = (move.isKingsideCastle() ? 'h' : 'a') + rank;
      const rookTo = (move.isKingsideCastle() ? 'f' : 'd') + rank;
      const rook = stage.actorAt(rookFrom as Square);
      const kb = squareToBoard(move.to);
      const rb = squareToBoard(rookTo as Square);
      await Promise.all([
        this.walkTo(a, kb.x + 0.5, kb.y + 0.5, 1.1),
        rook ? this.walkTo(rook, rb.x + 0.5, rb.y + 0.5, 1.1) : Promise.resolve(),
      ]);
      if (rook) {
        rook.sq = rookTo as Square;
        rook.rest();
      }
    } else if (victim) {
      if (this.hooks.battle) {
        await this.hooks.battle(a, victim, move);
      } else {
        await this.moveActor(a, move.to, move.piece);
        await stage.tweens.run(0.3, (t) => (victim!.alpha = 1 - t));
      }
      stage.removeActor(victim);
    } else {
      await this.moveActor(a, move.to, move.piece);
    }
    const tb = squareToBoard(move.to);
    a.bx = tb.x + 0.5;
    a.by = tb.y + 0.5;
    a.ox = a.oy = 0;
    a.z = 0;
    a.sq = move.to;
    if (move.promotion) {
      if (this.hooks.promote) await this.hooks.promote(a, move.promotion);
      else a.kind = move.promotion;
    }
    a.rest();
    stage.tweens.skipping = false;
  }
}

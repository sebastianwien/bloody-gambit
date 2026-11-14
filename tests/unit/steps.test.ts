import { describe, expect, it } from 'vitest';
import { footstepSfx } from '../../src/audio/sfx.ts';
import { WALK_FPS, walkFps } from '../../src/config.ts';
import { Actor } from '../../src/scene/actor.ts';

describe('Schritte', () => {
  it('zwei Schritte je Laufzyklus: Bild 0 und Zyklusmitte', () => {
    const a = new Actor('p', 'w', 'e2');
    a.play('walk', true, WALK_FPS);
    const at = (frame: number) => {
      a.animT = frame / WALK_FPS;
      return a.stepIndex(4);
    };
    expect([0, 1, 2, 3, 4, 5].map(at)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('drei Schritte pro Sekunde, egal ob der Laufzyklus 4 oder 8 Bilder hat', () => {
    for (const n of [4, 8]) {
      const a = new Actor('q', 'w', 'd1');
      a.play('walk', true, walkFps(n));
      a.animT = 1;
      expect(a.stepIndex(n)).toBe(3);
    }
  });

  it('Pferd Hufe, Turm Stein, alle anderen Rüstung', () => {
    expect(footstepSfx('n')).toBe('hoof');
    expect(footstepSfx('r')).toBe('stone');
    for (const k of ['p', 'b', 'q', 'k']) expect(footstepSfx(k)).toBe('armorstep');
  });
});

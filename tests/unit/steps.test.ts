import { describe, expect, it } from 'vitest';
import { footstepSfx } from '../../src/audio/sfx.ts';
import { WALK_FPS } from '../../src/config.ts';
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

  it('Pferd Hufe, Turm Stein, alle anderen Rüstung', () => {
    expect(footstepSfx('n')).toBe('hoof');
    expect(footstepSfx('r')).toBe('stone');
    for (const k of ['p', 'b', 'q', 'k']) expect(footstepSfx(k)).toBe('armorstep');
  });
});

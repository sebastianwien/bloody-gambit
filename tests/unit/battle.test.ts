import { describe, expect, it } from 'vitest';
import { allPairings, DEATHS, estimateDuration, planBattle, shouldShowBattle } from '../../src/battle/kit.ts';

describe('Kampf-Baukasten', () => {
  it('30 Paarungen, König nie Opfer', () => {
    const p = allPairings();
    expect(p).toHaveLength(30);
    expect(p.some(([, v]) => (v as string) === 'k')).toBe(false);
    expect(() => planBattle('q', 'k', 1)).toThrow();
  });

  it('jede Paarung ergibt einen gültigen Plan mit genau einem Tod', () => {
    for (const [a, v] of allPairings()) {
      for (let seed = 0; seed < 20; seed++) {
        const plan = planBattle(a, v, seed);
        const deaths = plan.steps.filter((s) => s.t === 'death');
        expect(deaths).toHaveLength(1);
        expect(DEATHS[v]).toContain(plan.death);
        expect(plan.steps.some((s) => s.t === 'hit')).toBe(true);
        expect(plan.steps[0].t).toBe('approach');
        // Kampf kurz genug, dass er nicht nervt
        expect(estimateDuration(plan)).toBeLessThan(7);
      }
    }
  });

  it('jedes Opfer hat 2 bis 3 Tod-Varianten und alle kommen vor', () => {
    for (const [v, list] of Object.entries(DEATHS)) {
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list.length).toBeLessThanOrEqual(3);
      const seen = new Set<string>();
      for (const a of ['p', 'n', 'b', 'r', 'q', 'k'] as const) for (let s = 0; s < 50; s++) seen.add(planBattle(a, v as 'p', s).death);
      for (const d of list) expect(seen, v + ' ' + d).toContain(d);
    }
  });

  it('ist reproduzierbar über den Seed', () => {
    expect(planBattle('k', 'q', 42)).toEqual(planBattle('k', 'q', 42));
  });

  it('Einstellung immer / nur neue / aus', () => {
    const seen = new Set<string>();
    expect(shouldShowBattle('new', seen, 'p', 'p')).toBe(true);
    expect(shouldShowBattle('new', seen, 'p', 'p')).toBe(false);
    expect(shouldShowBattle('always', seen, 'p', 'p')).toBe(true);
    expect(shouldShowBattle('off', seen, 'q', 'n')).toBe(false);
    expect(shouldShowBattle('new', seen, 'q', 'n')).toBe(true);
  });
});

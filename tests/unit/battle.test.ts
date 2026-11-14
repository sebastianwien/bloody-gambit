import { describe, expect, it } from 'vitest';
import { allPairings, CUSTOM, DEATHS, estimateDuration, planBattle, shouldShowBattle, validatePlan } from '../../src/battle/kit.ts';

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
        if (!CUSTOM[a + v]) expect(DEATHS[v]).toContain(plan.death);
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

  it('jeder Kampf erfüllt die Dramaturgie-Regeln (alle 30 Paarungen, viele Seeds)', () => {
    for (const [a, v] of allPairings()) {
      for (let seed = 0; seed < 40; seed++) {
        const plan = planBattle(a, v, seed);
        expect(validatePlan(plan), `${a}${v} ${plan.finisher} ${plan.death}`).toEqual([]);
      }
    }
  });

  it('Regeln greifen: Schlag nach abgetrenntem Arm wird erkannt', () => {
    const bad = {
      attacker: 'p' as const, victim: 'p' as const, finisher: 'x', death: 'behead' as const,
      steps: [
        { t: 'approach' as const, stop: 1 },
        { t: 'hit' as const, blood: 1, shake: 1, sound: 'slash' as const },
        { t: 'sever' as const, part: 'arm' as const },
        { t: 'hit' as const, blood: 1, shake: 1, sound: 'stab' as const },
        { t: 'death' as const, variant: 'behead' as const },
      ],
    };
    const errs = validatePlan(bad);
    expect(errs).toContain('Schlag nach schwerer Wunde');
    expect(errs).toContain('behead passt nicht zu stab');
  });

  it('die häufigsten Paarungen haben eigene Finisher', () => {
    for (const k of ['pp', 'np', 'bp', 'qp', 'kp', 'rp', 'pn', 'nn']) expect(CUSTOM[k], k).toBeDefined();
    expect(planBattle('p', 'p', 1).finisher).toBe('stocherduell');
    expect(planBattle('q', 'p', 1).death).toBe('launch');
  });

  it('Springer kämpft mit den Hufen: Ausschlagen mit dem Rücken zum Opfer, sonst Niedertrampeln', () => {
    for (const v of ['p', 'n', 'b', 'r', 'q'] as const) {
      const seen = new Set<string>();
      for (let seed = 0; seed < 40; seed++) {
        const plan = planBattle('n', v, seed);
        expect(validatePlan(plan)).toEqual([]);
        expect(plan.steps.some((s) => s.t === 'leap')).toBe(false);
        const strike = plan.steps.find((s) => s.t === 'anim' && s.who === 'a');
        const anim = strike?.t === 'anim' ? strike.anim : null;
        seen.add(anim ?? '');
        const turn = plan.steps.findIndex((s) => s.t === 'turn');
        if (anim === 'kick') expect(turn).toBeGreaterThan(-1);
        else expect(turn).toBe(-1);
        if (anim === 'kick') expect(['launch', 'fall', 'crumble']).toContain(plan.death);
        if (anim === 'stomp') expect(['squash', 'gib']).toContain(plan.death);
      }
      // Ein Turm wird eingetreten, ein Pferd umgeworfen oder zertrampelt
      if (v === 'r') expect([...seen]).toEqual(['kick']);
      else expect(seen.size).toBe(2);
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

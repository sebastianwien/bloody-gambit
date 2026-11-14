import { mulberry32 } from '../util/random.ts';
import { brownNoise } from './sfx.ts';

/**
 * Eigener WebAudio-Sequencer: düster-mittelalterliche Stücke in d-Moll,
 * Instrumente synthetisch (Bordun, Laute, Chor, Glocke, Trommel).
 * Es wird fortlaufend vorausgeplant, darum loopt die Musik nahtlos und variiert leicht.
 */

export type TrackName = 'menu' | 'game' | 'victory' | 'defeat' | 'tension';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// d-Moll (äolisch) mit erhöhter Septime für Dominanten
interface Chord {
  root: number;
  tones: number[];
}
const C = (root: number, ...iv: number[]): Chord => ({ root, tones: iv.map((i) => root + i) });
const Dm = C(50, 0, 3, 7);
const Bb = C(46, 0, 4, 7);
const Cmaj = C(48, 0, 4, 7);
const Gm = C(43, 0, 3, 7);
const Amaj = C(45, 0, 4, 7);
const F = C(41, 0, 4, 7);
const Dmaj = C(50, 0, 4, 7);
const G = C(43, 0, 4, 7);

interface TrackDef {
  bpm: number;
  chords: Chord[];
  /** Instrumentierung je 16tel-Schritt (0..15) eines Takts. */
  step(m: Music, t: number, step: number, bar: number, chord: Chord, rnd: () => number, stepDur: number): void;
}

const SCALE = [0, 2, 3, 5, 7, 8, 10]; // d-Moll ab D
function scaleNote(deg: number, base = 62): number {
  const o = Math.floor(deg / 7);
  const i = ((deg % 7) + 7) % 7;
  return base + o * 12 + SCALE[i];
}

const TRACKS: Record<TrackName, TrackDef> = {
  menu: {
    bpm: 64,
    chords: [Dm, Dm, Bb, Cmaj, Dm, Gm, Amaj, Dm],
    step(m, t, s, bar, ch, rnd, sd) {
      if (s === 0) {
        m.drone(t, mtof(ch.root - 12), sd * 16, 0.11);
        m.choir(t, ch.tones.map((n) => mtof(n + 12)), sd * 16, 0.05);
      }
      if (s % 4 === 0) m.lute(t, mtof(ch.tones[(s / 4) % 3] + 12 + (s === 12 ? 12 : 0)), 0.9, 0.09);
      if (s === 0 && bar % 2 === 0) m.bell(t + sd * 2, mtof(ch.tones[2] + 24), 0.05);
      // Melodie: wenige, lange Töne
      if ((s === 6 || s === 10) && rnd() < 0.6) m.flute(t, mtof(scaleNote(Math.floor(rnd() * 6) + 2, 62)), sd * 3.5, 0.045);
      if (s === 0 || s === 8) m.drum(t, 0.12, 70);
    },
  },
  game: {
    bpm: 72,
    chords: [Dm, Dm, Gm, Dm, Bb, F, Gm, Amaj, Dm, Cmaj, Bb, Amaj],
    step(m, t, s, bar, ch, rnd, sd) {
      if (s === 0) {
        m.drone(t, mtof(ch.root - 12), sd * 16, 0.09);
        if (bar % 4 === 0) m.choir(t, ch.tones.map((n) => mtof(n + 12)), sd * 16, 0.035);
      }
      // gezupfte Laute, sparsam und variiert
      if (s % 2 === 0 && rnd() < (s % 4 === 0 ? 0.85 : 0.35)) {
        const n = ch.tones[Math.floor(rnd() * 3)] + 12 + (rnd() < 0.25 ? 12 : 0);
        m.lute(t, mtof(n), 0.7, 0.07);
      }
      if (s === 0) m.drum(t, 0.15, 65);
      if (s === 10 && rnd() < 0.5) m.drum(t, 0.07, 80);
      if (s === 8 && bar % 4 === 3) m.frame(t, 0.06);
      if (bar % 8 === 6 && s === 4) m.bell(t, mtof(scaleNote(4, 74)), 0.035);
    },
  },
  tension: {
    bpm: 90,
    chords: [Dm, Bb, Gm, Amaj],
    step(m, t, s, _bar, ch, _rnd, sd) {
      if (s === 0) m.drone(t, mtof(ch.root - 12), sd * 16, 0.1);
      if (s % 4 === 0) m.drum(t, 0.16, 60);
      if (s % 2 === 1) m.frame(t, 0.03);
      if (s % 4 === 2) m.lute(t, mtof(ch.root + 12), 0.4, 0.06);
    },
  },
  victory: {
    bpm: 84,
    chords: [Dmaj, G, Amaj, Dmaj, Bb, Cmaj, Amaj, Dmaj],
    step(m, t, s, _bar, ch, rnd, sd) {
      if (s === 0) {
        m.drone(t, mtof(ch.root - 12), sd * 16, 0.1);
        m.choir(t, ch.tones.map((n) => mtof(n + 12)), sd * 16, 0.05);
        m.drum(t, 0.18, 70);
      }
      if (s === 8) m.drum(t, 0.12, 70);
      if (s % 4 === 0) m.lute(t, mtof(ch.tones[(s / 4) % 3] + 24), 0.6, 0.08);
      if (s === 4 && rnd() < 0.7) m.bell(t, mtof(ch.tones[1] + 24), 0.05);
    },
  },
  defeat: {
    bpm: 52,
    chords: [Dm, Gm, Bb, Amaj, Dm, Bb, Gm, Dm],
    step(m, t, s, _bar, ch, rnd, sd) {
      if (s === 0) {
        m.drone(t, mtof(ch.root - 24), sd * 16, 0.12);
        m.choir(t, ch.tones.map((n) => mtof(n)), sd * 16, 0.06);
        m.drum(t, 0.14, 55);
      }
      if (s === 8 && rnd() < 0.7) m.bell(t, mtof(ch.tones[0] + 24), 0.04);
    },
  },
};

export class Music {
  readonly out: GainNode;
  private trackOut: GainNode | null = null;
  private track: TrackName | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private rnd = mulberry32(1);
  private reverb: ConvolverNode;
  private wet: GainNode;

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.out = ctx.createGain();
    this.out.connect(dest);
    // Hall für die Krypta-Stimmung (kurze Impulsantwort aus Rauschen)
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.6);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.35;
    this.reverb.connect(this.wet).connect(this.out);
  }

  private impulse(sec: number): AudioBuffer {
    const len = Math.floor(this.ctx.sampleRate * sec);
    const b = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return b;
  }

  get current(): TrackName | null {
    return this.track;
  }

  play(name: TrackName | null, fade = 1.5) {
    if (name === this.track) return;
    const now = this.ctx.currentTime;
    if (this.trackOut) {
      const old = this.trackOut;
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0, now + fade);
      setTimeout(() => old.disconnect(), (fade + 4) * 1000);
    }
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track = name;
    if (!name) {
      this.trackOut = null;
      return;
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(1, now + fade);
    g.connect(this.out);
    g.connect(this.reverb);
    this.trackOut = g;
    this.nextTime = now + 0.1;
    this.step = 0;
    this.bar = 0;
    this.rnd = mulberry32(Math.floor(Math.random() * 1e6));
    this.timer = setInterval(() => this.schedule(), 40);
    this.schedule();
  }

  private schedule() {
    if (!this.track || !this.trackOut) return;
    const def = TRACKS[this.track];
    const sd = 60 / def.bpm / 4;
    // Nachholen, falls der Tab im Hintergrund lag, ohne Notenflut
    if (this.nextTime < this.ctx.currentTime - 0.5) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const chord = def.chords[this.bar % def.chords.length];
      def.step(this, this.nextTime, this.step, this.bar, chord, this.rnd, sd);
      this.nextTime += sd;
      this.step++;
      if (this.step === 16) {
        this.step = 0;
        this.bar++;
      }
    }
  }

  private get o(): AudioNode {
    return this.trackOut!;
  }

  // ---------- Instrumente ----------

  drone(t: number, f: number, dur: number, v: number) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.6);
    g.gain.setValueAtTime(v, t + dur - 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    lp.connect(g).connect(this.o);
    for (const [mul, det] of [
      [1, -7],
      [1, 7],
      [1.5, 0],
      [0.5, 0],
    ]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f * mul;
      osc.detune.value = det;
      const og = ctx.createGain();
      og.gain.value = mul === 1.5 ? 0.35 : mul === 0.5 ? 0.6 : 0.5;
      osc.connect(og).connect(lp);
      osc.start(t);
      osc.stop(t + dur + 0.5);
    }
  }

  lute(t: number, f: number, dur: number, v: number) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = f * 2.003;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(380, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ctx.createGain();
    g2.gain.value = 0.3;
    osc.connect(lp);
    osc2.connect(g2).connect(lp);
    lp.connect(g).connect(this.o);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + dur + 0.05);
    osc2.stop(t + dur + 0.05);
  }

  choir(t: number, freqs: number[], dur: number, v: number) {
    const ctx = this.ctx;
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.5 + Math.random();
      const lg = ctx.createGain();
      lg.gain.value = f * 0.006;
      lfo.connect(lg).connect(osc.frequency);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700;
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + dur * 0.35);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
      osc.connect(bp).connect(g).connect(this.o);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + dur + 0.4);
      lfo.stop(t + dur + 0.4);
    }
  }

  flute(t: number, f: number, dur: number, v: number) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5;
    const lg = ctx.createGain();
    lg.gain.value = f * 0.008;
    lfo.connect(lg).connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.12);
    g.gain.setValueAtTime(v, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.o);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  bell(t: number, f: number, v: number) {
    const ctx = this.ctx;
    for (const [r, a] of [
      [1, 1],
      [2.76, 0.5],
      [5.4, 0.25],
    ]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f * r;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v * a, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3 / Math.sqrt(r));
      osc.connect(g).connect(this.o);
      osc.start(t);
      osc.stop(t + 3.2);
    }
  }

  drum(t: number, v: number, f = 70) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * 1.6, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(g).connect(this.o);
    osc.start(t);
    osc.stop(t + 0.55);
    this.frame(t, v * 0.3);
  }

  frame(t: number, v: number) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = brownNoise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 250;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v * 4, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    src.connect(bp).connect(g).connect(this.o);
    src.start(t, Math.random() * 2);
    src.stop(t + 0.15);
  }
}

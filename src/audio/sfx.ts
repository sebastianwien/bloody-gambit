/**
 * Prozedurale Klangeffekte (sfxr-artig): Oszillatoren und Rauschen mit Hüllkurven und Filtern,
 * geschichtet. Keine Audiodateien. Jede Funktion erzeugt einen Klang ab Zeitpunkt t.
 */

export type SfxFn = (ctx: AudioContext, out: AudioNode, t: number, v: number) => void;

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = ctx.sampleRate * 2;
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = b;
  return b;
}

let brownBuf: AudioBuffer | null = null;
export function brownNoise(ctx: AudioContext): AudioBuffer {
  if (brownBuf && brownBuf.sampleRate === ctx.sampleRate) return brownBuf;
  const len = ctx.sampleRate * 4;
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  // Nahtlos: Enden weich ineinander
  const fade = 2000;
  for (let i = 0; i < fade; i++) d[len - fade + i] = d[len - fade + i] * (1 - i / fade) + d[i] * (i / fade);
  brownBuf = b;
  return b;
}

/** Hüllkurve: Anstieg a, Halten h, Abklingen d (Sekunden). */
function env(ctx: AudioContext, t: number, peak: number, a: number, h: number, d: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + h);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + h + d);
  return g;
}

function noiseHit(ctx: AudioContext, out: AudioNode, t: number, o: { type: BiquadFilterType; f: number; f2?: number; q?: number; peak: number; a?: number; h?: number; d: number; rate?: number }) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.playbackRate.value = o.rate ?? 1;
  const fl = ctx.createBiquadFilter();
  fl.type = o.type;
  fl.frequency.setValueAtTime(o.f, t);
  if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + (o.a ?? 0.002) + (o.h ?? 0) + o.d);
  fl.Q.value = o.q ?? 1;
  const g = env(ctx, t, o.peak, o.a ?? 0.002, o.h ?? 0, o.d);
  src.connect(fl).connect(g).connect(out);
  src.start(t, Math.random() * 1.5);
  src.stop(t + (o.a ?? 0.002) + (o.h ?? 0) + o.d + 0.05);
}

function tone(ctx: AudioContext, out: AudioNode, t: number, o: { type: OscillatorType; f: number; f2?: number; peak: number; a?: number; h?: number; d: number; lp?: number; detune?: number }) {
  const osc = ctx.createOscillator();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.a ?? 0.005) + (o.h ?? 0) + o.d);
  if (o.detune) osc.detune.value = o.detune;
  const g = env(ctx, t, o.peak, o.a ?? 0.005, o.h ?? 0, o.d);
  let node: AudioNode = osc;
  if (o.lp) {
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = o.lp;
    node = osc.connect(fl);
  }
  node.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + (o.a ?? 0.005) + (o.h ?? 0) + o.d + 0.05);
}

/** Metallischer Klang aus unharmonischen Teiltönen. */
function metal(ctx: AudioContext, out: AudioNode, t: number, base: number, peak: number, d: number) {
  for (const [r, a] of [
    [1, 1],
    [2.76, 0.6],
    [5.4, 0.4],
    [8.93, 0.25],
  ]) {
    tone(ctx, out, t, { type: 'sine', f: base * r * (0.98 + Math.random() * 0.04), peak: peak * a, d: d / Math.sqrt(r) });
  }
}

/** Stimme mit zwei Formanten (grober Vokal), für Schreie und Ächzen. */
function voice(ctx: AudioContext, out: AudioNode, t: number, o: { f: number; f2: number; dur: number; peak: number; formants: [number, number]; vib?: number }) {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(o.f, t);
  osc.frequency.linearRampToValueAtTime(o.f * 1.15, t + o.dur * 0.2);
  osc.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
  if (o.vib) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 7;
    const lg = ctx.createGain();
    lg.gain.value = o.vib;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + o.dur + 0.1);
  }
  const g = env(ctx, t, o.peak, 0.02, o.dur * 0.4, o.dur * 0.6);
  for (const [i, f] of o.formants.entries()) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = 6;
    const fg = ctx.createGain();
    fg.gain.value = i === 0 ? 1.4 : 0.9;
    osc.connect(bp).connect(fg).connect(g);
  }
  g.connect(out);
  osc.start(t);
  osc.stop(t + o.dur + 0.1);
  // Rauschanteil für Heiserkeit
  noiseHit(ctx, out, t, { type: 'bandpass', f: o.formants[0] * 1.5, q: 2, peak: o.peak * 0.15, a: 0.02, h: o.dur * 0.3, d: o.dur * 0.5 });
}

const r = (a: number, b: number) => a + Math.random() * (b - a);

export const SFX: Record<string, SfxFn> = {
  click: (c, o, t, v) => tone(c, o, t, { type: 'square', f: 900, f2: 600, peak: 0.12 * v, d: 0.05, lp: 3000 }),
  hover: (c, o, t, v) => tone(c, o, t, { type: 'square', f: 1400, peak: 0.04 * v, d: 0.02, lp: 3000 }),
  select: (c, o, t, v) => {
    tone(c, o, t, { type: 'triangle', f: 520, f2: 780, peak: 0.12 * v, d: 0.08 });
    metal(c, o, t, 1800, 0.03 * v, 0.2);
  },
  deny: (c, o, t, v) => tone(c, o, t, { type: 'square', f: 180, f2: 120, peak: 0.08 * v, d: 0.12, lp: 900 }),
  step: (c, o, t, v) => noiseHit(c, o, t, { type: 'lowpass', f: 380, peak: 0.25 * v, d: 0.07 }),
  clank: (c, o, t, v) => {
    noiseHit(c, o, t, { type: 'lowpass', f: 420, peak: 0.22 * v, d: 0.06 });
    metal(c, o, t + 0.005, r(1500, 1900), 0.025 * v, 0.12);
  },
  hoof: (c, o, t, v) => {
    for (const dt of [0, 0.07]) {
      noiseHit(c, o, t + dt, { type: 'bandpass', f: 900, q: 3, peak: 0.25 * v, d: 0.04 });
      tone(c, o, t + dt, { type: 'sine', f: 180, f2: 90, peak: 0.2 * v, d: 0.06 });
    }
  },
  stone: (c, o, t, v) => noiseHit(c, o, t, { type: 'lowpass', f: 250, peak: 0.35 * v, a: 0.03, h: 0.05, d: 0.2 }),
  swing: (c, o, t, v) => noiseHit(c, o, t, { type: 'bandpass', f: 3500, f2: 500, q: 1.5, peak: 0.25 * v, a: 0.05, d: 0.18 }),
  whoosh: (c, o, t, v) => noiseHit(c, o, t, { type: 'bandpass', f: 1200, f2: 300, q: 1, peak: 0.25 * v, a: 0.08, d: 0.25 }),
  stab: (c, o, t, v) => {
    noiseHit(c, o, t, { type: 'highpass', f: 2500, peak: 0.25 * v, d: 0.06 });
    tone(c, o, t, { type: 'sine', f: 160, f2: 60, peak: 0.45 * v, d: 0.14 });
    noiseHit(c, o, t + 0.02, { type: 'lowpass', f: 700, peak: 0.3 * v, d: 0.12 });
  },
  slash: (c, o, t, v) => {
    noiseHit(c, o, t, { type: 'bandpass', f: 5000, f2: 900, q: 2, peak: 0.3 * v, d: 0.15 });
    metal(c, o, t, r(900, 1200), 0.06 * v, 0.6);
    tone(c, o, t + 0.03, { type: 'sine', f: 120, f2: 50, peak: 0.4 * v, d: 0.15 });
  },
  blunt: (c, o, t, v) => {
    tone(c, o, t, { type: 'sine', f: 110, f2: 40, peak: 0.6 * v, d: 0.25 });
    noiseHit(c, o, t, { type: 'lowpass', f: 600, peak: 0.4 * v, d: 0.15 });
  },
  magic: (c, o, t, v) => {
    [0, 0.06, 0.12, 0.18].forEach((dt, i) => tone(c, o, t + dt, { type: 'triangle', f: 660 * Math.pow(1.26, i), peak: 0.1 * v, d: 0.5 }));
    noiseHit(c, o, t + 0.2, { type: 'highpass', f: 4000, peak: 0.1 * v, a: 0.05, d: 0.6 });
    tone(c, o, t + 0.2, { type: 'sawtooth', f: 80, f2: 40, peak: 0.25 * v, d: 0.5, lp: 400 });
  },
  zap: (c, o, t, v) => {
    tone(c, o, t, { type: 'sawtooth', f: 200, f2: 1600, peak: 0.12 * v, d: 0.18, lp: 3000 });
    noiseHit(c, o, t, { type: 'highpass', f: 3000, peak: 0.15 * v, d: 0.25 });
  },
  arrow: (c, o, t, v) => {
    noiseHit(c, o, t, { type: 'highpass', f: 2000, peak: 0.2 * v, d: 0.04 });
    tone(c, o, t, { type: 'sine', f: 220, f2: 90, peak: 0.3 * v, d: 0.08 });
  },
  bowshot: (c, o, t, v) => {
    tone(c, o, t, { type: 'sawtooth', f: 140, f2: 110, peak: 0.25 * v, d: 0.25, lp: 1200 });
    noiseHit(c, o, t + 0.02, { type: 'bandpass', f: 2500, f2: 800, q: 2, peak: 0.15 * v, a: 0.02, d: 0.2 });
  },
  trample: (c, o, t, v) => {
    for (let i = 0; i < 4; i++) {
      tone(c, o, t + i * 0.06, { type: 'sine', f: 120, f2: 45, peak: 0.45 * v, d: 0.15 });
      noiseHit(c, o, t + i * 0.06, { type: 'lowpass', f: 500, peak: 0.3 * v, d: 0.1 });
    }
  },
  scream: (c, o, t, v) => {
    const f = r(220, 360);
    voice(c, o, t, { f, f2: f * 0.55, dur: r(0.45, 0.7), peak: 0.18 * v, formants: [r(700, 900), r(1100, 1300)], vib: 12 });
  },
  grunt: (c, o, t, v) => {
    const f = r(110, 160);
    voice(c, o, t, { f, f2: f * 0.8, dur: 0.16, peak: 0.16 * v, formants: [500, 900] });
  },
  splat: (c, o, t, v) => {
    noiseHit(c, o, t, { type: 'lowpass', f: 1400, f2: 200, peak: 0.45 * v, d: 0.25 });
    for (let i = 0; i < 3; i++) tone(c, o, t + i * 0.05 + r(0, 0.03), { type: 'sine', f: r(200, 400), f2: 60, peak: 0.15 * v, d: 0.08 });
  },
  crunch: (c, o, t, v) => {
    for (let i = 0; i < 6; i++) noiseHit(c, o, t + i * r(0.015, 0.03), { type: 'bandpass', f: r(1500, 3500), q: 4, peak: 0.25 * v, d: 0.02 });
    tone(c, o, t, { type: 'sine', f: 90, f2: 40, peak: 0.3 * v, d: 0.2 });
  },
  bodyfall: (c, o, t, v) => {
    tone(c, o, t, { type: 'sine', f: 90, f2: 35, peak: 0.55 * v, d: 0.3 });
    noiseHit(c, o, t, { type: 'lowpass', f: 400, peak: 0.35 * v, d: 0.2 });
    metal(c, o, t + 0.03, 1300, 0.03 * v, 0.25);
    metal(c, o, t + 0.11, 1650, 0.02 * v, 0.2);
  },
  burn: (c, o, t, v) => {
    noiseHit(c, o, t, { type: 'bandpass', f: 1200, q: 0.7, peak: 0.25 * v, a: 0.15, h: 0.4, d: 0.5 });
    for (let i = 0; i < 18; i++) noiseHit(c, o, t + r(0, 1), { type: 'highpass', f: 3000, peak: 0.15 * v, d: 0.01 });
  },
  rubble: (c, o, t, v) => {
    noiseHit(c, o, t, { type: 'lowpass', f: 300, peak: 0.6 * v, a: 0.05, h: 0.5, d: 0.8 });
    for (let i = 0; i < 10; i++) tone(c, o, t + r(0, 1.1), { type: 'sine', f: r(60, 140), f2: 40, peak: 0.3 * v, d: 0.15 });
  },
  jump: (c, o, t, v) => {
    noiseHit(c, o, t, { type: 'bandpass', f: 800, f2: 2000, q: 1, peak: 0.15 * v, a: 0.05, d: 0.15 });
    SFX.hoof(c, o, t, v * 0.6);
  },
  land: (c, o, t, v) => {
    tone(c, o, t, { type: 'sine', f: 100, f2: 40, peak: 0.5 * v, d: 0.2 });
    noiseHit(c, o, t, { type: 'lowpass', f: 500, peak: 0.3 * v, d: 0.15 });
  },
  thunder: (c, o, t, v) => {
    const src = c.createBufferSource();
    src.buffer = brownNoise(c);
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(900, t);
    fl.frequency.exponentialRampToValueAtTime(120, t + 3);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.9 * v, t + 0.05);
    g.gain.setValueAtTime(0.7 * v, t + 0.3);
    g.gain.linearRampToValueAtTime(0.9 * v, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    src.connect(fl).connect(g).connect(o);
    src.start(t, Math.random() * 2);
    src.stop(t + 3.6);
    noiseHit(c, o, t, { type: 'highpass', f: 1500, peak: 0.25 * v, d: 0.2 });
  },
  crow: (c, o, t, v) => {
    for (const dt of [0, 0.28]) voice(c, o, t + dt, { f: 520, f2: 380, dur: 0.18, peak: 0.08 * v, formants: [1400, 2400] });
  },
  rat: (c, o, t, v) => {
    for (const dt of [0, 0.09, 0.2]) tone(c, o, t + dt, { type: 'sine', f: r(2800, 3600), f2: 2200, peak: 0.05 * v, d: 0.05 });
  },
  check: (c, o, t, v) => {
    // Kurze Blechbläser-Fanfare
    [
      [0, 293.66],
      [0.14, 293.66],
      [0.28, 440],
    ].forEach(([dt, f]) => {
      for (const det of [-8, 8]) tone(c, o, t + dt, { type: 'sawtooth', f, peak: 0.07 * v, a: 0.02, h: dt === 0.28 ? 0.35 : 0.06, d: 0.15, lp: 1800, detune: det });
    });
    tone(c, o, t, { type: 'sine', f: 73.4, peak: 0.25 * v, a: 0.01, h: 0.4, d: 0.4 });
  },
  victory: (c, o, t, v) => {
    const notes = [293.66, 369.99, 440, 587.33];
    notes.forEach((f, i) => {
      for (const det of [-6, 6]) tone(c, o, t + i * 0.16, { type: 'sawtooth', f, peak: 0.06 * v, a: 0.02, h: i === 3 ? 1 : 0.1, d: 0.5, lp: 2200, detune: det });
    });
    tone(c, o, t + 0.48, { type: 'sine', f: 146.83, peak: 0.25 * v, a: 0.02, h: 1, d: 0.8 });
  },
  defeat: (c, o, t, v) => {
    [440, 349.23, 293.66, 220].forEach((f, i) => tone(c, o, t + i * 0.32, { type: 'triangle', f, peak: 0.12 * v, a: 0.05, h: i === 3 ? 0.8 : 0.15, d: 0.6 }));
    tone(c, o, t, { type: 'sawtooth', f: 55, peak: 0.12 * v, a: 0.3, h: 1.4, d: 1, lp: 300 });
  },
  promote: (c, o, t, v) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, o, t + i * 0.08, { type: 'triangle', f, peak: 0.1 * v, d: 0.6 }));
    noiseHit(c, o, t, { type: 'highpass', f: 5000, peak: 0.08 * v, a: 0.2, d: 0.8 });
  },
  castle: (c, o, t, v) => {
    noiseHit(c, o, t, { type: 'lowpass', f: 300, peak: 0.25 * v, a: 0.1, h: 0.4, d: 0.3 });
    metal(c, o, t, 700, 0.04 * v, 0.6);
  },
  start: (c, o, t, v) => {
    // Gong zum Partiebeginn
    metal(c, o, t, 196, 0.25 * v, 2.5);
    tone(c, o, t, { type: 'sine', f: 98, peak: 0.3 * v, d: 2 });
  },
};

export function playSfx(ctx: AudioContext, out: AudioNode, name: string, volume = 1, pan = 0) {
  const fn = SFX[name];
  if (!fn) return;
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan * 0.7));
  p.connect(out);
  fn(ctx, p, ctx.currentTime + 0.005, volume);
  // Panner nach Ende trennen
  setTimeout(() => p.disconnect(), 5000);
}

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

let shaperCurve: Float32Array | null = null;
/** Sättigung für dreckige, schwere Treffer. */
function drive(ctx: AudioContext, amount = 3): WaveShaperNode {
  const ws = ctx.createWaveShaper();
  if (!shaperCurve) {
    shaperCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      shaperCurve[i] = Math.tanh(x * amount);
    }
  }
  ws.curve = shaperCurve as Float32Array<ArrayBuffer>;
  return ws;
}

/** Körpertreffer: tiefer Schlag mit Tonhöhenabfall, verzerrt, plus dumpfes Rauschen. */
function thud(ctx: AudioContext, out: AudioNode, t: number, f0: number, peak: number, dur = 0.22) {
  const ws = drive(ctx, 4);
  ws.connect(out);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.32, t + dur);
  const g = env(ctx, t, peak, 0.002, 0.01, dur);
  osc.connect(g).connect(ws);
  osc.start(t);
  osc.stop(t + dur + 0.05);
  noiseHit(ctx, ws, t, { type: 'lowpass', f: 420, f2: 120, peak: peak * 0.9, d: dur * 0.8 });
}

/** Nasses Fleisch: Rauschen durch wandernden Bandpass, mehrere kleine Stöße. */
function flesh(ctx: AudioContext, out: AudioNode, t: number, peak: number, len = 0.16) {
  for (let i = 0; i < 3; i++) {
    noiseHit(ctx, out, t + i * len * 0.28 + r(0, 0.01), { type: 'bandpass', f: r(900, 1300), f2: r(180, 260), q: 1.8, peak: peak * (1 - i * 0.25), d: len * (1 - i * 0.2) });
  }
}

/** Knochen knackt: kurze, scharfe Klicks. */
function crack(ctx: AudioContext, out: AudioNode, t: number, peak: number, n = 4) {
  for (let i = 0; i < n; i++) noiseHit(ctx, out, t + i * r(0.008, 0.02), { type: 'bandpass', f: r(1800, 3800), q: 3, peak, d: 0.012 });
}

/** Kettenhemd raschelt (statt Glockentöne). */
function mail(ctx: AudioContext, out: AudioNode, t: number, peak: number, n = 5) {
  for (let i = 0; i < n; i++) noiseHit(ctx, out, t + i * r(0.01, 0.03), { type: 'highpass', f: r(5000, 7000), peak: peak * r(0.5, 1), d: r(0.01, 0.03) });
}

const r = (a: number, b: number) => a + Math.random() * (b - a);

/** Wiehern: schriller Anstieg, dann abfallend mit Zittern (Tremolo), am Ende Schnauben. */
function whinny(ctx: AudioContext, out: AudioNode, t: number, peak: number) {
  const dur = 1.15;
  const g = env(ctx, t, peak, 0.04, dur * 0.45, dur * 0.55);
  // Zittern der Lautstärke, gegen Ende schneller
  const trem = ctx.createGain();
  trem.gain.value = 0.6;
  const tl = ctx.createOscillator();
  tl.frequency.setValueAtTime(9, t);
  tl.frequency.linearRampToValueAtTime(16, t + dur);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.05, t);
  tg.gain.linearRampToValueAtTime(0.4, t + 0.35);
  tl.connect(tg).connect(trem.gain);
  trem.connect(g).connect(out);
  for (const det of [0, 14]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.detune.value = det;
    osc.frequency.setValueAtTime(430, t);
    osc.frequency.exponentialRampToValueAtTime(1050, t + 0.13);
    osc.frequency.setValueAtTime(1050, t + 0.22);
    osc.frequency.exponentialRampToValueAtTime(560, t + 0.7);
    osc.frequency.exponentialRampToValueAtTime(320, t + dur);
    const vib = ctx.createOscillator();
    vib.frequency.value = 8;
    const vg = ctx.createGain();
    vg.gain.value = 35;
    vib.connect(vg).connect(osc.frequency);
    for (const [f, a] of [
      [1050, 1.2],
      [2300, 0.8],
      [3500, 0.35],
    ]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 4;
      const fg = ctx.createGain();
      fg.gain.value = a;
      osc.connect(bp).connect(fg).connect(trem);
    }
    osc.start(t);
    vib.start(t);
    osc.stop(t + dur + 0.1);
    vib.stop(t + dur + 0.1);
  }
  tl.start(t);
  tl.stop(t + dur + 0.1);
  // Atem im Klang, dann zweimal Schnauben
  noiseHit(ctx, out, t, { type: 'bandpass', f: 2600, q: 1, peak: peak * 0.18, a: 0.05, h: dur * 0.5, d: dur * 0.4 });
  for (const dt of [dur + 0.08, dur + 0.26]) noiseHit(ctx, out, t + dt, { type: 'lowpass', f: 900, f2: 200, peak: peak * 1.1, a: 0.01, d: 0.16 });
}

/** Schritt in Plattenrüstung: dumpfer Stiefel, Platten schlagen nach, Kettenhemd klirrt. */
function armorStep(ctx: AudioContext, out: AudioNode, t: number, v: number) {
  // Eisenschuh setzt auf: dumpfer Schlag plus kurzer, tiefer Metallklang
  thud(ctx, out, t, r(70, 85), 0.08 * v, 0.1);
  noiseHit(ctx, out, t, { type: 'lowpass', f: 300, peak: 0.16 * v, d: 0.07 });
  metal(ctx, out, t, r(320, 420), 0.09 * v, 0.12);
  noiseHit(ctx, out, t, { type: 'bandpass', f: r(1800, 2600), q: 3, peak: 0.12 * v, d: 0.03 });
  // Platten schlagen gegeneinander und klingen nach (Beinschiene, Tasse, Brust, Schulter)
  for (const dt of [r(0.015, 0.03), r(0.045, 0.07), r(0.08, 0.11), r(0.12, 0.16)]) {
    metal(ctx, out, t + dt, r(700, 2200), r(0.06, 0.1) * v, r(0.18, 0.32));
    noiseHit(ctx, out, t + dt, { type: 'bandpass', f: r(3000, 5000), q: 2.5, peak: 0.1 * v, d: 0.025 });
  }
  // Kettenhemd rasselt dicht hinterher
  for (let i = 0; i < 14; i++) noiseHit(ctx, out, t + 0.01 + i * r(0.008, 0.016), { type: 'bandpass', f: r(4500, 8000), q: 3, peak: r(0.05, 0.11) * v, d: r(0.01, 0.025) });
}

/** Schrittgeräusch je Figur: Pferd Hufe, Turm Stein, alle anderen Rüstung. */
export function footstepSfx(kind: string): 'hoof' | 'stone' | 'armorstep' {
  return kind === 'n' ? 'hoof' : kind === 'r' ? 'stone' : 'armorstep';
}

export const SFX: Record<string, SfxFn> = {
  click: (c, o, t, v) => tone(c, o, t, { type: 'square', f: 900, f2: 600, peak: 0.12 * v, d: 0.05, lp: 3000 }),
  hover: (c, o, t, v) => tone(c, o, t, { type: 'square', f: 1400, peak: 0.04 * v, d: 0.02, lp: 3000 }),
  select: (c, o, t, v) => {
    tone(c, o, t, { type: 'triangle', f: 520, f2: 780, peak: 0.12 * v, d: 0.08 });
    metal(c, o, t, 1800, 0.03 * v, 0.2);
  },
  deny: (c, o, t, v) => tone(c, o, t, { type: 'square', f: 180, f2: 120, peak: 0.08 * v, d: 0.12, lp: 900 }),
  step: (c, o, t, v) => {
    noiseHit(c, o, t, { type: 'lowpass', f: 300, peak: 0.25 * v, d: 0.07 });
  },
  clank: (c, o, t, v) => {
    noiseHit(c, o, t, { type: 'lowpass', f: 320, peak: 0.28 * v, d: 0.08 });
    mail(c, o, t + 0.01, 0.05 * v, 3);
  },
  armorstep: (c, o, t, v) => armorStep(c, o, t, v),
  neigh: (c, o, t, v) => whinny(c, o, t, 0.2 * v),
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
    noiseHit(c, o, t, { type: 'bandpass', f: 2200, f2: 700, q: 1.2, peak: 0.12 * v, a: 0.02, d: 0.06 });
    thud(c, o, t + 0.03, 140, 0.55 * v, 0.18);
    flesh(c, o, t + 0.03, 0.5 * v, 0.14);
    crack(c, o, t + 0.05, 0.12 * v, 2);
  },
  slash: (c, o, t, v) => {
    noiseHit(c, o, t, { type: 'highpass', f: 3000, f2: 1200, peak: 0.12 * v, d: 0.08 });
    flesh(c, o, t + 0.02, 0.6 * v, 0.22);
    thud(c, o, t + 0.02, 110, 0.45 * v, 0.2);
    mail(c, o, t + 0.02, 0.06 * v, 3);
  },
  blunt: (c, o, t, v) => {
    thud(c, o, t, 85, 0.8 * v, 0.28);
    crack(c, o, t + 0.01, 0.2 * v, 5);
    flesh(c, o, t + 0.02, 0.25 * v, 0.1);
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
    noiseHit(c, o, t, { type: 'highpass', f: 2500, peak: 0.12 * v, d: 0.03 });
    thud(c, o, t + 0.01, 180, 0.35 * v, 0.1);
    flesh(c, o, t + 0.01, 0.3 * v, 0.08);
  },
  bowshot: (c, o, t, v) => {
    tone(c, o, t, { type: 'sawtooth', f: 140, f2: 110, peak: 0.25 * v, d: 0.25, lp: 1200 });
    noiseHit(c, o, t + 0.02, { type: 'bandpass', f: 2500, f2: 800, q: 2, peak: 0.15 * v, a: 0.02, d: 0.2 });
  },
  trample: (c, o, t, v) => {
    for (let i = 0; i < 4; i++) {
      thud(c, o, t + i * 0.07, 100, 0.55 * v, 0.18);
      if (i > 1) crack(c, o, t + i * 0.07, 0.18 * v, 3);
    }
    flesh(c, o, t + 0.15, 0.5 * v, 0.2);
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
    flesh(c, o, t, 0.8 * v, 0.3);
    noiseHit(c, o, t, { type: 'lowpass', f: 900, f2: 150, peak: 0.45 * v, d: 0.3 });
    for (let i = 0; i < 4; i++) noiseHit(c, o, t + 0.12 + i * r(0.05, 0.12), { type: 'bandpass', f: r(500, 900), q: 4, peak: 0.12 * v, d: 0.04 });
  },
  crunch: (c, o, t, v) => {
    crack(c, o, t, 0.35 * v, 8);
    thud(c, o, t, 70, 0.6 * v, 0.25);
    flesh(c, o, t + 0.04, 0.4 * v, 0.15);
  },
  bodyfall: (c, o, t, v) => {
    thud(c, o, t, 65, 0.75 * v, 0.32);
    mail(c, o, t + 0.02, 0.08 * v, 8);
    noiseHit(c, o, t + 0.05, { type: 'lowpass', f: 300, peak: 0.3 * v, d: 0.25 });
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
    thud(c, o, t, 90, 0.6 * v, 0.22);
    mail(c, o, t + 0.01, 0.05 * v, 4);
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
  parry: (c, o, t, v) => {
    // Stahl auf Stahl: kurz, hart, schnell gedämpft
    noiseHit(c, o, t, { type: 'highpass', f: 2500, peak: 0.35 * v, d: 0.05 });
    metal(c, o, t, r(620, 760), 0.12 * v, 0.18);
    thud(c, o, t, 160, 0.25 * v, 0.1);
  },
  sever: (c, o, t, v) => {
    // Glied ab: Schnitt, Knochen bricht, dann schwallweise Blut
    noiseHit(c, o, t, { type: 'highpass', f: 3500, f2: 1500, peak: 0.15 * v, d: 0.06 });
    crack(c, o, t + 0.02, 0.4 * v, 7);
    flesh(c, o, t + 0.02, 0.8 * v, 0.25);
    thud(c, o, t + 0.02, 95, 0.5 * v, 0.22);
    for (let i = 0; i < 5; i++) noiseHit(c, o, t + 0.25 + i * 0.13, { type: 'bandpass', f: 600, f2: 300, q: 1.2, peak: (0.3 - i * 0.05) * v, d: 0.1 });
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

import { Music, type TrackName } from './music.ts';
import { brownNoise, playSfx } from './sfx.ts';

/**
 * Audio-Zentrale: startet beim ersten Klick (Browser-Vorgabe), getrennte Lautstärken
 * für Musik und Effekte, Umgebung (Regen, Fackelknistern) als Teil der Effekte.
 */
export class AudioManager {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambient: GainNode | null = null;
  music: Music | null = null;
  private wanted: TrackName | null = null;
  private vol = { music: 0.6, sfx: 0.8 };
  private crackle: ReturnType<typeof setInterval> | null = null;
  /** Für Tests: zuletzt gespielte Effekte. */
  log: string[] = [];

  constructor() {
    const unlock = () => {
      this.init();
      if (this.ctx?.state === 'suspended') this.ctx.resume();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
  }

  private init() {
    if (this.ctx) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(comp);
    this.sfxGain = ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain = ctx.createGain();
    this.musicGain.connect(this.master);
    this.music = new Music(ctx, this.musicGain);
    this.applyVolumes();
    this.startAmbient();
    if (this.wanted) this.music.play(this.wanted);
  }

  setVolumes(music: number, sfx: number) {
    this.vol = { music, sfx };
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Wahrgenommene Lautstärke: quadratisch
    this.musicGain!.gain.setTargetAtTime(this.vol.music * this.vol.music * 1.6, t, 0.05);
    this.sfxGain!.gain.setTargetAtTime(this.vol.sfx * this.vol.sfx, t, 0.05);
  }

  private startAmbient() {
    const ctx = this.ctx!;
    this.ambient = ctx.createGain();
    // Umgebung bewusst leise: Regen ist Hintergrund, nicht Hauptsache
    this.ambient.gain.value = 0.045;
    this.ambient.connect(this.sfxGain!);
    // Regen: Rauschen, hochpassgefiltert, dazu dumpfes Prasseln
    const rain = ctx.createBufferSource();
    rain.buffer = brownNoise(ctx);
    rain.loop = true;
    rain.playbackRate.value = 3.2;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    rain.connect(hp).connect(lp).connect(this.ambient);
    rain.start();
    const low = ctx.createBufferSource();
    low.buffer = brownNoise(ctx);
    low.loop = true;
    const lg = ctx.createGain();
    lg.gain.value = 0.35;
    const llp = ctx.createBiquadFilter();
    llp.type = 'lowpass';
    llp.frequency.value = 400;
    low.connect(llp).connect(lg).connect(this.ambient);
    low.start(0, 1.3);
    // Fackelknistern
    this.crackle = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      if (Math.random() < 0.5) {
        const n = this.ctx.createBufferSource();
        n.buffer = brownNoise(this.ctx);
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 2500;
        const g = this.ctx.createGain();
        const t = this.ctx.currentTime;
        g.gain.setValueAtTime(0.6 + Math.random() * 0.6, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
        n.connect(f).connect(g).connect(this.ambient!);
        n.start(t, Math.random() * 3);
        n.stop(t + 0.04);
      }
    }, 140);
  }

  sfx(name: string, pan = 0, volume = 1) {
    this.log.push(name);
    if (this.log.length > 60) this.log.shift();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running') return;
    playSfx(this.ctx, this.sfxGain, name, volume, pan);
  }

  /** Effekt mit Verzögerung (Donner nach dem Blitz). */
  later(name: string, delay: number, volume = 1) {
    setTimeout(() => this.sfx(name, 0, volume), delay * 1000);
  }

  playMusic(track: TrackName | null) {
    this.wanted = track;
    this.music?.play(track);
  }

  dispose() {
    if (this.crackle) clearInterval(this.crackle);
    this.ctx?.close();
  }
}

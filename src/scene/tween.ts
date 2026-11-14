/** Zeitgesteuerte Abläufe mit Vorspulen per Klick. */
interface Job {
  elapsed: number;
  dur: number;
  fn: (t: number) => void;
  resolve: () => void;
}

export const ease = {
  linear: (t: number) => t,
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t: number) => 1 - (1 - t) * (1 - t),
  in: (t: number) => t * t,
  outBack: (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
};

export class Tweens {
  private jobs: Job[] = [];
  /** Solange true, laufen alle neuen Abläufe sofort durch. */
  skipping = false;
  /** Zeitfaktor (Tests setzen ihn hoch). */
  speed = 1;

  run(dur: number, fn: (t: number) => void = () => {}): Promise<void> {
    if (this.skipping || dur <= 0) {
      fn(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      fn(0);
      this.jobs.push({ elapsed: 0, dur, fn, resolve });
    });
  }

  wait(dur: number): Promise<void> {
    return this.run(dur);
  }

  update(dt: number) {
    if (!this.jobs.length) return;
    const step = dt * this.speed;
    const done: Job[] = [];
    for (const j of this.jobs) {
      j.elapsed += step;
      const t = Math.min(1, j.elapsed / j.dur);
      j.fn(t);
      if (t >= 1) done.push(j);
    }
    if (done.length) {
      this.jobs = this.jobs.filter((j) => !done.includes(j));
      for (const j of done) j.resolve();
    }
  }

  /** Alle laufenden Abläufe sofort beenden und weitere überspringen. */
  skipAll() {
    this.skipping = true;
    const jobs = this.jobs;
    this.jobs = [];
    for (const j of jobs) {
      j.fn(1);
      j.resolve();
    }
  }

  get busy(): boolean {
    return this.jobs.length > 0;
  }
}

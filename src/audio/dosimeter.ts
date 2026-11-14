/**
 * Dosimeter clicks (concept 3.0, section 03, sound recipe). Rate from the hour's dose ratio:
 * ×1 → 0.5/s, ×42 → 4.7/s, ×1000 → 31/s, capped at 40/s. Formula = game rule; the ratio = measured.
 * Clicks are a Poisson process: random gaps, like a real Geiger counter.
 */
export function clickRate(ratio: number): number {
  return Math.min(40, 0.5 * Math.pow(Math.max(ratio, 0), 0.6));
}

/** Seconds until the next click for a given rate; `u` in (0, 1]. */
export function nextGap(rate: number, u: number = Math.random()): number {
  if (rate <= 0) return Infinity;
  return -Math.log(Math.max(u, 1e-9)) / rate;
}

export class Dosimeter {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private rate = 0;

  constructor(
    private ctx: AudioContext,
    private out: AudioNode,
  ) {}

  /** Set the current dose ratio (today's hour / normal). 0 stops the clicks. */
  setRatio(ratio: number) {
    this.rate = ratio > 0 ? clickRate(ratio) : 0;
    if (this.rate > 0 && !this.timer) this.schedule();
    if (this.rate === 0) this.stop();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule() {
    const gap = nextGap(this.rate);
    this.timer = setTimeout(() => {
      this.click();
      this.timer = null;
      if (this.rate > 0) this.schedule();
    }, gap * 1000);
  }

  private click() {
    const { ctx } = this;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 1800;
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.03);
  }
}

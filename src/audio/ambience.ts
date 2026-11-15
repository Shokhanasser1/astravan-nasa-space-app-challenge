/**
 * Sounds made in code (zero bytes, 15 Nov, Shoxjahon aka: "beautiful, correct sounds"):
 * - `suit`: breathing inside the helmet while the astronaut works outside — soft filtered noise, in ~1.6 s and out
 *   ~2.2 s, a quiet pause; a little faster when the hour's radiation is up (the storm makes you tense).
 * - `inside`: the habitat — a low mains hum and the ventilation fan (air moving through filters).
 * - chimes for the day's real events (DONKI): a soft rising pair at a flare peak, a falling triple when particles
 *   arrive. Never a siren, never a red flash (docs/DESIGN.md, Game Accessibility Guidelines).
 * Space itself is silent: nothing here pretends to be a sound outside the suit.
 */
export type AmbienceMode = 'off' | 'suit' | 'inside';

/** Which ambience a phase gets: the plan and the running day are outside, morning and night inside. */
export function ambienceFor(screen: string, phase: string): AmbienceMode {
  if (screen !== 'game') return 'off';
  if (phase === 'plan' || phase === 'run') return 'suit';
  if (phase === 'morning' || phase === 'night') return 'inside';
  return 'off';
}

/** Seconds of one breath (in + out + pause): 5.2 s calm, down to 3.6 s at a strong storm level. */
export function breathCycle(level: number): number {
  return Math.max(3.6, 5.2 - 0.4 * Math.max(0, Math.min(4, level)));
}

export class Ambience {
  private noise: AudioBuffer;
  private mode: AmbienceMode = 'off';
  private level = 0;
  private breathTimer: ReturnType<typeof setTimeout> | null = null;
  private hum: { stop: () => void } | null = null;

  constructor(
    private ctx: AudioContext,
    private out: AudioNode,
  ) {
    // two seconds of white noise, shared by the breath and the fan
    const n = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  setMode(mode: AmbienceMode, level = 0) {
    this.level = level;
    if (mode === this.mode) return;
    this.mode = mode;
    this.stopAll();
    if (mode === 'suit') this.breathe();
    if (mode === 'inside') this.hum = this.startHum();
  }

  setLevel(level: number) {
    this.level = level;
  }

  stopAll() {
    if (this.breathTimer) clearTimeout(this.breathTimer);
    this.breathTimer = null;
    this.hum?.stop();
    this.hum = null;
  }

  /** Resume after a hidden tab (the context was suspended; timers were stopped). */
  resume() {
    const m = this.mode;
    this.mode = 'off';
    this.setMode(m, this.level);
  }

  private breathe() {
    const { ctx } = this;
    const t = ctx.currentTime + 0.05;
    const cycle = breathCycle(this.level);
    const inS = cycle * 0.3;
    const outS = cycle * 0.42;
    this.puff(t, inS, 900, 1500, 0.05); // in: brighter, rising
    this.puff(t + inS + 0.15, outS, 650, 420, 0.06); // out: lower, falling
    this.breathTimer = setTimeout(() => this.mode === 'suit' && this.breathe(), cycle * 1000);
  }

  /** One breath: band-passed noise swelling and fading, its centre gliding from f0 to f1. */
  private puff(t: number, dur: number, f0: number, f1: number, peak: number) {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.linearRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + dur * 0.45);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.out);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private startHum(): { stop: () => void } {
    const { ctx } = this;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + 1.5);
    g.connect(this.out);
    const oscs = [55, 110].map((f, i) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.value = f;
      og.gain.value = i === 0 ? 0.018 : 0.008;
      o.connect(og).connect(g);
      o.start(t);
      return o;
    });
    const fan = ctx.createBufferSource();
    fan.buffer = this.noise;
    fan.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    const fg = ctx.createGain();
    fg.gain.value = 0.022;
    fan.connect(lp).connect(fg).connect(g);
    fan.start(t);
    return {
      stop: () => {
        const now = ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(0.0001, now + 0.8);
        for (const o of oscs) o.stop(now + 0.9);
        fan.stop(now + 0.9);
      },
    };
  }

  /** A soft chime for a real event of the day: 'flare' rises (two notes), 'particles' falls (three). */
  chime(kind: 'flare' | 'particles') {
    const { ctx } = this;
    const notes = kind === 'flare' ? [659, 988] : [880, 740, 587];
    notes.forEach((f, i) => {
      const t = ctx.currentTime + 0.05 + i * 0.22;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + 1);
    });
  }
}

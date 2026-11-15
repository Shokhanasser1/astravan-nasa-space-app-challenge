import { Dosimeter } from './dosimeter';

/**
 * One AudioContext for the whole game, created on the first tap (browsers block audio before it).
 * Generated sounds (dosimeter, Quindar tones) cost zero bytes. Recorded files: breath loop, Uzbek voice lines.
 * Every sound has a visual twin; the game is playable with sound off.
 */
class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  dosimeter: Dosimeter | null = null;
  private buffers = new Map<string, AudioBuffer>();
  /** The dose ratio the dosimeter should click at; kept until the first tap creates the AudioContext. */
  private doseRatio = 0;

  /** Call from a pointerdown/click handler. Safe to call many times. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.dosimeter = new Dosimeter(this.ctx, this.master);
      this.dosimeter.setRatio(this.doseRatio);
      // A hidden tab goes quiet (breath, clicks, voices) and picks up where it was when it comes back.
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) {
          this.dosimeter?.stop();
          void this.ctx.suspend();
        } else {
          void this.ctx.resume();
          this.dosimeter?.setRatio(this.doseRatio);
        }
      });
    }
    if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
  }

  /** Dosimeter clicks at this dose ratio (today / normal, measured); 0 = silent. Safe before the first tap. */
  setDose(ratio: number) {
    this.doseRatio = ratio;
    if (!document.hidden) this.dosimeter?.setRatio(ratio);
  }

  setMuted(muted: boolean) {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  /** NASA "Quindar" tones before and after a Houston line: 2525 Hz before, 2475 Hz after, 250 ms. */
  quindar(kind: 'start' | 'end') {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = kind === 'start' ? 2525 : 2475;
    g.gain.setValueAtTime(0.08, t);
    g.gain.setValueAtTime(0.08, t + 0.24);
    g.gain.linearRampToValueAtTime(0, t + 0.25);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.26);
  }

  /**
   * A short soft blip for the hands' work at the base (15 Nov): 'take' = a battery out of the hub (rising),
   * 'put' = batteries clicked into a machine (falling, then a click). Generated, zero bytes; the cells flash too.
   */
  click(kind: 'take' | 'put') {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    const [f0, f1] = kind === 'take' ? [520, 780] : [700, 440];
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'put' ? 0.16 : 0.12));
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.18);
  }

  /** Load a recorded file (OGG with M4A fallback for Safari) once. */
  async load(name: string, url: string) {
    if (!this.ctx || this.buffers.has(name)) return;
    const res = await fetch(url);
    this.buffers.set(name, await this.ctx.decodeAudioData(await res.arrayBuffer()));
  }

  play(name: string, { loop = false, gain = 1 } = {}) {
    const buf = this.buffers.get(name);
    if (!this.ctx || !this.master || !buf) return null;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    src.buffer = buf;
    src.loop = loop;
    g.gain.value = gain;
    src.connect(g).connect(this.master);
    src.start();
    return src;
  }

  /** English and Russian lines: the browser reads them. Uzbek lines are recorded by the team. */
  speak(text: string, lang: 'en' | 'ru') {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'en' ? 'en-US' : 'ru-RU';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
}

export const audio = new AudioEngine();

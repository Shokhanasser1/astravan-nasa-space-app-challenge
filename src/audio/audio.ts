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

  /** Call from a pointerdown/click handler. Safe to call many times. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.dosimeter = new Dosimeter(this.ctx, this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
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

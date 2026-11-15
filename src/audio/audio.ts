import { Ambience, type AmbienceMode } from './ambience';
import { Dosimeter } from './dosimeter';
import { Music, type Mood } from './music';
import { hasVoice, playVoice, stopVoice } from './voice';

/**
 * One AudioContext for the whole game, created on the first tap (browsers block audio before it).
 * Generated sounds (dosimeter, Quindar tones, suit breath, habitat hum, event chimes: ambience.ts) cost zero bytes.
 * Every sound has a visual twin; the game is playable with sound off.
 */
class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  dosimeter: Dosimeter | null = null;
  ambience: Ambience | null = null;
  music: Music | null = null;
  private mood: Mood = 'off';
  /** The ambience wanted, kept until the first tap creates the AudioContext. */
  private amb: { mode: AmbienceMode; level: number } = { mode: 'off', level: 0 };
  private buffers = new Map<string, AudioBuffer>();
  /** The dose ratio the dosimeter should click at; kept until the first tap creates the AudioContext. */
  private doseRatio = 0;

  /** Call from a pointerdown/click handler. Safe to call many times. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.dosimeter = new Dosimeter(this.ctx, this.master);
      this.dosimeter.setRatio(this.doseRatio);
      this.ambience = new Ambience(this.ctx, this.master);
      this.ambience.setMode(this.amb.mode, this.amb.level);
      this.music = new Music(this.ctx, this.master, import.meta.env.BASE_URL);
      this.music.setMood(this.mood);
      // A hidden tab goes quiet (breath, clicks, voices) and picks up where it was when it comes back.
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) {
          this.dosimeter?.stop();
          this.ambience?.stopAll();
          this.music?.stopAll();
          void this.ctx.suspend();
        } else {
          void this.ctx.resume();
          this.dosimeter?.setRatio(this.doseRatio);
          this.ambience?.resume();
          this.music?.resume();
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

  /** Breath outside, hum inside, nothing off the Moon (ambience.ts); level = the radiation level heard now. */
  setAmbience(mode: AmbienceMode, level = 0) {
    this.amb = { mode, level };
    if (!document.hidden) this.ambience?.setMode(mode, level);
  }

  /** The hour's radiation level while the day runs: the breath quickens with it. */
  setAmbienceLevel(level: number) {
    this.amb.level = level;
    this.ambience?.setLevel(level);
  }

  /** Background music for the moment (music.ts); loads after the first tap. */
  setMusic(mood: Mood) {
    this.mood = mood;
    if (!document.hidden) this.music?.setMood(mood);
  }

  /** A soft chime for a real event of the day (DONKI): a flare peak or the particles' arrival. */
  chime(kind: 'flare' | 'particles') {
    if (this.muted || document.hidden) return;
    this.ambience?.chime(kind);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
  }
  /** Kept so a mute chosen before the first tap still holds once the AudioContext exists (unlock). */
  private muted = false;

  /**
   * The press of a panel key (Flight Deck skin, src/ui/flight-deck.css): a dry mechanical tick, ~30 ms of filtered
   * noise over a low thump, very quiet. Generated, zero bytes; the key's travel is its visual twin.
   */
  key() {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * 0.03);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 3200;
    hp.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.value = 0.16;
    src.connect(hp).connect(g).connect(this.master);
    src.start(t);
    const o = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.04);
    og.gain.setValueAtTime(0.06, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.06);
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
  /** True when a recorded voice (Gemini TTS, src/audio/voice.ts) speaks this line as it reads now. */
  hasVoice(key: string, text: string, lang: string): Promise<boolean> {
    return hasVoice(import.meta.env.BASE_URL, lang, key, text);
  }

  /** Play the recorded voice of a line through the radio band; resolves false when there is none. */
  async say(key: string, text: string, lang: string): Promise<boolean> {
    if (!this.ctx || !this.master || this.muted) return false;
    return playVoice(this.ctx, this.master, import.meta.env.BASE_URL, lang, key, text);
  }

  stopVoice() {
    stopVoice();
  }

  speak(text: string, lang: 'en' | 'ru') {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'en' ? 'en-US' : 'ru-RU';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
}

export const audio = new AudioEngine();

/**
 * Background music (15 Nov): three AI-made instrumental loops — ElevenLabs Music v2.5 through Higgsfield, prompts in
 * docs/AI-USE.md — in public/audio/music/<mood>.mp3 (60 s, 2 s fade-in, 4 s fade-out, loudness-matched). They load
 * only after the first tap (not in the first download, not precached). Each loop is restarted 4 s before its end so
 * the fades overlap into a seamless loop; a new mood cross-fades in 2.5 s. Quiet under the dosimeter and the radio.
 */
export type Mood = 'off' | 'calm' | 'storm' | 'finale';

/**
 * Which music a moment gets. Storm music while the hour being played is stormy, and on the planning morning and the
 * night of a flare-alert or storm day; the launch and the truth screen get the finale; the title desk is calm.
 */
export function musicFor(screen: string, phase: string, dayLevel: number, alert: boolean, runLevel: number | null): Mood {
  if (screen === 'end') return 'finale';
  if (screen !== 'game') return 'calm';
  if (phase === 'launch' || phase === 'truth') return 'finale';
  if (phase === 'run') return (runLevel ?? dayLevel) >= 1 ? 'storm' : 'calm';
  return alert || dayLevel >= 2 ? 'storm' : 'calm';
}

const VOLUME = 0.32;
const OVERLAP = 4; // s: the fade-out of one loop under the fade-in of the next
const XFADE = 2.5;

type Playing = { gain: GainNode; timer: ReturnType<typeof setTimeout> | null; srcs: AudioBufferSourceNode[] };

export class Music {
  private buffers = new Map<Mood, AudioBuffer>();
  private loading = new Map<Mood, Promise<AudioBuffer | null>>();
  private mood: Mood = 'off';
  private now: Playing | null = null;

  constructor(
    private ctx: AudioContext,
    private out: AudioNode,
    private base: string,
  ) {}

  setMood(mood: Mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    this.fadeOut();
    if (mood === 'off') return;
    void this.load(mood).then((buf) => {
      if (buf && this.mood === mood && !this.now) this.start(buf);
    });
  }

  /** Stop at once (hidden tab); `resume` starts the current mood again. */
  stopAll() {
    this.fadeOut(0.05);
  }

  resume() {
    const m = this.mood;
    this.mood = 'off';
    this.setMood(m);
  }

  private load(mood: Mood): Promise<AudioBuffer | null> {
    const have = this.buffers.get(mood);
    if (have) return Promise.resolve(have);
    let p = this.loading.get(mood);
    if (!p) {
      p = fetch(`${this.base}audio/music/${mood}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`music ${r.status}`))))
        .then((a) => this.ctx.decodeAudioData(a))
        .then((b) => {
          this.buffers.set(mood, b);
          return b;
        })
        .catch(() => null); // no music is fine: every sound has a visual twin
      this.loading.set(mood, p);
    }
    return p;
  }

  private start(buf: AudioBuffer) {
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(VOLUME, t + XFADE);
    gain.connect(this.out);
    const playing: Playing = { gain, timer: null, srcs: [] };
    const loop = (at: number) => {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(gain);
      src.start(at);
      playing.srcs = [...playing.srcs.slice(-1), src];
      const next = at + Math.max(1, buf.duration - OVERLAP);
      playing.timer = setTimeout(() => loop(next), Math.max(0, (next - this.ctx.currentTime - 1) * 1000));
    };
    loop(t + 0.05);
    this.now = playing;
  }

  private fadeOut(seconds = XFADE) {
    const p = this.now;
    if (!p) return;
    this.now = null;
    if (p.timer) clearTimeout(p.timer);
    const t = this.ctx.currentTime;
    p.gain.gain.cancelScheduledValues(t);
    p.gain.gain.setValueAtTime(p.gain.gain.value, t);
    p.gain.gain.linearRampToValueAtTime(0.0001, t + seconds);
    for (const s of p.srcs) s.stop(t + seconds + 0.05);
  }
}

import { fingerprint, voiceFile } from './voiceLines';

/**
 * Plays a recorded radio line (public/audio/voice/<lang>/<key>.mp3, made by scripts/audio/gemini-voices.mts) through
 * a radio band (300 Hz – 3.4 kHz, as Apollo's voice loop sounded). Only when the manifest says the file speaks the
 * line's current text; otherwise the caller falls back to the device's voice. Files load on first use, not precached.
 */
type Manifest = Record<string, Record<string, string>>;
let manifest: Promise<Manifest> | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let current: AudioBufferSourceNode | null = null;

function loadManifest(base: string): Promise<Manifest> {
  manifest ??= fetch(`${base}audio/voice/manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : {}))
    .catch(() => ({}));
  return manifest;
}

/**
 * The file that speaks this line as it reads now: the home story's version (`<key>.hs`, src/i18n/t.ts) or the plain
 * one — whichever was recorded for exactly this text. Null when neither matches.
 */
async function voicedKey(base: string, lang: string, key: string, text: string): Promise<string | null> {
  const m = (await loadManifest(base))[lang];
  const fp = fingerprint(text);
  if (m?.[`${key}.hs`] === fp) return `${key}.hs`;
  if (m?.[key] === fp) return key;
  return null;
}

/** True when a recorded voice exists for this line as it reads now. */
export async function hasVoice(base: string, lang: string, key: string, text: string): Promise<boolean> {
  return (await voicedKey(base, lang, key, text)) !== null;
}

/** Play the recorded line; resolves when it has finished (false if there is none or it failed to load). */
export async function playVoice(ctx: AudioContext, out: AudioNode, base: string, lang: string, key: string, text: string): Promise<boolean> {
  const file = await voicedKey(base, lang, key, text);
  if (!file) return false;
  const url = `${base}${voiceFile(lang, file)}`;
  let p = buffers.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((a) => ctx.decodeAudioData(a))
      .catch(() => null);
    buffers.set(url, p);
  }
  const buf = await p;
  if (!buf) return false;
  stopVoice();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 300;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3400;
  const g = ctx.createGain();
  g.gain.value = 1.1;
  src.connect(hp).connect(lp).connect(g).connect(out);
  current = src;
  return new Promise((resolve) => {
    src.onended = () => {
      if (current === src) current = null;
      resolve(true);
    };
    src.start();
  });
}

export function stopVoice() {
  try {
    current?.stop();
  } catch {
    // already stopped
  }
  current = null;
}

// Radio voices for HOME BY SEVEN, generated with Gemini TTS (AI-made audio, disclosed in docs/AI-USE.md, CREDITS.md
// and each file's metadata). Reads the voiced lines (src/audio/voiceLines.ts) from src/i18n/<lang>/{story,ui}.json,
// one voice per speaker, writes public/audio/voice/<lang>/<key>.mp3 (mono 48 kbps, loudness-matched, silence
// trimmed) and public/audio/voice/manifest.json (key → fingerprint of the text it speaks). Lines already made for
// the same text are skipped, so after an edit only the changed lines are made again.
// Usage: node scripts/audio/gemini-voices.mts <file with the API key> [--langs=en,ru] [--only=key,key] [--dry]
// The key is read from that file (kept outside the repo) and is never printed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fingerprint, isVoiced, speakerOf, type Speaker } from '../../src/audio/voiceLines.ts';

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const keyFile = args.find((a) => !a.startsWith('--'));
if (!keyFile) throw new Error('usage: node scripts/audio/gemini-voices.mts <key file> [--langs=en,ru] [--only=k,k] [--dry]');
const apiKey = readFileSync(keyFile, 'utf8').trim();
const langs = (opt('langs') ?? 'en,ru').split(',');
const only = opt('only')?.split(',');
const dry = args.includes('--dry');
const MODEL = 'gemini-3.8-flash-tts';

// One voice per character (Gemini prebuilt voices) and how they speak (.claude/rules/hud-text.md "Voices").
const VOICE: Record<Speaker, { voice: string; style: string }> = {
  houston: { voice: 'Charon', style: 'Say it like a calm, kind mission-control radio voice talking to a child astronaut, clear and unhurried' },
  pilot: { voice: 'Puck', style: 'Say it like an upbeat, energetic young pilot on the radio, short and friendly' },
  scout: { voice: 'Leda', style: 'Say it like a curious, cheerful young scientist on the radio, a little excited' },
  family: { voice: 'Sulafat', style: 'Say it like a warm, loving grandmother calling from home, gentle and smiling' },
};

const OUT = join('public', 'audio', 'voice');
const MANIFEST = join(OUT, 'manifest.json');
const manifest: Record<string, Record<string, string>> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const save = () => writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const LANGUAGE: Record<string, string> = { en: 'English', ru: 'Russian', uz: 'Uzbek' };

async function tts(words: string, speaker: Speaker, lang: string): Promise<Buffer> {
  const { voice, style } = VOICE[speaker];
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${style}, in ${LANGUAGE[lang] ?? 'English'}: ${words}` }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      }),
    });
    const body = (await res.json()) as {
      error?: { message?: string; details?: { retryDelay?: string }[] };
      candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[];
    };
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(body.error?.details?.find((d) => d.retryDelay)?.retryDelay?.replace('s', '')) || 20 * (attempt + 1);
      console.log(`  ${res.status}, waiting ${wait} s`);
      await sleep(wait * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${body.error?.message ?? ''}`);
    const data = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
    if (!data) throw new Error('no audio in the answer');
    return Buffer.from(data, 'base64');
  }
  throw new Error('gave up after repeated rate limits');
}

let made = 0;
for (const lang of langs) {
  const lines: Record<string, string> = {};
  for (const file of ['story', 'ui']) {
    const p = join('src', 'i18n', lang, `${file}.json`);
    if (existsSync(p)) Object.assign(lines, JSON.parse(readFileSync(p, 'utf8')));
  }
  const dir = join(OUT, lang);
  mkdirSync(dir, { recursive: true });
  manifest[lang] ??= {};
  for (const [key, text] of Object.entries(lines)) {
    if (!isVoiced(key) || !text || (only && !only.includes(key))) continue;
    const fp = fingerprint(text);
    const dst = join(dir, `${key.toLowerCase()}.mp3`);
    if (manifest[lang][key] === fp && existsSync(dst)) continue;
    const { speaker, words } = speakerOf(text);
    console.log(`${lang} ${key} [${speaker}] ${words}`);
    if (dry) continue;
    const wav = join(tmpdir(), `hb7-voice-${lang}-${key}.wav`);
    writeFileSync(wav, await tts(words, speaker, lang));
    execFileSync('ffmpeg', [
      '-y', '-v', 'error', '-i', wav,
      '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=1:stop_threshold=-45dB:stop_duration=0.3,loudnorm=I=-18:TP=-2',
      '-ac', '1', '-ar', '24000', '-b:a', '48k',
      '-metadata', `comment=AI-generated voice (Gemini TTS ${MODEL}), HOME BY SEVEN, 15 Nov 2026`,
      dst,
    ]);
    rmSync(wav);
    manifest[lang][key] = fp;
    save();
    made++;
    await sleep(2500); // stay under the free tier's per-minute limit
  }
}
save();
console.log(`made ${made} line(s)`);

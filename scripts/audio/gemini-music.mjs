// Music for HOME BY SEVEN, generated with Google Lyria 3.5 through the Gemini API (AI-made audio, disclosed in
// docs/AI-USE.md and CREDITS.md). Writes public/audio/music-<mood>.mp3 (re-encoded by ffmpeg: 96 kbps, loudness
// normalised, faded in and out so the game can cross-fade them into a loop).
// Usage: node scripts/audio/gemini-music.mjs <file with the API key> [mood ...]
// The key is read from that file (kept outside the repo) and is never printed.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// --model=<id> picks the Lyria model (default lyria-3.5; a free key may only have quota for the previews).
const args = process.argv.slice(2);
const model = (args.find((a) => a.startsWith('--model=')) ?? '--model=lyria-3.5').slice(8);
const [keyFile, ...wanted] = args.filter((a) => !a.startsWith('--'));
if (!keyFile) throw new Error('usage: node scripts/audio/gemini-music.mjs <key file> [--model=id] [mood ...]');
const key = readFileSync(keyFile, 'utf8').trim();

const COMMON =
  'Instrumental only, no vocals, no lyrics, no spoken words. For a children\'s space game (ages 7-12): ' +
  'warm and clear, never scary or harsh, no sudden loud hits. Steady level from start to end, so it can loop ' +
  'quietly under game sounds. About 60 seconds.';
const MOODS = {
  calm:
    'A calm, hopeful ambient piece for a small base on the Moon: soft analog synth pads, slow felt piano notes, ' +
    'a gentle low drone, sparse glassy bell tones like distant stars, 70 BPM, D major. ' + COMMON,
  storm:
    'A tense but not frightening ambient piece for an invisible solar radiation storm reaching the Moon: low ' +
    'pulsing synth bass at 90 BPM, soft ticking rhythm, slowly rising shimmering pads, a feeling of "stay inside ' +
    'and stay safe", D minor. ' + COMMON,
  finale:
    'An uplifting, wonder-filled finale for flying home from the Moon and learning the week was real: soft ' +
    'strings and synth pads swelling slowly, gentle piano melody, a calm triumphant feeling, 80 BPM, D major. ' +
    COMMON,
};

const out = join('public', 'audio');
mkdirSync(out, { recursive: true });
for (const mood of wanted.length ? wanted : Object.keys(MOODS)) {
  const prompt = MOODS[mood];
  if (!prompt) throw new Error(`unknown mood ${mood}`);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['AUDIO', 'TEXT'] },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${mood}: HTTP ${res.status} ${body.error?.message ?? ''}`);
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const audio = parts.find((p) => p.inlineData?.data);
  if (!audio) throw new Error(`${mood}: no audio in the answer`);
  const raw = join(tmpdir(), `hb7-${mood}-raw.mp3`);
  writeFileSync(raw, Buffer.from(audio.inlineData.data, 'base64'));
  const dst = join(out, `music-${mood}.mp3`);
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', raw]).toString());
  const fadeOut = Math.max(0, dur - 3);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-af', `loudnorm=I=-20:TP=-2,afade=t=in:d=2,afade=t=out:st=${fadeOut}:d=3`, '-ac', '2', '-b:a', '96k', dst]);
  rmSync(raw);
  console.log(`${dst}  ${dur.toFixed(1)} s`);
}

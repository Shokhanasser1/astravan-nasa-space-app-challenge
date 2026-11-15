// Lines still to voice: every voiced line (src/audio/voiceLines.ts) whose current text has no recorded file in
// public/audio/voice/manifest.json — e.g. the home story's `.hs` lines after a text edit. Writes into <out folder>:
//   voice-todo.json        [{ i, lang, key, fp, speaker, words }]  (input for scripts/audio/import-voices.mts)
//   voice-batch-<n>.json   6 requests each for Higgsfield `generate_audio_batch` (ElevenLabs v4, one adult preset
//                          voice per speaker; 6 at a time stays under ElevenLabs' rate limit)
// Then collect "<i> <result_url>" lines into links.txt and run:
//   node scripts/audio/import-voices.mts <out>/voice-todo.json <out>/links.txt
// Usage (from the repo root): node scripts/audio/voice-batches.mts <out folder outside the repo>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fingerprint, isVoiced, speakerOf } from '../../src/audio/voiceLines.ts';

const out = process.argv[2];
if (!out) throw new Error('usage: node scripts/audio/voice-batches.mts <out folder>');
mkdirSync(out, { recursive: true });

// Higgsfield preset voices (adults): Houston = Holden, Pilot = Benji, Scout = Juno, family = Helena.
const VOICE: Record<string, string> = {
  houston: '3c9d6053-6334-592c-8997-4e325286af3f',
  pilot: 'e6f9b893-51b1-51d3-afe9-9e0482cb7ac1',
  scout: 'a3ce02fe-4d3e-55bc-b4d4-a4801b9acdb4',
  family: '3c2b83c0-2e0a-5ae8-998a-a5fe71b7eccd',
};
const manifest: Record<string, Record<string, string>> = JSON.parse(readFileSync('public/audio/voice/manifest.json', 'utf8'));
const lines: { i: number; lang: string; key: string; fp: string; speaker: string; words: string }[] = [];
for (const lang of ['en', 'ru', 'uz']) {
  const all: Record<string, string> = {
    ...JSON.parse(readFileSync(join('src', 'i18n', lang, 'story.json'), 'utf8')),
    ...JSON.parse(readFileSync(join('src', 'i18n', lang, 'ui.json'), 'utf8')),
  };
  for (const [key, text] of Object.entries(all)) {
    const base = key.endsWith('.hs') ? key.slice(0, -3) : key;
    if (!isVoiced(base) || !text || manifest[lang]?.[key] === fingerprint(text)) continue;
    const { speaker, words } = speakerOf(text);
    lines.push({ i: 1000 + lines.length, lang, key, fp: fingerprint(text), speaker, words });
  }
}
writeFileSync(join(out, 'voice-todo.json'), JSON.stringify(lines));
const reqs = lines.map((l) => ({
  index: l.i,
  params: { model: 'elevenlabs_v4', prompt: `${l.lang} ${l.key}`, use_unlim: false, dialogue: [{ text: l.words, voice_type: 'preset', voice_id: VOICE[l.speaker] }] },
}));
for (let b = 0; b * 6 < reqs.length; b++) writeFileSync(join(out, `voice-batch-${b}.json`), JSON.stringify(reqs.slice(b * 6, b * 6 + 6)));
console.log(`${lines.length} line(s) to voice, ${Math.ceil(reqs.length / 6)} batch(es) in ${out}`);

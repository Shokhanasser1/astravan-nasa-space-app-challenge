// Import radio voices generated outside the repo (15 Nov: ElevenLabs v4 through Higgsfield, one adult voice per
// character) into public/audio/voice/<lang>/<key>.mp3 + manifest.json, the same format scripts/audio/gemini-voices.mts
// writes: mono 48 kbps, silence trimmed, loudness-matched, "AI-generated" in the file's metadata.
// Usage: node scripts/audio/import-voices.mts <lines.json> <links.txt>
//   lines.json: [{ i, lang, key, fp }]  (fp = fingerprint of the text the voice speaks, src/audio/voiceLines.ts)
//   links.txt:  "<i> <url>" per line (the generated MP3 of line i)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const [linesFile, linksFile] = process.argv.slice(2);
if (!linesFile || !linksFile) throw new Error('usage: node scripts/audio/import-voices.mts <lines.json> <links.txt>');
const lines = JSON.parse(readFileSync(linesFile, 'utf8')) as { i: number; lang: string; key: string; fp: string }[];
const links = new Map(readFileSync(linksFile, 'utf8').trim().split('\n').map((l) => {
  const [i, url] = l.trim().split(/\s+/);
  return [Number(i), url] as const;
}));
const OUT = join('public', 'audio', 'voice');
const MANIFEST = join(OUT, 'manifest.json');
const manifest: Record<string, Record<string, string>> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const tmp = mkdtempSync(join(tmpdir(), 'hb7-voices-'));
let n = 0;
for (const l of lines) {
  const url = links.get(l.i);
  if (!url || !url.startsWith('https://')) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${l.lang} ${l.key}: HTTP ${res.status}`);
  const raw = join(tmp, `${l.i}.mp3`);
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  mkdirSync(join(OUT, l.lang), { recursive: true });
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-i', raw,
    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=1:stop_threshold=-45dB:stop_duration=0.3,loudnorm=I=-18:TP=-2',
    '-ac', '1', '-ar', '24000', '-b:a', '48k',
    '-metadata', 'comment=AI-generated voice (ElevenLabs v4 through Higgsfield), HOME BY SEVEN, 15 Nov 2026',
    join(OUT, l.lang, `${l.key.toLowerCase()}.mp3`),
  ]);
  (manifest[l.lang] ??= {})[l.key] = l.fp;
  n++;
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
rmSync(tmp, { recursive: true, force: true });
console.log(`imported ${n} voice line(s)`);

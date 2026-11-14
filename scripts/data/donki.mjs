// DONKI (NASA space weather database) for game weeks. BUILD TIME ONLY: the game never calls NASA.
//   node scripts/data/donki.mjs 2021-10-25 2014-10-20 …     one argument per week (its first day, YYYY-MM-DD)
//   node scripts/data/donki.mjs --weeks                      all week ids from src/engine/weeks.json
// Route: CCMC DONKI API (no key needed). Checked 2026-11-14: the api.nasa.gov/DONKI proxy returns 404 (it forwards to
// /DONKI-API/get/FLR/ with a trailing slash) while ccmc.gsfc.nasa.gov answers. DONKI_VIA=apinasa retries the proxy with
// NASA_API_KEY (environment or scripts/data/.env, git-ignored; never commit or print it). Output: scripts/data/raw/donki/<week>.json (git-ignored)
// plus a day-by-day summary to compare with weeks.json (flare peaks and classes, particle events, alerts).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const envFile = join(root, 'scripts/data/.env');
if (!process.env.NASA_API_KEY && existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*NASA_API_KEY\s*=\s*(\S+)\s*$/);
    if (m) process.env.NASA_API_KEY = m[1];
  }
}
const KEY = process.env.NASA_API_KEY;
const viaProxy = Boolean(process.env.DONKI_VIA === 'apinasa' && KEY);
const base = viaProxy ? 'https://api.nasa.gov/DONKI' : 'https://ccmc.gsfc.nasa.gov/DONKI-API/get';

let weeks = process.argv.slice(2);
if (weeks[0] === '--weeks') {
  const file = JSON.parse(readFileSync(join(root, 'src/engine/weeks.json'), 'utf8'));
  weeks = (Array.isArray(file) ? file : file.weeks).map((w) => w.id);
}
if (!weeks.length || weeks.some((w) => !/^\d{4}-\d{2}-\d{2}$/.test(w))) {
  console.error('usage: node scripts/data/donki.mjs YYYY-MM-DD [YYYY-MM-DD …] | --weeks');
  process.exit(2);
}

const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const redact = (u) => u.replace(/api_key=[^&]+/, 'api_key=***');

async function get(type, start, end, extra = '') {
  const url = `${base}/${type}?startDate=${start}&endDate=${end}${extra}${viaProxy ? `&api_key=${KEY}` : ''}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`${type}: HTTP ${res.status} ${redact(url)}`);
    const text = await res.text();
    const left = res.headers.get('x-ratelimit-remaining');
    return { data: text.trim() ? JSON.parse(text) : [], url: redact(url), left };
  }
  throw new Error(`${type}: still rate-limited ${redact(url)}`);
}

const hhmm = (iso) => (iso ? iso.slice(11, 16) : '—');
const day = (iso) => (iso ? iso.slice(0, 10) : '');

mkdirSync(join(root, 'scripts/data/raw/donki'), { recursive: true });
console.log(`DONKI via ${viaProxy ? 'api.nasa.gov proxy (team key)' : 'CCMC DONKI API (no key needed)'}\n`);

try {
for (const week of weeks) {
  const end = addDays(week, 6);
  const [flr, sep, cme, notes] = [
    await get('FLR', week, end),
    await get('SEP', week, end),
    await get('CME', week, end),
    await get('notifications', week, end, '&type=all'),
  ];
  const out = {
    week,
    endDate: end,
    downloaded: new Date().toISOString().slice(0, 10),
    sources: [flr.url, sep.url, cme.url, notes.url],
    flares: flr.data.map((f) => ({ peak_utc: f.peakTime, cls: f.classType, begin: f.beginTime, region: f.activeRegionNum ?? null })),
    particles: sep.data.map((s) => ({ first_seen_utc: s.eventTime, instruments: (s.instruments ?? []).map((i) => i.displayName) })),
    cmes: cme.data.length,
    notifications: notes.data.map((n) => ({ type: n.messageType, issued: n.messageIssueTime, id: n.messageID })),
  };
  writeFileSync(join(root, `scripts/data/raw/donki/${week}.json`), JSON.stringify(out, null, 2));

  console.log(`Week ${week} → ${end}   flares ${out.flares.length} · particle events ${out.particles.length} · CMEs ${out.cmes} · notifications ${out.notifications.length}`);
  for (let i = 0; i < 7; i++) {
    const d = addDays(week, i);
    const fl = out.flares.filter((f) => day(f.peak_utc) === d);
    const big = fl.filter((f) => /^[MX]/.test(f.cls ?? ''));
    const sp = out.particles.filter((p) => day(p.first_seen_utc) === d);
    const parts = [
      big.length ? `M/X flares: ${big.map((f) => `${f.cls} @${hhmm(f.peak_utc)}`).join(', ')}` : fl.length ? `${fl.length} C/B flares` : '',
      sp.length ? `particles: ${sp.map((p) => `@${hhmm(p.first_seen_utc)}`).join(', ')}` : '',
    ].filter(Boolean);
    console.log(`  day ${i + 1}  ${d}  ${parts.join(' · ') || 'quiet'}`);
  }
  if (flr.left) console.log(`  (requests left this hour: ${flr.left})`);
  console.log('');
}
} catch (e) {
  console.error(String(e?.message ?? e));
  process.exitCode = 1;
}

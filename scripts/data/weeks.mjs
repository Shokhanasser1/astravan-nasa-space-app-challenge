// Builds src/engine/weeks.json from two NASA records. BUILD TIME ONLY: the game never calls NASA.
//   node scripts/data/weeks.mjs            all 14 weeks of concept v2 §07
//   node scripts/data/weeks.mjs 2021-10-25  only listed weeks (merged into the existing file)
// Radiation: LRO CRaTER (D1D2 pair) absorbed dose rate, hourly, from the NASA OSDR RadLab data API.
// Events: DONKI (FLR, SEP, CME) via the CCMC DONKI API, no key needed (the api.nasa.gov proxy returns 404).
// Method (docs/rules.md, concept v2 §07):
//   normal  = calm value of the 27 days before the week = 25th percentile of those hourly readings
//             (robust to the storm days inside the window; reproduces the concept's 9.2 / 42 / 25 / 8.5 for 2021-10-25)
//   ratio   = day mean / normal → level 0 <2, 1 2–10, 2 10–100, 3 100–1000, 4 >1000
//   alert   = an X-class flare that day, or the week's first particle event (DONKI SEP)
//   watch   = before the first storm day: a front-side CME ≥ 600 km/s or an M5+ flare
// Raw downloads stay in scripts/data/raw/ (git-ignored). Every request URL is recorded in the output.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const OUT = join(root, 'src/engine/weeks.json');
const RAW = join(root, 'scripts/data/raw');

// Concept v2 §07: the fourteen weeks and the kind the team chose them for.
const CONCEPT = [
  ['2018-08-06', 'quiet'], ['2020-06-01', 'quiet'],
  ['2014-10-20', 'false alarm'], ['2024-02-20', 'false alarm'],
  ['2023-12-12', 'storm'], ['2021-10-25', 'storm'],
  ['2012-05-14', 'severe'], ['2024-03-20', 'severe'], ['2012-01-20', 'severe'],
  ['2014-01-04', 'severe'], ['2012-03-04', 'severe'], ['2013-05-19', 'severe'],
  ['2017-09-06', 'hard mode'], ['2024-05-08', 'hard mode'],
];

const RADLAB = 'https://visualization.osdr.nasa.gov/radlab/api/';
const DONKI = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get';
const HOUR = 3600e3;
const DAY = 864e5;

const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const round = (x, n) => Math.round(x * 10 ** n) / 10 ** n;
const hhmm = (iso) => iso.slice(11, 16);

async function get(url, kind) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return text.trim() ? JSON.parse(text) : kind === 'radlab' ? { data: [] } : [];
    } catch (e) {
      if (attempt === 3) throw new Error(`${kind}: ${e.message} for ${url}`);
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
}

function percentile(values, p) {
  const s = [...values].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
}

function level(ratio) {
  if (ratio < 2) return 0;
  if (ratio < 10) return 1;
  if (ratio < 100) return 2;
  if (ratio < 1000) return 3;
  return 4;
}

// CRaTER rows are stamped at the END of their hour (…T15:59:58 covers 15:00–16:00): bucket = nearest hour − 1 h.
function hourBuckets(rows) {
  const buckets = new Map();
  for (const [stamp, , value] of rows) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const t = Date.parse(`${stamp}Z`);
    const start = new Date(Math.round(t / HOUR) * HOUR - HOUR).toISOString();
    buckets.set(start.slice(0, 13), value);
  }
  return buckets; // 'YYYY-MM-DDTHH' → µGy/h
}

async function crater(week) {
  const from = addDays(week, -27);
  const to = addDays(week, 7);
  const url = `${RADLAB}?instrument=CRaTER&timestamp%3E=${from}&timestamp%3C${to}T01&absorbed_dose_rate%3E=0&format=json`;
  const raw = await get(url, 'radlab');
  writeFileSync(join(RAW, 'crater', `${week}.json`), JSON.stringify(raw));
  return { url, hours: hourBuckets(raw.data ?? []) };
}

async function donki(week) {
  const end = addDays(week, 6);
  const urls = {
    flr: `${DONKI}/FLR?startDate=${week}&endDate=${end}`,
    sep: `${DONKI}/SEP?startDate=${week}&endDate=${end}`,
    cme: `${DONKI}/CME?startDate=${week}&endDate=${end}`,
  };
  const [flr, sep, cme] = [await get(urls.flr, 'donki'), await get(urls.sep, 'donki'), await get(urls.cme, 'donki')];
  writeFileSync(join(RAW, 'donki', `${week}-events.json`), JSON.stringify({ flr, sep, cme }, null, 1));
  // Far-side eruptions (|longitude| > 90°) cannot be a warning for the Moon: skip them.
  const cmeSpeed = (c) =>
    Math.max(0, ...(c.cmeAnalyses ?? []).filter((a) => a.isMostAccurate && Math.abs(a.longitude ?? 999) <= 90).map((a) => a.speed ?? 0));
  return {
    urls: Object.values(urls),
    flares: flr.filter((f) => /^[MX]/.test(f.classType ?? '') && f.peakTime).map((f) => ({ t: f.peakTime, cls: f.classType })),
    particles: sep.filter((s) => s.eventTime).map((s) => ({ t: s.eventTime })).sort((a, b) => a.t.localeCompare(b.t)),
    fastCmes: cme.filter((c) => c.startTime && cmeSpeed(c) >= 600).map((c) => ({ t: c.startTime, speed: cmeSpeed(c) })),
  };
}

function strongFlare(cls, min) {
  const m = /^([MX])(\d+(?:\.\d+)?)/.exec(cls);
  if (!m) return false;
  const size = (m[1] === 'X' ? 10 : 1) * Number(m[2]);
  return size >= min;
}

function buildWeek(week, kindFromConcept, rad, ev) {
  const before = [...rad.hours].filter(([k]) => k.slice(0, 10) < week).map(([, v]) => v);
  if (before.length < 24 * 20) throw new Error(`${week}: only ${before.length} calm-window hours`);
  const normal = percentile(before, 0.25);
  const firstParticleDay = ev.particles[0]?.t.slice(0, 10);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(week, i);
    const hourly = Array.from({ length: 24 }, (_, h) => rad.hours.get(`${date}T${String(h).padStart(2, '0')}`) ?? null);
    const got = hourly.filter((v) => v !== null);
    if (!got.length) throw new Error(`${week}: no CRaTER readings on ${date}`);
    const mean = got.reduce((s, v) => s + v, 0) / got.length;
    const ratio = mean / normal;
    const flares = ev.flares.filter((f) => f.t.startsWith(date));
    const particles = ev.particles.filter((p) => p.t.startsWith(date));
    days.push({
      day: i + 1,
      date,
      mean_uGy_h: round(mean, 1),
      max_uGy_h: round(Math.max(...got), 1),
      hours: got.length,
      ratio: round(ratio, 2),
      level: level(ratio),
      alert: flares.some((f) => f.cls.startsWith('X')) || firstParticleDay === date,
      watch: false,
      r_label: 'measured',
      flares: flares.map((f) => ({ peak_utc: hhmm(f.t), cls: f.cls, source: 'DONKI FLR' })),
      particles: particles.slice(0, 1).map((p) => ({ first_seen_utc: hhmm(p.t), channel: 'SEP', source: 'DONKI SEP' })),
      hourly: hourly.map((v) => (v === null ? null : round(v / normal, 2))),
    });
  }
  const firstStorm = days.find((d) => d.alert || d.level > 0)?.day ?? 8;
  for (const d of days) {
    if (d.day >= firstStorm) break;
    const fastCme = ev.fastCmes.some((c) => c.t.startsWith(d.date));
    const bigFlare = d.flares.some((f) => strongFlare(f.cls, 5));
    d.watch = fastCme || bigFlare;
  }

  const peak = Math.max(...days.map((d) => d.level));
  const alerts = days.some((d) => d.alert);
  const computed = peak >= 3 ? 'severe' : peak >= 1 ? 'storm' : alerts ? 'false alarm' : 'quiet';
  const kind = kindFromConcept === 'hard mode' ? 'hard mode' : computed;
  if (kindFromConcept !== 'hard mode' && computed !== kindFromConcept) {
    console.warn(`warn  ${week}: data says "${computed}", concept says "${kindFromConcept}" — keeping the data`);
  }
  return { id: week, kind, normal_uGy_h: round(normal, 2), peak_level: peak, days };
}

async function main() {
  mkdirSync(join(RAW, 'crater'), { recursive: true });
  mkdirSync(join(RAW, 'donki'), { recursive: true });
  const asked = process.argv.slice(2);
  const list = asked.length ? CONCEPT.filter(([id]) => asked.includes(id)) : CONCEPT;
  if (!list.length) throw new Error(`unknown week(s): ${asked.join(', ')}`);

  const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { weeks: [], sources: {} };
  const weeks = new Map(old.weeks.map((w) => [w.id, w]));
  const sources = { ...old.sources };
  for (const [id, kind] of list) {
    const rad = await crater(id);
    const ev = await donki(id);
    const w = buildWeek(id, kind, rad, ev);
    weeks.set(id, w);
    sources[id] = [rad.url, ...ev.urls];
    const row = w.days.map((d) => `${d.ratio}${d.alert ? '!' : ''}${d.watch ? 'w' : ''}`).join(' ');
    console.log(`${id}  ${w.kind.padEnd(11)} normal ${w.normal_uGy_h}  levels ${w.days.map((d) => d.level).join('')}  ratios ${row}`);
  }
  const order = CONCEPT.map(([id]) => id);
  const out = {
    about:
      'Real weeks for HOME BY SEVEN. Radiation: LRO CRaTER D1D2 absorbed dose rate (µGy/h, hourly), NASA OSDR RadLab. ' +
      'Events: DONKI (CCMC). Built by scripts/data/weeks.mjs. ratio = day mean / normal (25th percentile of the 27 days before). ' +
      'Measured near the Moon behind thin shielding; an archive, not a live feed.',
    downloaded: new Date().toISOString().slice(0, 10),
    sources,
    weeks: [...weeks.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
  };
  writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`wrote ${OUT.replace(root, '')}: ${out.weeks.length} weeks`);
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exitCode = 1;
});

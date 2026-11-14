// Project checks that unit tests do not cover. Run: npm run check (part of npm run verify and CI).
// 1. Strings: Uzbek oʻ/gʻ use U+02BB and tutuq belgisi U+02BC; no Cyrillic in uz.json; no Latin-only ru.json lines
//    are flagged as warnings; keys in uz/ru exist in en.
// 2. Forbidden phrases in any language (concept 3.0, section 07 + NASA media guidelines).
// 3. Data files src/engine/weeks.json and sky.json have the expected shape when present.
// 4. Asset folders: lowercase names (GitHub Pages and Linux are case-sensitive), one folder per pack with a licence
//    or credit file and a CREDITS row, models ≤ 1 MB each (< 5 MB together is a warning).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const errors = [];
const warnings = [];
const json = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

// 1. Strings
// One file per language and lane (src/i18n/<lang>/<lane>.json). Keys must start with the lane's prefix,
// and a key may live in only one lane file — this is what keeps five agents from colliding.
const LANES = ['ui', 'scene', 'story', 'engine', 'data'];
const dicts = { en: {}, uz: {}, ru: {} };
for (const lang of Object.keys(dicts)) {
  for (const lane of LANES) {
    const path = `src/i18n/${lang}/${lane}.json`;
    if (!existsSync(join(root, path))) continue;
    // JSON.parse keeps only the last of two equal keys, so scan the raw text. Lane files are flat objects of
    // strings, so the string tokens alternate key, value: every even token is a key (escapes decoded).
    const parsed = json(path);
    if (Object.values(parsed).some((v) => typeof v !== 'string')) errors.push(`${path}: values must be strings`);
    else {
      const tokens = [...readFileSync(join(root, path), 'utf8').matchAll(/"(?:[^"\\]|\\.)*"/g)].map((m) => JSON.parse(m[0]));
      const seen = new Set();
      tokens.forEach((key, i) => {
        if (i % 2) return;
        if (seen.has(key)) errors.push(`${path} "${key}": key repeated in this file`);
        seen.add(key);
      });
    }
    for (const [key, value] of Object.entries(json(path))) {
      if (!key.startsWith(`${lane}.`)) errors.push(`${path} "${key}": keys in this file must start with "${lane}."`);
      if (key in dicts[lang]) errors.push(`${path} "${key}": key already defined in another lane file`);
      dicts[lang][key] = value;
    }
  }
}
for (const [key, text] of Object.entries(dicts.uz)) {
  if (/[OoGg]['‘’`ʼ]/.test(text)) errors.push(`uz.json "${key}": write oʻ/gʻ with ʻ (U+02BB)`);
  else if (/\p{L}['’`]\p{L}/u.test(text)) errors.push(`uz.json "${key}": tutuq belgisi is ʼ (U+02BC)`);
  if (/[А-Яа-яЁё]/.test(text)) errors.push(`uz.json "${key}": Cyrillic letters in Latin Uzbek`);
}
for (const lang of ['uz', 'ru']) {
  for (const key of Object.keys(dicts[lang])) {
    if (!(key in dicts.en)) warnings.push(`${lang}.json "${key}" has no English entry`);
  }
}
// Words are written by people (lane F); until then the game shows keys. One summary line, not one per key.
for (const lang of ['en', 'uz']) {
  const empty = Object.values(dicts[lang]).filter((v) => !v).length;
  if (empty) warnings.push(`${lang}: ${empty} key(s) still without human-written text`);
}

// 2. Forbidden phrases (pitch rules, concept 3.0 section 07; NASA media guidelines 2026-10-27)
const FORBIDDEN = [
  /according to nasa/i,
  /nasa says/i,
  /nasa (confirmed|approved|endorsed)/i,
  /live data/i,
  /6[.,]5[- ]day/i,
  /\bgateway\b/i,
  /\bnrho\b/i,
  /your ride home passes overhead/i,
  /nasa tasdiqlagan/i,
  /jonli ma[ʼ'’]?lumot/i,
  /по данным nasa/i,
  /nasa (подтвердил|одобрил)/i,
];
for (const [lang, dict] of Object.entries(dicts)) {
  for (const [key, text] of Object.entries(dict)) {
    for (const re of FORBIDDEN) if (re.test(text)) errors.push(`${lang}.json "${key}": forbidden phrase ${re}`);
  }
}

// 3. Data files
const LEVELS = new Set([0, 1, 2, 3, 4]);
const LABELS = new Set(['measured', 'computed', 'rule', 'story']);
if (existsSync(join(root, 'src/engine/weeks.json'))) {
  const file = json('src/engine/weeks.json');
  const list = Array.isArray(file) ? file : file.weeks;
  if (!Array.isArray(list)) errors.push('weeks.json: expected an array of weeks or { weeks: [...] }');
  if (Array.isArray(list) && list.length !== 14) warnings.push(`weeks.json: ${list.length} weeks (the concept has 14)`);
  for (const w of list ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.id ?? '')) errors.push(`weeks.json: bad week id ${w.id}`);
    if (!Array.isArray(w.days) || w.days.length !== 7) errors.push(`weeks.json ${w.id}: needs 7 days`);
    for (const d of w.days ?? []) {
      const where = `weeks.json ${w.id} day ${d.day}`;
      if (!LEVELS.has(d.level)) errors.push(`${where}: level must be 0..4`);
      if (typeof d.ratio !== 'number' || d.ratio < 0) errors.push(`${where}: ratio must be a number ≥ 0`);
      if (d.r_label && !LABELS.has(d.r_label)) errors.push(`${where}: r_label must be one of ${[...LABELS]}`);
      if (typeof d.hours === 'number' && d.hours < 18 && d.r_label === 'measured') {
        warnings.push(`${where}: only ${d.hours} h measured → show "partly measured"`);
      }
    }
  }
} else {
  warnings.push('src/engine/weeks.json not added yet (lane Data)');
}
if (existsSync(join(root, 'src/engine/sky.json'))) {
  const sky = json('src/engine/sky.json');
  for (const [id, days] of Object.entries(sky.weeks ?? {})) {
    if (!Array.isArray(days) || days.length !== 7) errors.push(`sky.json ${id}: needs 7 days`);
  }
}
// 4. Assets
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? [p, ...walk(p)] : [p];
  });
}
for (const base of ['public/models', 'public/audio', 'public/data', 'public/textures', 'public/art']) {
  for (const p of walk(join(root, base))) {
    const rel = relative(root, p).replaceAll('\\', '/');
    const name = rel.split('/').pop();
    if (/^(license|licence|readme|copying)/i.test(name)) continue;
    if (name !== name.toLowerCase()) errors.push(`${rel}: use a lowercase file name`);
  }
}
const credits = existsSync(join(root, 'CREDITS.md')) ? readFileSync(join(root, 'CREDITS.md'), 'utf8') : '';
for (const base of ['public/models', 'public/audio', 'public/textures', 'public/art']) {
  const dir = join(root, base);
  if (!existsSync(dir)) continue;
  for (const pack of readdirSync(dir)) {
    const p = join(dir, pack);
    if (!statSync(p).isDirectory()) {
      if (!/^\.(gitkeep|keep)$/.test(pack)) errors.push(`${base}/${pack}: put it in a pack folder (${base}/<pack>/) with its licence`);
      continue;
    }
    if (!readdirSync(p).some((f) => /^(license|licence|copying|credit)/i.test(f))) {
      errors.push(`${base}/${pack}: add the licence or credit file of this pack`);
    }
    if (!credits.includes(`${base}/${pack}`)) errors.push(`${base}/${pack}: add a row to CREDITS.md naming this folder`);
  }
}

const MB = 1024 * 1024;
let modelBytes = 0;
for (const p of walk(join(root, 'public/models'))) {
  if (!p.endsWith('.glb')) continue;
  const size = statSync(p).size;
  modelBytes += size;
  if (size > MB) errors.push(`${relative(root, p).replaceAll('\\', '/')}: ${(size / MB).toFixed(2)} MB, a model must be ≤ 1 MB (npm run glb)`);
}
if (modelBytes > 5 * MB) warnings.push(`public/models: ${(modelBytes / MB).toFixed(1)} MB in total, the phone budget is < 5 MB`);

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
console.log(errors.length ? `check: ${errors.length} error(s)` : 'check: ok');
process.exitCode = errors.length ? 1 : 0;

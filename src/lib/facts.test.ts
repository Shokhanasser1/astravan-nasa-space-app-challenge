// public/data/facts.json — the fact sheet for the Data page (docs/DATA.md, docs/specs/2026-11-14-facts.md).
// Every fact: a unique id, a value with a unit, one of the four labels, a named https source with the words on that
// page, and a sentence key data.fact.<id> that exists in en/uz/ru data.json (the words are written by people).
// The two facts taken from the radiation archive must match src/engine/weeks.json, so a rebuild cannot leave them stale.
import { describe, expect, it } from 'vitest';
import sheet from '../../public/data/facts.json';
import en from '../i18n/en/data.json';
import uz from '../i18n/uz/data.json';
import ru from '../i18n/ru/data.json';
import { WEEKS, type DataLabel } from '../engine/week';
import { labeled } from './labels';

interface Fact {
  id: string;
  value: number | string;
  unit: string;
  label: DataLabel;
  key: string;
  source: { title: string; url: string };
  quote: string;
  calc?: string;
  note?: string;
  where?: string;
}

const FACTS = (sheet as unknown as { facts: Fact[] }).facts;
const DICTS: Record<string, Record<string, string>> = { en, uz, ru };
// Record over the union: the typecheck fails if labels.ts / week.ts gains or loses a label.
const LABELS: Record<DataLabel, true> = { measured: true, computed: true, rule: true, story: true };
// Same wording rules as scripts/check.mjs (pitch rules + NASA media guidelines).
const FORBIDDEN = /according to nasa|nasa says|nasa (confirmed|approved|endorsed)|live data|6[.,]5[- ]day|\bgateway\b|\bnrho\b/i;

describe('facts.json', () => {
  it('has 10–20 facts with unique camelCase ids', () => {
    expect(FACTS.length).toBeGreaterThanOrEqual(10);
    expect(FACTS.length).toBeLessThanOrEqual(20);
    const ids = FACTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][A-Za-z0-9]*$/);
  });

  it('gives every fact a value, a unit, one of the four labels and the key data.fact.<id>', () => {
    for (const f of FACTS) {
      expect(typeof f.value === 'number' ? Number.isFinite(f.value) : String(f.value).trim().length > 0, f.id).toBe(true);
      expect(typeof f.unit === 'string' && f.unit.trim().length > 0, `${f.id} unit`).toBe(true);
      expect(Object.keys(LABELS), `${f.id} label`).toContain(f.label);
      expect(f.key).toBe(`data.fact.${f.id}`);
    }
  });

  it('names an https source for every fact and quotes the page', () => {
    for (const f of FACTS) {
      expect(() => labeled(f.value, f.label, f.source.title, f.unit), f.id).not.toThrow();
      expect(new URL(f.source.url).protocol, `${f.id} url`).toBe('https:');
      expect(f.quote.trim().length, `${f.id} quote`).toBeGreaterThan(0);
      if (f.label === 'computed') expect(f.calc?.trim().length, `${f.id} needs calc`).toBeGreaterThan(0);
    }
  });

  it('uses no endorsement or banned wording', () => {
    expect(JSON.stringify(sheet)).not.toMatch(FORBIDDEN);
  });

  it('has every key in en, uz and ru data.json, and no data.fact key without a fact', () => {
    const keys = new Set(FACTS.map((f) => f.key));
    for (const [lang, dict] of Object.entries(DICTS)) {
      for (const key of keys) expect(key in dict, `${lang}: ${key}`).toBe(true);
      for (const key of Object.keys(dict)) {
        if (key.startsWith('data.fact.')) expect(keys.has(key), `${lang}: stale ${key}`).toBe(true);
      }
    }
  });

  it.skipIf(!WEEKS.length)('matches weeks.json for the calm value and the biggest storm', () => {
    const byId = new Map(FACTS.map((f) => [f.id, f]));
    const normals = WEEKS.map((w) => w.normal_uGy_h).filter((n): n is number => typeof n === 'number');
    expect(byId.get('calmDose')?.value).toBe(`${Math.round(Math.min(...normals))}–${Math.round(Math.max(...normals))}`);
    const peak = Math.max(...WEEKS.flatMap((w) => w.days.map((d) => d.ratio)));
    expect(byId.get('stormPeak')?.value).toBe(Math.round(peak));
  });
});

/**
 * One astronaut fact a night (home story, step 4; Shoxjahon aka's document p. 17): Day 1 moonGravity, 2 coldCrater,
 * 3 iceCrater, 4 donkiFlare, 5 stormPeak, 6 noAir, 7 moonDistance — from public/data/facts.json (checked, sourced).
 * Pure helpers for src/ui/play/NightFact.tsx (kept in a .ts file so Vitest can test them in Node).
 */
import type { DataLabel } from '../../engine/week';

export const NIGHT_FACTS = ['moonGravity', 'coldCrater', 'iceCrater', 'donkiFlare', 'stormPeak', 'noAir', 'moonDistance'] as const;
export type NightFactId = (typeof NIGHT_FACTS)[number];

/** Facts whose data.fact.<id> sentence names the week's date (docs/specs/2026-11-14-facts.md): during play the
 * date is never shown, so their night card always uses the undated ui.fact.<id>. */
export const DATED_FACTS: ReadonlySet<string> = new Set(['donkiFlare']);

export interface Fact {
  id: string;
  value: number | string;
  unit: string;
  label: DataLabel;
  key: string;
  source: { title: string; url: string };
}

/** The fact of a night (the day just lived, 1–7). */
export function nightFactId(day: number): NightFactId {
  const d = Math.max(1, Math.min(7, Math.round(day) || 1));
  return NIGHT_FACTS[d - 1];
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

/** The value as written for people: 384 400 → "384,400" (en) / "384 400" (uz, ru); 3e-15 → "3 × 10⁻¹⁵"; a year stays 2009. */
export function factValue(value: number | string, unit: string, lang = 'en'): string {
  if (typeof value === 'string') return value;
  if (unit === 'year') return String(value);
  if (value !== 0 && Math.abs(value) < 1e-3) {
    const [mantissa, exp] = value.toExponential().split('e');
    const sup = String(Number(exp)).replace(/./g, (c) => SUP[c] ?? c);
    return `${Number(mantissa)} × 10${sup}`;
  }
  try {
    return new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(value);
  } catch {
    return String(value);
  }
}

/** The unit shown after the value (a year needs none). */
export const factUnit = (unit: string) => (unit === 'year' ? '' : unit);

/** The sheet, loaded once and lazily: the night card is never part of the first download. */
let sheet: Promise<Fact[] | null> | null = null;
let loaded: Fact[] | null = null;
export function loadFacts(): Promise<Fact[] | null> {
  sheet ??= import('../../../public/data/facts.json')
    .then((m) => (loaded = (m.default as unknown as { facts: Fact[] }).facts))
    .catch(() => {
      sheet = null; // try again on the next night
      return null;
    });
  return sheet;
}

/** The sheet if it is already here (from the second night on: no empty first frame). */
export const factsNow = (): Fact[] | null => loaded;

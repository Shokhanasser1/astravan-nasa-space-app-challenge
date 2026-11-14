/**
 * weeks.json and sky.json: types, loading and picking a week. Lane A (Samandar) owns this folder.
 * weeks.json is imported directly (no fetch, no server, works offline); it lives next to this file.
 * Day record from concept v2, section 07 (real values, 28 October 2021):
 * { "day": 4, "date": "2021-10-28", "mean_uGy_h": 114, "max_uGy_h": 567, "hours": 23, "ratio": 9.17,
 *   "level": 1, "alert": true, "r_label": "measured", "flares": [...], "particles": [...] }
 * Built by scripts/data/weeks.mjs (LRO CRaTER via NASA OSDR RadLab + DONKI); method in that file's header.
 */

/** Four labels for every number on screen (concept 3.0, section 05). */
export type DataLabel = 'measured' | 'computed' | 'rule' | 'story';

export interface Flare {
  peak_utc: string;
  cls: string;
  source: string;
}

export interface ParticleEvent {
  first_seen_utc: string;
  channel: string;
  source: string;
}

export interface WeekDay {
  day: number;
  date: string;
  mean_uGy_h: number;
  max_uGy_h: number;
  hours: number; // < 18 → "partly measured"
  ratio: number;
  level: 0 | 1 | 2 | 3 | 4;
  alert: boolean; // X-class flare that day, or the week's first particle event → "Flare alert" card
  watch?: boolean; // before the storm: a fast front-side eruption or an M5+ flare → Houston's "Watch" line
  r_label: DataLabel;
  flares: Flare[];
  particles: ParticleEvent[];
  hourly?: (number | null)[]; // 24 hourly ratios (reading / normal), null = no reading that hour
}

export interface Week {
  id: string; // first day, YYYY-MM-DD; also the class code (?week=)
  kind?: string; // quiet | false alarm | storm | severe | hard mode
  normal_uGy_h?: number; // calm value of the 27 days before the week
  peak_level?: number;
  days: WeekDay[];
  [key: string]: unknown;
}

/** sky.json (concept 3.0, section 05): computed with PyEphem, checked against JPL Horizons. */
export interface SkyDay {
  day: number;
  sun_az_deg: number;
  earth_el_deg: number;
  earth_phase: number;
}

// import.meta.glob: the build does not fail while the files are not in the repo yet.
const weekFiles = import.meta.glob<{ default: unknown }>('./weeks.json', { eager: true });
const skyFiles = import.meta.glob<{ default: unknown }>('./sky.json', { eager: true });

function asWeeks(raw: unknown): Week[] {
  if (Array.isArray(raw)) return raw as Week[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { weeks?: unknown }).weeks)) {
    return (raw as { weeks: Week[] }).weeks;
  }
  return [];
}

export const WEEKS: Week[] = asWeeks(weekFiles['./weeks.json']?.default);
export const SKY: Record<string, SkyDay[]> =
  ((skyFiles['./sky.json']?.default as { weeks?: Record<string, SkyDay[]> } | undefined)?.weeks ?? {});

/**
 * Class code (?week=YYYY-MM-DD) gives a whole class the same real week; otherwise a random week,
 * never a hard-mode week unless asked by code.
 */
export function pickWeek(weeks: Week[], search: string, random: () => number = Math.random): Week | null {
  if (!weeks.length) return null;
  const code = new URLSearchParams(search).get('week');
  const byCode = code ? weeks.find((w) => w.id === code) : undefined;
  if (byCode) return byCode;
  const pool = weeks.filter((w) => !String(w.kind ?? '').toLowerCase().includes('hard'));
  const list = pool.length ? pool : weeks;
  return list[Math.floor(random() * list.length)];
}

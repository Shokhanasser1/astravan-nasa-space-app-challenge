/**
 * Shapes of the files in public/data/. Owner: Sarvar (files), Samandar (loader).
 * weeks.json day record follows concept v2, section 07 (real values, 28 October 2021):
 * { "day": 4, "date": "2021-10-28", "mean_uGy_h": 114, "max_uGy_h": 567, "hours": 23, "ratio": 9.17, "level": 1,
 *   "alert": true, "r_label": "measured", "flares": [...], "particles": [...] }
 */

/** Four labels for every number on screen (concept 3.0, section 05). */
export type DataLabel = 'measured' | 'computed' | 'rule' | 'story';

export type WeekKind = 'quiet' | 'false-alarm' | 'storm' | 'severe' | 'hard';

export interface Flare {
  peak_utc: string; // "15:35"
  cls: string; // "X1.0"
  source: string; // "DONKI notifications FLR"
}

export interface ParticleEvent {
  first_seen_utc: string; // "16:35"
  channel: string; // ">100 MeV"
  source: string; // "DONKI SEP"
}

export interface WeekDay {
  day: number; // 1..7
  date: string; // YYYY-MM-DD
  mean_uGy_h: number;
  max_uGy_h: number;
  hours: number; // hours measured; < 18 → "partly measured"
  ratio: number; // day mean / normal (calm value of the 27 days before)
  level: 0 | 1 | 2 | 3 | 4;
  alert: boolean;
  r_label: DataLabel;
  flares: Flare[];
  particles: ParticleEvent[];
  /** Optional hourly ratios for the dosimeter and the truth curve (24 values). */
  hourly_ratio?: number[];
}

export interface Week {
  id: string; // first day, YYYY-MM-DD; also the class code (?week=)
  kind: WeekKind;
  normal_uGy_h?: number;
  days: WeekDay[];
  /** Media prepared at build time, paths relative to public/data/. */
  media?: { sdo_before?: string; sdo_peak?: string; earth?: Record<string, string> };
}

export interface WeeksFile {
  generated: string; // ISO date of the rebuild
  sources: { name: string; url: string }[];
  weeks: Week[];
}

/** sky.json (concept 3.0, section 05): computed with PyEphem, checked against JPL Horizons. */
export interface SkyDay {
  day: number;
  sun_az_deg: number; // Sun direction along the horizon
  earth_el_deg: number; // Earth above the horizon (negative: below the ridge)
  earth_phase: number; // 0..1 lit fraction
}

export interface SkyFile {
  site: { lat: number; lon: number; name: string };
  sun_el_deg: number; // game rule: 1.5
  weeks: Record<string, SkyDay[]>;
}

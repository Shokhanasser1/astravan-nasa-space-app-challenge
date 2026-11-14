import type { DataLabel } from '../engine/week';

/**
 * Every number the player sees carries one of four labels (concept 3.0, section 05):
 * measured (a NASA instrument recorded it), computed (sky mechanics), rule (game rule), story.
 * The Data page lists the sources; never write "according to NASA" or "NASA confirmed".
 */
export interface Labeled {
  value: number | string;
  unit?: string;
  label: DataLabel;
  source: string;
}

const FORBIDDEN = /according to nasa|nasa says|nasa confirmed|live data/i;

export function labeled(value: number | string, label: DataLabel, source: string, unit?: string): Labeled {
  if (!source.trim()) throw new Error('A labeled value needs a source');
  if (FORBIDDEN.test(source)) throw new Error(`Name the instrument or document instead of "${source}"`);
  return Object.freeze({ value, unit, label, source });
}

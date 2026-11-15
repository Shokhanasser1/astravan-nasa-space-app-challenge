/**
 * The week's day stars (home story, step 3): a star for each day whose five tasks were all done (src/state/tasks.ts).
 * Kept only on this device, through src/lib/storage.ts (the one door to localStorage; it may fail and the game goes
 * on). Keyed by the mission week, and by the cadet badge when there is one, so badges on a shared tablet never mix.
 * Once earned, a star stays: a replay of the same week can only add stars. Nothing about the child is stored.
 */
import { load, save } from '../lib/storage';

export const STAR_DAYS = 7;

export const starsKey = (weekId: string, profile?: string | null) => (profile ? `stars:${profile}:${weekId}` : `stars:${weekId}`);

/** Seven flags, Day 1 first; whatever storage gives back (missing, broken, edited) becomes a valid list. */
export function stars(weekId: string, profile?: string | null): boolean[] {
  const raw = load<unknown>(starsKey(weekId, profile), null);
  return Array.from({ length: STAR_DAYS }, (_, i) => Array.isArray(raw) && raw[i] === true);
}

/** Lights the star of `day` (1–7) and returns the week's stars; a day out of range or already lit changes nothing. */
export function markStar(weekId: string, day: number, profile?: string | null): boolean[] {
  const list = stars(weekId, profile);
  if (!Number.isInteger(day) || day < 1 || day > STAR_DAYS || list[day - 1]) return list;
  const next = list.map((lit, i) => lit || i === day - 1);
  save(starsKey(weekId, profile), next);
  return next;
}

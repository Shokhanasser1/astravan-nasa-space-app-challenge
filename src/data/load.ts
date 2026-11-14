import type { SkyFile, Week, WeeksFile } from './types';

/** Data ships inside the build (public/data). The game never calls NASA at run time. */
const base = import.meta.env.BASE_URL;

export async function loadWeeks(): Promise<WeeksFile> {
  const res = await fetch(`${base}data/weeks.json`);
  if (!res.ok) throw new Error(`weeks.json: HTTP ${res.status}`);
  return res.json();
}

export async function loadSky(): Promise<SkyFile | null> {
  try {
    const res = await fetch(`${base}data/sky.json`);
    return res.ok ? res.json() : null;
  } catch {
    return null; // sky.json is optional: the scene falls back to fixed Sun and Earth positions
  }
}

/**
 * Pick the week: the class code (?week=YYYY-MM-DD) gives a whole class the same real week;
 * otherwise a random week, excluding hard-mode weeks unless asked.
 */
export function pickWeek(weeks: Week[], search: string, random: () => number = Math.random): Week {
  const code = new URLSearchParams(search).get('week');
  const byCode = code ? weeks.find((w) => w.id === code) : undefined;
  if (byCode) return byCode;
  const pool = weeks.filter((w) => w.kind !== 'hard');
  const list = pool.length ? pool : weeks;
  return list[Math.floor(random() * list.length)];
}

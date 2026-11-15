import { useSyncExternalStore } from 'react';

/**
 * The real day, hour by hour (15 Nov, Shoxjahon aka: "the storm must follow the real NASA data"). Each day of the
 * week carries 24 hourly dose ratios measured by LRO CRaTER (weeks.json `hourly`, reading / normal; null = no
 * reading) and the DONKI flare and particle times. While the day runs by itself (phase 'run', src/ui/play/DayRun.tsx)
 * the hours are played in order: the dosimeter clicks and the storm in the air follow the hour being played.
 * Pure helpers here (tested), plus a tiny store the scene reads.
 */

/** Radiation level of a dose ratio — the same bands as the week builder (scripts/data/weeks.mjs). */
export function levelOf(ratio: number): 0 | 1 | 2 | 3 | 4 {
  if (!(ratio >= 2)) return 0;
  if (ratio < 10) return 1;
  if (ratio < 100) return 2;
  if (ratio < 1000) return 3;
  return 4;
}

/** The hour (0 ≤ h < 24, UTC) being played after `elapsed` of `total` ms. */
export function hourAt(elapsed: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.max(0, Math.min(23.999, (elapsed / total) * 24));
}

/** The measured ratio for an hour; a missing reading takes the nearest earlier one, then the day's mean. */
export function ratioAt(hourly: readonly (number | null)[] | undefined, hour: number, dayRatio: number): number {
  if (!hourly?.length) return dayRatio;
  for (let h = Math.floor(hour); h >= 0; h--) {
    const r = hourly[h];
    if (typeof r === 'number') return r;
  }
  return dayRatio;
}

function mean(hourly: readonly (number | null)[], from: number, to: number): number | null {
  const v = hourly.slice(from, to).filter((r): r is number => typeof r === 'number');
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/**
 * The dosimeter's ratio outside the running day: the plan is made in the morning (00–08 UTC), the night card is read
 * in the evening (18–24 UTC). So a storm that came in the afternoon is not heard before it happened.
 */
export function doseFor(phase: string, hourly: readonly (number | null)[] | undefined, dayRatio: number): number {
  if (!hourly?.length) return dayRatio;
  if (phase === 'morning' || phase === 'plan') return mean(hourly, 0, 8) ?? dayRatio;
  if (phase === 'night') return mean(hourly, 18, 24) ?? dayRatio;
  return dayRatio;
}

/** "15:35" → 15.58 h. */
export function utcHour(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}

/** Whole day length while it runs: longer when the hours change enough to watch (≤ 6 s, skippable). */
export function runMs(hourly: readonly (number | null)[] | undefined): number {
  const top = Math.max(0, ...(hourly ?? []).filter((r): r is number => typeof r === 'number'));
  return top >= 2 ? 6000 : 4000;
}

// ---- the store: the hour being played, or null when the day is not running ----
export type RunHour = { hour: number; ratio: number };
let now: RunHour | null = null;
const subs = new Set<() => void>();
export function setRunHour(v: RunHour | null): void {
  if (v?.hour === now?.hour && v?.ratio === now?.ratio) return;
  now = v;
  for (const f of subs) f();
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export function useRunHour(): RunHour | null {
  return useSyncExternalStore(subscribe, () => now, () => now);
}

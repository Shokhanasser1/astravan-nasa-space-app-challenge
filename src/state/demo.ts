/**
 * Judge links (home story step 6, docs/plans/2026-11-15-home-story.md; the lead's document p. 19, "Hakam uchun
 * havolalar"): `?demo=storm` opens the morning of Day 4 (the flare alert, the storm ahead), `?demo=launch` the
 * morning of Day 7. The days before are the team's golden Plan A (src/engine/golden.ts) played through the real
 * reducer, so every number on screen is the engine's own. Pure: the same kind gives the same model (fixed seed).
 */
import { PLAN_A, type PlanDay } from '../engine/golden';
import { WEEKS, type Week } from '../engine/week';
import { FIRST_WEEK, initialModel, reducer, type Action, type Machine, type Model } from './game';

export type DemoKind = 'storm' | 'launch';

/** The day each judge link opens on (its morning). */
export const DEMO_DAY: Record<DemoKind, number> = { storm: 4, launch: 7 };

/** Fixed seed: it only shuffles the day cards, and the first mission's cards are fixed anyway. */
const DEMO_SEED = 1;

export const isDemoKind = (v: string | null | undefined): v is DemoKind => v === 'storm' || v === 'launch';

/** The taps of one planned day: shelter and card first (they change the limits), then the batteries. */
function dayActions(d: PlanDay): Action[] {
  const taps: Action[] = [{ type: 'CHOOSE', shelter: d.alloc.shelter }];
  if (d.card) taps.push({ type: 'CHOOSE', card: d.card });
  const add = (k: Machine, n: number): Action[] => Array.from({ length: n }, () => ({ type: 'SET', k }));
  taps.push(...add('ls', d.alloc.ls), ...add('gh', d.alloc.gh), ...add('ws', d.alloc.build / 2), ...add('sc', d.alloc.sc));
  return taps;
}

/**
 * The first mission (Plan A's week, 25–31 Oct 2021) played with Plan A up to the morning of the demo's day.
 * Null when that week is missing from weeks.json (the caller then starts the game as usual).
 */
export function demoModel(kind: DemoKind, week: Week | undefined = WEEKS.find((w) => w.id === FIRST_WEEK)): Model | null {
  if (!week) return null;
  let m = reducer(initialModel, { type: 'START', week, seed: DEMO_SEED, firstMission: true });
  for (const d of PLAN_A.slice(0, DEMO_DAY[kind] - 1)) {
    // morning → plan, the day's taps, confirm → run, → night, → next morning
    m = [{ type: 'NEXT' } as Action, ...dayActions(d), { type: 'CONFIRM' } as Action, { type: 'NEXT' } as Action, { type: 'NEXT' } as Action]
      .reduce(reducer, m);
  }
  return m;
}

/**
 * Golden plans (concept v2 §10, docs/rules.md), week 2021-10-25, cards Shadow (day 2) and Ice (day 3).
 * Data only — used by the engine and reducer tests. Plans B and C are given in the concept as totals; the plays below
 * match their description ("no wall, no shelter, three moonwalks a day, garden left to die"; "two wall levels,
 * everyone inside on all three storm days" = days 4–6, launch day half inside).
 */
import type { Alloc } from './rules';
import { WEEKS, type Week } from './week';

export type PlanDay = { alloc: Alloc; card?: string; expect?: { reserve: number; wall: number; extra: number; science: number } };

const a = (ls: number, gh: number, build: number, sc: number, shelter: Alloc['shelter'] = 'none', launch = 0): Alloc => ({
  ls, gh, build, sc, launch, shelter,
});

// Plan A, day by day. Batteries: Life Support / Garden / Workshop / Explore.
export const PLAN_A: PlanDay[] = [
  { alloc: a(2, 2, 0, 3), expect: { reserve: 4, wall: 0, extra: 0.3, science: 3 } },
  { alloc: a(2, 1, 2, 0), card: 'shadow:heat', expect: { reserve: 4, wall: 1, extra: 0.3, science: 3 } },
  { alloc: a(2, 1, 2, 1), card: 'ice:go', expect: { reserve: 3, wall: 2, extra: 0.4, science: 5 } },
  { alloc: a(3, 1, 0, 1, 'half'), expect: { reserve: 4, wall: 2, extra: 0.62, science: 6 } },
  { alloc: a(2, 1, 0, 0, 'full'), expect: { reserve: 4, wall: 2, extra: 0.745, science: 6 } }, // concept table rounds to 0.75
  { alloc: a(2, 1, 2, 1, 'half'), expect: { reserve: 4, wall: 3, extra: 1.245, science: 12 } }, // table: 1.25
  { alloc: a(2, 0, 0, 2, 'none', 4), expect: { reserve: 3, wall: 3, extra: 1.58, science: 14 } },
];

export const PLAN_B: PlanDay[] = [
  { alloc: a(3, 0, 0, 3) },
  { alloc: a(3, 0, 0, 3), card: 'shadow:cool' },
  { alloc: a(3, 0, 0, 3), card: 'ice:go' },
  { alloc: a(3, 0, 0, 3) },
  { alloc: a(3, 0, 0, 3) },
  { alloc: a(3, 0, 0, 3) },
  { alloc: a(2, 0, 0, 0, 'none', 4) },
];

export const PLAN_C: PlanDay[] = [
  { alloc: a(2, 2, 0, 3) },
  { alloc: a(2, 1, 2, 0), card: 'shadow:heat' },
  { alloc: a(2, 1, 2, 0), card: 'ice:skip' },
  { alloc: a(2, 1, 0, 0, 'full') },
  { alloc: a(2, 1, 0, 0, 'full') },
  { alloc: a(2, 1, 0, 0, 'full') },
  { alloc: a(2, 1, 0, 1, 'half', 4) },
];

export const FIRST_CARDS = ['shadow', 'ice'] as const;
export const week = (): Week => WEEKS.find((w) => w.id === '2021-10-25')!;

import { describe, expect, it } from 'vitest';
import { ENGINE_IS_STUB, confirm, newGame, result, type Alloc, type State } from './rules';
import { WEEKS } from './week';

/**
 * Golden plans (concept v2 §10, docs/rules.md). Week 2021-10-25, cards Shadow (day 2) and Ice (day 3).
 * Lane A: when rules.ts is the real port, map the card choices to the engine's names and remove ENGINE_IS_STUB.
 * Never change a rule to make a test pass: report the mismatch instead.
 */
type Day = { alloc: Alloc; card?: string; expect: { reserve: number; wall: number; extra: number; science: number } };

const a = (ls: number, gh: number, build: number, sc: number, shelter: Alloc['shelter'] = 'none', launch = 0): Alloc => ({
  ls, gh, build, sc, launch, shelter,
});

// Plan A, day by day. Batteries: Life Support / Garden / Workshop / Explore.
const PLAN_A: Day[] = [
  { alloc: a(2, 2, 0, 3), expect: { reserve: 4, wall: 0, extra: 0.3, science: 3 } },
  { alloc: a(2, 1, 2, 0), card: 'shadow:heat', expect: { reserve: 4, wall: 1, extra: 0.3, science: 3 } },
  { alloc: a(2, 1, 2, 1), card: 'ice:go', expect: { reserve: 3, wall: 2, extra: 0.4, science: 5 } },
  { alloc: a(3, 1, 0, 1, 'half'), expect: { reserve: 4, wall: 2, extra: 0.62, science: 6 } },
  { alloc: a(2, 1, 0, 0, 'full'), expect: { reserve: 4, wall: 2, extra: 0.75, science: 6 } },
  { alloc: a(2, 1, 2, 1, 'half'), expect: { reserve: 4, wall: 3, extra: 1.25, science: 12 } },
  { alloc: a(2, 0, 0, 2, 'none', 4), expect: { reserve: 3, wall: 3, extra: 1.58, science: 14 } },
];

const week = () => WEEKS.find((w) => w.id === '2021-10-25')!;

describe.skipIf(ENGINE_IS_STUB || !WEEKS.length)('golden plans, week 2021-10-25', () => {
  it('Plan A matches the concept day by day and ends 7 / 14, 77 %, Balance Master', () => {
    let s: State = newGame(week(), { modules: ['wall'] });
    for (const [i, d] of PLAN_A.entries()) {
      s = confirm(s, week(), d.alloc, d.card);
      expect(s.air, `reserve after day ${i + 1}`).toBe(d.expect.reserve);
      expect(s.wall, `wall after day ${i + 1}`).toBe(d.expect.wall);
      expect(s.extra, `extra dose after day ${i + 1}`).toBeCloseTo(d.expect.extra, 1);
      expect(s.sci, `science after day ${i + 1}`).toBe(d.expect.science);
    }
    const r = result(s, week());
    expect(r).toMatchObject({ crew: 7, science: 14, title: 'Balance Master' });
    expect(Math.round(r.blockedPct)).toBe(77);
  });

  it.todo('Plan B (no wall, no shelter, three moonwalks a day, garden left to die) → 5.09, 0 %, crew 3, science 19, Bold Explorer');
  it.todo('Plan C (two wall levels, everyone inside on all three storm days) → 0.81, 85 %, crew 8, science 9, Careful Commander');
  it.todo('Plan A played through the reducer (lane B) gives the same result');
});

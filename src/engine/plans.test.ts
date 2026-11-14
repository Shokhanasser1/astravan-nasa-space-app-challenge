import { describe, expect, it } from 'vitest';
import { confirm, newGame, result, type State } from './rules';
import { FIRST_CARDS, PLAN_A, PLAN_B, PLAN_C, week, type PlanDay } from './golden';

// Golden plans: docs/rules.md. Never change a rule to make a test pass: report the mismatch instead.
function play(plan: PlanDay[], check = false): State {
  let s: State = newGame(week(), { modules: ['wall'], cards: [...FIRST_CARDS] });
  for (const [i, d] of plan.entries()) {
    s = confirm(s, week(), d.alloc, d.card);
    if (check && d.expect) {
      expect(s.air, `reserve after day ${i + 1}`).toBe(d.expect.reserve);
      expect(s.wall, `wall after day ${i + 1}`).toBe(d.expect.wall);
      expect(s.extra, `extra dose after day ${i + 1}`).toBeCloseTo(d.expect.extra, 2);
      expect(s.sci, `science after day ${i + 1}`).toBe(d.expect.science);
    }
  }
  return s;
}

describe('golden plans, week 2021-10-25', () => {
  it('the real week is in weeks.json with the concept levels 0 0 0 1 2 2 1', () => {
    expect(week().days.map((d) => d.level)).toEqual([0, 0, 0, 1, 2, 2, 1]);
    expect(week().days.map((d) => d.alert)).toEqual([false, false, false, true, false, false, false]);
  });

  it('Plan A matches the concept day by day and ends 7 / 14, 77 %, Balance Master', () => {
    const r = result(play(PLAN_A, true), week());
    expect(r).toMatchObject({ crew: 7, science: 14, title: 'Balance Master' });
    expect(Math.round(r.blockedPct)).toBe(77);
  });

  it('Plan B → 5.09, 0 %, crew 3, science 19, Bold Explorer', () => {
    const s = play(PLAN_B);
    const r = result(s, week());
    expect(s.extra).toBeCloseTo(5.09, 2);
    expect(r).toMatchObject({ crew: 3, science: 19, title: 'Bold Explorer', blockedPct: 0 });
  });

  it('Plan C → 0.81, 85 %, crew 8, science 9, Careful Commander', () => {
    const s = play(PLAN_C);
    const r = result(s, week());
    expect(s.extra).toBeCloseTo(0.81, 2);
    expect(Math.round(r.blockedPct)).toBe(85);
    expect(r).toMatchObject({ crew: 8, science: 9, title: 'Careful Commander' });
  });
});

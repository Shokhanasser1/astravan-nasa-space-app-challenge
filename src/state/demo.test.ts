import { describe, expect, it } from 'vitest';
import { PLAN_A } from '../engine/golden';
import { board, reducer, toView } from './game';
import { demoModel, isDemoKind } from './demo';

// Judge links: Plan A through the real reducer, stopped at a morning. The numbers are Plan A's (golden.ts).
describe('judge links (?demo=)', () => {
  it('storm opens the morning of Day 4 with Plan A days 1–3 behind it', () => {
    const m = demoModel('storm')!;
    expect(m.screen).toBe('game');
    expect(m.game?.day).toBe(4);
    expect(toView(m)).toMatchObject({ day: 4, phase: 'morning' });
    const day3 = PLAN_A[2].expect!;
    expect(toView(m).res).toMatchObject({ air: day3.reserve, wall: day3.wall, sci: day3.science });
    expect(m.game?.extra).toBeCloseTo(day3.extra, 2);
    expect(toView(m).res?.crew).toBeGreaterThanOrEqual(5);
    expect(m.picks).toEqual({ 2: 'shadow:heat', 3: 'ice:go' });
    // the strongest scene: Day 4 is the flare alert with the shelter choice
    expect(board(reducer(m, { type: 'NEXT' }))?.info).toMatchObject({ storm: 'alert', choice: true });
  });

  it('launch opens the morning of Day 7 with Plan A days 1–6 behind it, Launch filled on the board', () => {
    const m = demoModel('launch')!;
    expect(m.game?.day).toBe(7);
    expect(toView(m)).toMatchObject({ day: 7, phase: 'morning' });
    const day6 = PLAN_A[5].expect!;
    expect(toView(m).res).toMatchObject({ air: day6.reserve, wall: day6.wall, sci: day6.science });
    expect(m.game?.extra).toBeCloseTo(day6.extra, 2);
    expect(toView(m).res?.crew).toBeGreaterThanOrEqual(5);
    expect(m.game?.days.map((d) => d.shelter)).toEqual(['none', 'none', 'none', 'half', 'full', 'half']);
    expect(reducer(m, { type: 'NEXT' }).alloc.launch).toBe(4);
  });

  it('is deterministic and accepts only the two kinds', () => {
    expect(demoModel('storm')).toEqual(demoModel('storm'));
    expect(demoModel('launch')).toEqual(demoModel('launch'));
    expect(['storm', 'launch', 'day4', '', null].map(isDemoKind)).toEqual([true, true, false, false, false]);
  });
});

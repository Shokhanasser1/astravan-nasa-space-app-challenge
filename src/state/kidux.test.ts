import { describe, expect, it } from 'vitest';
import { board, initialModel, reducer, type Action, type Model } from './game';
import { houstonActions, houstonAlloc } from './houston';
import { dropNudge } from './nudge';
import { cardSays, shelterSays, tenths, type Say } from './says';
import { PLAN_A, week as firstWeek } from '../engine/golden';
import { WEEKS } from '../engine/week';
import { demoModel } from './demo';

const run = (m: Model, actions: Action[]) => actions.reduce(reducer, m);
const plan = (m: Model) => reducer(m, { type: 'NEXT' });
const start = (w = firstWeek()) => plan(reducer(initialModel, { type: 'START', week: w, firstMission: w.id === firstWeek().id }));
const counts = (m: Model) => ({ ls: m.alloc.ls, gh: m.alloc.gh, build: m.alloc.build, sc: m.alloc.sc, launch: m.alloc.launch });
const houston = (m: Model) => run(m, houstonActions(m));
const keys = (lines: Say[] | undefined) => (lines ?? []).map((l) => l.key);

describe("Houston's plan", () => {
  it('Day 1 of the first mission: golden Plan A, through the reducer', () => {
    const m = houston(start());
    const { shelter: _s, ...want } = PLAN_A[0].alloc;
    expect(counts(m)).toEqual(want);
    expect(m.preview?.reserveAfter).toBeGreaterThan(0);
  });

  it('keeps the child’s card answer and fills the rest (Day 2, Shadow heated)', () => {
    let m = start();
    m = run(m, [...houstonActions(m), { type: 'CONFIRM' }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' }]);
    expect(m.game?.day).toBe(2);
    m = reducer(m, { type: 'CHOOSE', card: 'shadow:heat' });
    m = houston(m);
    expect(m.cardChoice).toBe('shadow:heat');
    const { shelter: _s, ...want } = PLAN_A[1].alloc;
    expect(counts(m)).toEqual(want);
  });

  it('replaces what the child placed and empties the hands first', () => {
    let m = run(start(), [{ type: 'SET', k: 'sc' }, { type: 'SET', k: 'sc' }, { type: 'SET', k: 'sc' }, { type: 'TAKE' }]);
    expect(m.hands).toBe(1);
    m = houston(m);
    expect(m.hands).toBe(0);
    expect(counts(m).ls).toBe(PLAN_A[0].alloc.ls);
  });

  it('another week: a plain plan that fits and keeps the air from falling', () => {
    const other = WEEKS.find((w) => w.id !== firstWeek().id)!;
    const m0 = start(other);
    const m = houston(m0);
    expect(houstonAlloc(m0)).not.toBeNull();
    expect(m.preview!.left).toBeGreaterThanOrEqual(0);
    expect(m.preview!.reserveAfter).toBeGreaterThanOrEqual(m.game!.air);
    expect(m.preview!.gardenAfter).toBeGreaterThanOrEqual(m.game!.plant);
  });

  it('no board, no plan (morning)', () => {
    const morning = reducer(initialModel, { type: 'START', week: firstWeek() });
    expect(houstonActions(morning)).toEqual([]);
  });
});

describe('a drop is noticed', () => {
  it('an empty plan lets the food fall: Houston asks for light', () => {
    expect(dropNudge(start())).toEqual({ key: 'story.radio.needLight', gauge: 'food' });
  });

  it('quiet once the Greenhouse has a battery', () => {
    const m = run(start(), [{ type: 'SET', k: 'gh' }, { type: 'SET', k: 'ls' }, { type: 'SET', k: 'ls' }]);
    expect(dropNudge(m)).toBeNull();
  });

  it('air running out tonight comes first', () => {
    const m = start();
    const low = { ...m, game: { ...m.game!, air: 1 } };
    const withPreview = reducer(reducer(low, { type: 'SET', k: 'gh' }), { type: 'SET', k: 'gh', delta: -1 });
    expect(withPreview.preview!.reserveAfter).toBeLessThanOrEqual(0);
    expect(dropNudge(withPreview)?.gauge).toBe('air');
  });

  it('never at night or in the morning', () => {
    expect(dropNudge(reducer(initialModel, { type: 'START', week: firstWeek() }))).toBeNull();
  });
});

describe('decision words', () => {
  it('pieces of ten', () => {
    expect(tenths(0.77)).toBe(8);
    expect(tenths(0)).toBe(0);
    expect(tenths(1.2)).toBe(10);
  });

  it('Shadow: heat costs a battery and keeps the food; cool is free and the food falls', () => {
    let m = start();
    m = run(m, [...houstonActions(m), { type: 'CONFIRM' }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' }]);
    const says = cardSays(m, board(m)!);
    expect(keys(says['shadow:heat'])).toEqual(['ui.say.cost', 'ui.say.foodSafe']);
    expect(says['shadow:heat'][0].vars).toEqual({ n: 1 });
    expect(keys(says['shadow:cool'])).toEqual(['ui.say.free', 'ui.say.foodDown']);
    expect(says['shadow:cool'][1].vars).toEqual({ n: 1 });
  });

  it('Ice: go brings a part and costs air, priced with one rover battery; skip keeps the air', () => {
    const m = demoAt(3);
    const says = cardSays(m, board(m)!);
    expect(keys(says['ice:go'])).toEqual(['ui.say.airDown', 'ui.say.parts', 'ui.say.needRover']);
    expect(keys(says['ice:skip'])).toEqual(['ui.say.airSafe', 'ui.say.noParts']);
  });

  it('shelter: n of 10 blocked on a known storm day, health line from the dose', () => {
    const m = demoAt(5);
    const b = board(m)!;
    const says = shelterSays(m, b);
    for (const o of b.shelterOptions) expect(says[o.value]![0]).toEqual({ key: 'ui.say.blocked', vars: { n: tenths(o.preview.blockedToday) } });
    expect(says.full![0].vars!.n).toBeGreaterThan(says.none![0].vars!.n);
  });

  it('an alert day (strength unknown) says nothing about blocking', () => {
    const m = demoAt(4);
    expect(shelterSays(m, board(m)!)).toEqual({});
  });
});

/** The first mission played with Plan A up to the plan phase of `day`. */
function demoAt(day: number): Model {
  let m = reducer(initialModel, { type: 'START', week: firstWeek(), firstMission: true });
  if (day === 4) return plan(demoModel('storm')!);
  for (const d of PLAN_A.slice(0, day - 1)) {
    const taps: Action[] = [{ type: 'NEXT' }, { type: 'CHOOSE', shelter: d.alloc.shelter }];
    if (d.card) taps.push({ type: 'CHOOSE', card: d.card });
    for (const [k, n] of [['ls', d.alloc.ls], ['gh', d.alloc.gh], ['ws', d.alloc.build / 2], ['sc', d.alloc.sc]] as const)
      for (let i = 0; i < n; i++) taps.push({ type: 'SET', k });
    m = run(m, [...taps, { type: 'CONFIRM' }, { type: 'NEXT' }, { type: 'NEXT' }]);
  }
  return plan(m);
}

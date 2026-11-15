import { describe, expect, it } from 'vitest';
import { initialModel, reducer, type Action, type Machine, type Model } from './game';
import { dayStar, dayTasks, firstOpen, type Task } from './tasks';
import { PLAN_A, week as realWeek } from '../engine/golden';
import { CARD_CHOICES } from '../engine/rules';
import type { Week } from '../engine/week';

const run = (m: Model, actions: Action[]) => actions.reduce(reducer, m);
const start = () => reducer(initialModel, { type: 'START', week: realWeek() });

/** Taps for one day of a plan (same as game.test.ts): shelter and card first, then batteries. */
function dayActions(alloc: (typeof PLAN_A)[number]['alloc'], card?: string): Action[] {
  const taps: Action[] = [{ type: 'CHOOSE', shelter: alloc.shelter }];
  if (card) taps.push({ type: 'CHOOSE', card });
  const add = (k: Machine, n: number) => Array.from({ length: n }, () => ({ type: 'SET', k }) as Action);
  taps.push(...add('ls', alloc.ls), ...add('gh', alloc.gh), ...add('ws', alloc.build / 2), ...add('sc', alloc.sc));
  return taps;
}

const ids = (m: Model) => dayTasks(m).map((t) => t.id);
const flags = (m: Model) => Object.fromEntries(dayTasks(m).map((t) => [t.id, t.done]));

/** The document's table (p. 16) for the first mission. */
const DAYS = [
  ['reach', 'air', 'greenhouse', 'rover', 'sleep'],
  ['cardShadow', 'air', 'greenhouse', 'wall', 'sleep'],
  ['cardIce', 'air', 'greenhouse', 'wall', 'sleep'],
  ['call', 'shelter', 'air', 'greenhouse', 'sleep'],
  ['inside', 'air', 'greenhouse', 'save', 'sleep'],
  ['shelter', 'air', 'harvest', 'wallOrRover', 'sleep'],
  ['air', 'roverLast', 'launch', 'arm', 'ladder'],
];

/**
 * Done at the start of each day's plan, before a single battery is placed (empty plan). Day 5's "save 2 batteries"
 * is a promise kept until too many are placed (live from the plan's preview), so it starts ticked.
 */
const EMPTY_DONE: string[][] = [['reach'], [], [], ['call'], ['save'], [], ['launch', 'arm']];

/** Plays PLAN_A and hands each day's model at: morning, plan opened (empty), plan filled, night. */
function playPlanA(visit: (day: number, at: { morning: Model; empty: Model; planned: Model; night: Model }) => void) {
  let m = start();
  PLAN_A.forEach((d, i) => {
    const morning = m;
    const empty = reducer(morning, { type: 'NEXT' });
    const planned = run(empty, dayActions(d.alloc, d.card));
    let after = run(planned, [{ type: 'CONFIRM' }, { type: 'NEXT' }]);
    visit(i + 1, { morning, empty, planned, night: after });
    if (after.phase === 'night') after = reducer(after, { type: 'NEXT' });
    m = after;
  });
  return m;
}

describe("today's 5", () => {
  it('has no tasks before a game starts', () => {
    expect(dayTasks(initialModel)).toEqual([]);
    expect(dayStar(initialModel)).toBe(false);
  });

  it("gives each day of the first mission the document's five tasks", () => {
    const seen: string[][] = [];
    playPlanA((day, { morning, empty, planned, night }) => {
      seen.push(ids(empty));
      for (const m of [morning, planned, night]) expect(ids(m), `day ${day} ${m.phase}`).toEqual(DAYS[day - 1]);
    });
    expect(seen).toEqual(DAYS);
  });

  it('ticks nothing in the morning and only the phase tasks on an empty plan', () => {
    playPlanA((day, { morning, empty }) => {
      expect(dayTasks(morning).filter((t) => t.done && !t.optional).map((t) => t.id), `day ${day} morning`).toEqual([]);
      expect(dayTasks(empty).filter((t) => t.done).map((t) => t.id), `day ${day} empty plan`).toEqual(EMPTY_DONE[day - 1]);
      expect(dayStar(empty)).toBe(false);
    });
  });

  it("ticks every task from Plan A's plan, and Sleep once the day is confirmed: a star every day", () => {
    playPlanA((day, { planned, night }) => {
      const open = dayTasks(planned).filter((t) => !t.done).map((t) => t.id);
      expect(open, `day ${day} planned`).toEqual([day === 7 ? 'ladder' : 'sleep']);
      expect(dayStar(planned)).toBe(false);
      expect(dayTasks(night).every((t) => t.done), `day ${day} after confirm`).toBe(true);
      expect(dayStar(night), `day ${day} star`).toBe(true);
    });
  });

  it('points the beacon at the machine of each task and gives the wall level to build', () => {
    playPlanA((day, { empty }) => {
      const tasks = dayTasks(empty);
      const by = (id: string) => tasks.find((t) => t.id === id);
      if (by('air')) expect(by('air')?.target).toBe('ls');
      if (by('greenhouse')) expect(by('greenhouse')?.target).toBe('gh');
      if (day === 1) expect(firstOpen(tasks)).toMatchObject({ id: 'air', target: 'ls' });
      if (day === 2) expect(by('wall')).toMatchObject({ target: 'ws', n: 1 });
      if (day === 3) expect(by('wall')).toMatchObject({ n: 2 });
      if (day === 6) expect(by('wallOrRover')).toMatchObject({ n: 3 });
      if (day === 7) expect(by('launch')?.target).toBe('launch');
      expect(by('sleep')?.target).toBeUndefined();
    });
  });

  it('day 5: saving two batteries is ticked by what is left, during the plan and after it', () => {
    playPlanA((day, { planned, night }) => {
      if (day !== 5) return;
      expect(flags(planned).save).toBe(true); // Plan A leaves 4 on the hub
      expect(night.game?.bat).toBe(2);
      expect(flags(night).save).toBe(true);
      // (everyone inside leaves the rover and the workshop shut: open them to spend more)
      const spent = run(planned, [{ type: 'CHOOSE', shelter: 'half' }, { type: 'SET', k: 'ws' }, { type: 'SET', k: 'sc' }]);
      expect(spent.preview?.left).toBeLessThan(2);
      expect(flags(spent).save).toBe(false);
    });
  });

  it('day 7 needs four batteries on the ship: without them no launch task, no ladder, no star', () => {
    playPlanA((day, { planned }) => {
      if (day !== 7) return;
      const noShip = reducer(planned, { type: 'SET', k: 'launch', delta: -1 });
      expect(noShip.alloc.launch).toBe(0);
      expect(flags(noShip).launch).toBe(false);
      const after = reducer(noShip, { type: 'CONFIRM' });
      expect(after.game?.launched).toBe(false);
      expect(flags(after)).toMatchObject({ launch: false, ladder: false, arm: true });
      expect(dayStar(after)).toBe(false);
    });
  });

  it('on another week every day still has five different tasks that can be done', () => {
    // A quiet week with a storm on day 3 only: the dealt cards land elsewhere, so the decision tasks must follow.
    const base = realWeek();
    const other: Week = {
      id: '2030-01-01',
      kind: 'storm',
      days: base.days.map((d) => ({ ...d, level: d.day === 3 ? 2 : 0, alert: false })),
    };
    let m = reducer(initialModel, { type: 'START', week: other, seed: 5 });
    for (let day = 1; day <= 7; day++) {
      m = reducer(m, { type: 'NEXT' });
      const tasks: Task[] = dayTasks(m);
      expect(tasks).toHaveLength(5);
      expect(new Set(tasks.map((t) => t.id)).size).toBe(5);
      const card = m.game!.cards[day - 1];
      const answerable = !!card && CARD_CHOICES[card].length > 0;
      const hasCardTask = tasks.some((t) => t.id.startsWith('card'));
      expect(hasCardTask, `day ${day} card ${card}`).toBe(answerable);
      if (day === 3) expect(tasks.some((t) => t.id === 'shelter' || t.id === 'inside')).toBe(true);
      else expect(tasks.some((t) => t.id === 'shelter' || t.id === 'inside')).toBe(false);
      if (answerable) m = reducer(m, { type: 'CHOOSE', card: `${card}:${CARD_CHOICES[card!][0]}` });
      m = run(m, [{ type: 'CONFIRM' }, { type: 'NEXT' }]);
      if (m.phase === 'night') m = reducer(m, { type: 'NEXT' });
    }
  });
});

import { describe, expect, it } from 'vitest';
import { initialModel, reducer, toView, type Action, type Model } from './game';
import { bedtime, indoorsToday } from './homeDay';
import { dayStar, dayTasks } from './tasks';
import { CARD_CHOICES, dayInfo } from '../engine/rules';
import { week as realWeek } from '../engine/golden';

const start = () => reducer(initialModel, { type: 'START', week: realWeek() });
const run = (m: Model, actions: Action[]) => actions.reduce(reducer, m);

/** Plays the open day with nothing on Life Support (answering a card with its first choice): the air runs out. */
function idleDay(m: Model): Model {
  const plan = m.phase === 'morning' ? reducer(m, { type: 'NEXT' }) : m;
  const info = dayInfo(plan.game!, plan.week!);
  const answered = info.card && CARD_CHOICES[info.card].length ? reducer(plan, { type: 'CHOOSE', card: `${info.card}:${CARD_CHOICES[info.card][0]}` }) : plan;
  return reducer(answered, { type: 'CONFIRM' });
}

/** Days 1–3 with no air made: Day 4 is the backup-tank day (the engine's `forced`). Returns Day 4's morning. */
function toBackupDay(): Model {
  let m = start();
  for (let d = 1; d <= 3; d++) m = run(idleDay(m), [{ type: 'NEXT' }, { type: 'NEXT' }]);
  return m;
}

describe('inside all day (home story)', () => {
  it('is the full shelter while a day is planned or runs, never in the morning, at night or at the end', () => {
    expect(indoorsToday('plan', 'full')).toBe(true);
    expect(indoorsToday('run', 'full')).toBe(true);
    for (const sh of ['none', 'half'] as const) expect(indoorsToday('plan', sh)).toBe(false);
    for (const ph of ['morning', 'night', 'launch', 'truth'] as const) expect(indoorsToday(ph, 'full')).toBe(false);
  });

  it('a storm day: "Stay inside all day" puts the View indoors, another shelter takes it back out', () => {
    // the first mission's storms: days 5 and 6 offer the shelter choice
    let m = start();
    for (let d = 1; d <= 4; d++) {
      const plan = reducer(m, { type: 'NEXT' });
      const info = dayInfo(plan.game!, plan.week!);
      const card = info.card && CARD_CHOICES[info.card].length ? [{ type: 'CHOOSE', card: `${info.card}:${CARD_CHOICES[info.card][0]}` } as Action] : [];
      const sh = info.choice ? [{ type: 'CHOOSE', shelter: 'half' } as Action] : [];
      const filled = run(plan, [...card, ...sh, { type: 'SET', k: 'ls' }, { type: 'SET', k: 'ls' }, { type: 'SET', k: 'ls' }]);
      m = run(filled, [{ type: 'CONFIRM' }, { type: 'NEXT' }, { type: 'NEXT' }]);
    }
    const day5 = reducer(m, { type: 'NEXT' });
    expect(toView(day5).day).toBe(5);
    expect(dayInfo(day5.game!, day5.week!).choice).toBe(true);
    expect(toView(day5).indoors).toBe(false);
    const inside = reducer(day5, { type: 'CHOOSE', shelter: 'full' });
    expect(toView(inside).indoors).toBe(true);
    // the base is run from inside: batteries still go onto the machines from the Plan list (SET)
    const placed = run(inside, [{ type: 'SET', k: 'ls' }, { type: 'SET', k: 'ls' }, { type: 'SET', k: 'gh' }]);
    expect(placed.alloc).toMatchObject({ ls: 2, gh: 1 });
    // Today's 5 on Day 5: "Stay inside" ticks
    expect(dayTasks(placed).find((t) => t.id === 'inside')?.done).toBe(true);
    const running = reducer(placed, { type: 'CONFIRM' });
    expect(toView(running).indoors).toBe(true);
    expect(toView(reducer(running, { type: 'NEXT' })).indoors).toBe(false); // night: in bed, not "inside all day"
    expect(toView(reducer(inside, { type: 'CHOOSE', shelter: 'none' })).indoors).toBe(false);
  });

  it('the backup-tank day: indoors, one task (rest), ticked once the day runs; the next day has five again', () => {
    const morning = toBackupDay();
    expect(morning.game!.forced).toBe(true);
    expect(dayTasks(morning)).toEqual([{ id: 'rest', done: false }]);
    const plan = reducer(morning, { type: 'NEXT' });
    expect(toView(plan).indoors).toBe(true);
    expect(dayTasks(plan)).toEqual([{ id: 'rest', done: false }]);
    expect(dayStar(plan)).toBe(false);
    const running = reducer(plan, { type: 'CONFIRM' });
    expect(toView(running).day).toBe(4);
    expect(toView(running).indoors).toBe(true);
    expect(dayTasks(running)).toEqual([{ id: 'rest', done: true }]);
    expect(dayStar(running)).toBe(true);
    const night = reducer(running, { type: 'NEXT' });
    expect(dayTasks(night)).toEqual([{ id: 'rest', done: true }]);
    const day5 = run(night, [{ type: 'NEXT' }, { type: 'NEXT' }]);
    expect(day5.game!.forced).toBe(false);
    expect(dayTasks(day5)).toHaveLength(5);
  });
});

describe('bedtime (sleep at the door)', () => {
  it('waits for Sleep once a day of Days 1–6 has run; never on Day 7 (the launch) or in other phases', () => {
    for (let d = 1; d <= 6; d++) expect(bedtime('run', d)).toBe(true);
    expect(bedtime('run', 7)).toBe(false);
    for (const ph of ['morning', 'plan', 'night', 'launch', 'truth'] as const) expect(bedtime(ph, 3)).toBe(false);
  });
});

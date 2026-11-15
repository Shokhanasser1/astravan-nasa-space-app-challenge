import { describe, expect, it } from 'vitest';
import { P, result, sciTarget } from '../engine/rules';
import { WEEKS } from '../engine/week';
import { initialModel, reducer, toView, type Action, type Model } from './game';

// 15 Nov audit: at night the day badge showed the NEXT day's level next to the played day's ratio.
describe('view: the level belongs to the day shown', () => {
  const week = WEEKS.find((w) => w.id === '2021-10-25')!; // levels 0 0 0 1 2 2 1, day 4 is an alert day

  function toNight(day: number): Model {
    let m: Model = reducer(initialModel, { type: 'START', week, seed: 1, firstMission: true });
    const go = (a: Action) => (m = reducer(m, a));
    for (let d = 1; d <= day; d++) {
      go({ type: 'NEXT' }); // morning → plan
      if (m.preview?.warning === 'engine.warn.chooseCard') go({ type: 'CHOOSE', card: `${m.game!.cards[d - 1]}:${d === 2 ? 'heat' : 'skip'}` });
      go({ type: 'SET', k: 'ls' });
      go({ type: 'SET', k: 'ls' });
      go({ type: 'CONFIRM' }); // → run
      if (d < day) {
        go({ type: 'NEXT' }); // → night
        go({ type: 'NEXT' }); // → next morning
      }
    }
    return m;
  }

  it('the alert day stays unknown while it runs, then shows its real level at night', () => {
    const run = toNight(4);
    expect(run.phase).toBe('run');
    expect(toView(run)).toMatchObject({ day: 4, alert: true, level: 0 });
    const night = reducer(run, { type: 'NEXT' });
    expect(night.phase).toBe('night');
    expect(toView(night)).toMatchObject({ day: 4, level: 1, ratio: week.days[3].ratio });
  });

  it('the night after day 3 shows day 3 (level 0), not day 4', () => {
    const night = reducer(toNight(3), { type: 'NEXT' });
    expect(toView(night)).toMatchObject({ day: 3, level: 0 });
  });
});

// 15 Nov home story step 2: Ship % = science points over the week's high-science target (result()), capped at 100.
describe('view: ship repair %', () => {
  const week = WEEKS.find((w) => w.id === '2021-10-25')!; // a storm week: target 14

  it('reads the same target result() uses', () => {
    expect(sciTarget(week)).toBe(14);
    expect(sciTarget(week)).toBe(P.thresholds.storm.sci);
    const severe = WEEKS.find((w) => w.kind === 'severe')!;
    expect(sciTarget(severe)).toBe(P.thresholds.severe.sci);
  });

  it('starts at 0 %', () => {
    const m = reducer(initialModel, { type: 'START', week, seed: 1, firstMission: true });
    expect(toView(m).res?.ship).toBe(0);
  });

  it('is sci ÷ target × 100, rounded, after a day of exploring', () => {
    let m: Model = reducer(initialModel, { type: 'START', week, seed: 1, firstMission: true });
    m = reducer(m, { type: 'NEXT' }); // morning → plan
    for (let i = 0; i < 3; i++) m = reducer(m, { type: 'SET', k: 'sc' });
    m = reducer(m, { type: 'CONFIRM' });
    const res = toView(m).res!;
    expect(res.sci).toBeGreaterThan(0);
    expect(res.sci).toBe(result(m.game!, week).science);
    expect(res.ship).toBe(Math.round((res.sci / result(m.game!, week).highSci) * 100));
  });

  it('stops at 100 % when science passes the target', () => {
    const m = reducer(initialModel, { type: 'START', week, seed: 1, firstMission: true });
    expect(toView({ ...m, game: { ...m.game!, sci: 14 } }).res?.ship).toBe(100);
    expect(toView({ ...m, game: { ...m.game!, sci: 30 } }).res?.ship).toBe(100);
    expect(toView({ ...m, game: { ...m.game!, sci: 7 } }).res?.ship).toBe(50);
  });
});

import { describe, expect, it } from 'vitest';
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

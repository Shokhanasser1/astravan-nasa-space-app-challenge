import { describe, expect, it } from 'vitest';
import { reducer, type Action, type Model } from './game';
import { demoModel } from './demo';
import { launchWarning, pressLaunch, warningId } from './launch';

const run = (m: Model, actions: Action[]) => actions.reduce(reducer, m);
/** Day 7's plan, from the judge link (Plan A days 1–6: ship 12 of 14 parts = 86 %). */
const day7 = () => reducer(demoModel('launch')!, { type: 'NEXT' });
/** The ship charged with four batteries, whatever the board opened with. */
const charge = (m: Model) => (m.alloc.launch >= 4 ? m : run(m, [{ type: 'TAKE' }, { type: 'TAKE' }, { type: 'TAKE' }, { type: 'TAKE' }, { type: 'PUT', k: 'launch' }]));

describe("Day 7's launch button (home story)", () => {
  it('warns that the ship has no power while it has fewer than four batteries', () => {
    const m = day7();
    const empty = m.alloc.launch >= 4 ? reducer(m, { type: 'SET', k: 'launch', delta: -1 }) : m;
    expect(empty.alloc.launch).toBe(0);
    expect(launchWarning(empty)).toEqual({ key: 'engine.warn.noLaunch' });
  });

  it("charged, it tells how ready the ship is after today's rover runs, and nothing once it is 100 %", () => {
    const m = charge(day7());
    expect(launchWarning(m)).toEqual({ key: 'ui.launch.notReady', n: 86 });
    const one = reducer(m, { type: 'SET', k: 'sc' });
    expect(launchWarning(one)).toEqual({ key: 'ui.launch.notReady', n: 93 });
    const two = reducer(one, { type: 'SET', k: 'sc' }); // Plan A's last two rover runs: 14 of 14
    expect(launchWarning(two)).toBeNull();
  });

  it('says nothing on other days or outside the plan', () => {
    const morning = demoModel('launch')!;
    expect(launchWarning(morning)).toBeNull();
    expect(launchWarning(reducer(demoModel('storm')!, { type: 'NEXT' }))).toBeNull();
    const flown = run(charge(day7()), [{ type: 'CONFIRM' }]);
    expect(launchWarning(flown)).toBeNull();
  });

  it('first press shows the warning, the second goes on; a new warning is shown again first', () => {
    const notReady = { key: 'ui.launch.notReady', n: 40 } as const;
    expect(pressLaunch(null, null)).toEqual({ go: true });
    expect(pressLaunch(null, notReady)).toEqual({ go: false, show: 'ui.launch.notReady:40' });
    expect(pressLaunch('ui.launch.notReady:40', notReady)).toEqual({ go: true });
    // the child added a rover run after the warning: 40 → 47 is news, shown before launching
    expect(pressLaunch('ui.launch.notReady:40', { ...notReady, n: 47 })).toEqual({ go: false, show: 'ui.launch.notReady:47' });
    expect(pressLaunch('ui.launch.notReady:47', { key: 'engine.warn.noLaunch' })).toEqual({ go: false, show: 'engine.warn.noLaunch' });
    expect(pressLaunch('engine.warn.noLaunch', { key: 'engine.warn.noLaunch' })).toEqual({ go: true });
    expect(warningId(null)).toBeNull();
  });

  it('pressed through without power, the week ends late (Late Ride Home); charged and pressed twice, the ship flies', () => {
    const m = day7();
    const empty = m.alloc.launch >= 4 ? reducer(m, { type: 'SET', k: 'launch', delta: -1 }) : m;
    const late = run(empty, [{ type: 'CONFIRM' }, { type: 'NEXT' }]);
    expect(late.game?.late).toBe(true);
    expect(late.phase).toBe('truth');
    const flown = run(charge(day7()), [{ type: 'CONFIRM' }, { type: 'NEXT' }]);
    expect(flown.game?.launched).toBe(true);
    expect(flown.phase).toBe('launch');
  });
});

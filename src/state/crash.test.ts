import { describe, expect, it } from 'vitest';
import { getCrashStage, reachDone, setCrashStage } from './crash';
import { crashMorning, initialModel, reducer, toView, type Model } from './game';
import { week as realWeek } from '../engine/golden';
import { features } from '../config/features';

describe('the crash walk (home story T2)', () => {
  it('counts "Reach the base" done at the door, inside, or after the morning', () => {
    expect(reachDone('morning', 'walk')).toBe(false);
    expect(reachDone('morning', 'door')).toBe(true);
    expect(reachDone('morning', 'in')).toBe(true);
    expect(reachDone('plan', 'walk')).toBe(true);
  });

  it('keeps one stage and changes only when told', () => {
    setCrashStage('door');
    expect(getCrashStage()).toBe('door');
    setCrashStage('walk');
    expect(getCrashStage()).toBe('walk');
  });
});

describe('View.crash: only the first mission\'s Day 1 morning opens at the crash site', () => {
  const on = features.homeStory && features.homeStoryCrash;
  const start = (firstMission: boolean): Model => reducer(initialModel, { type: 'START', week: realWeek(), firstMission });

  it('follows the flag on the first morning, never on a later mission', () => {
    expect(crashMorning(start(true))).toBe(on);
    expect(toView(start(true)).crash ?? false).toBe(on);
    expect(crashMorning(start(false))).toBe(false);
    expect(toView(start(false)).crash).toBeUndefined();
  });

  it('ends with the morning (Next) and never comes back on Day 1 or later', () => {
    const plan = reducer(start(true), { type: 'NEXT' });
    expect(crashMorning(plan)).toBe(false);
    expect(toView(plan).crash).toBeUndefined();
    expect(crashMorning(initialModel)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { dayGoal, radioLine, tutorialSay, tutorialStep, tutorialTarget, tutorialTask, type DayFacts, type TutInput } from './tutorial';

const NONE = { ls: 0, gh: 0, ws: 0, sc: 0, launch: 0 };
const base: TutInput = { phase: 'plan', day: 1, firstMission: true, hands: 0, alloc: NONE, aim: null, free: 6 };
const at = (o: Partial<TutInput>) => tutorialStep({ ...base, ...o });

describe('tutorial steps (first mission, Day 1)', () => {
  it('walks the player through the whole first plan', () => {
    expect(at({ phase: 'morning' })).toBe('next');
    expect(at({})).toBe('walkHub');
    expect(at({ aim: 'hub' })).toBe('take');
    expect(at({ aim: 'hub', hands: 1, free: 5 })).toBe('carryLs');
    expect(at({ aim: 'ls', hands: 1, free: 5 })).toBe('putLs');
    expect(at({ aim: 'ls', alloc: { ...NONE, ls: 1 }, free: 5 })).toBe('moreGh');
    expect(at({ alloc: { ...NONE, ls: 1, gh: 1 }, free: 4 })).toBe('rest');
    expect(at({ alloc: { ...NONE, ls: 2, gh: 1 }, free: 3 })).toBe('confirm');
    expect(at({ alloc: { ...NONE, ls: 1, gh: 1 }, free: 0, hands: 0 })).toBe('confirm');
  });

  it('keeps asking for the rest while batteries are still in the hands', () => {
    expect(at({ alloc: { ...NONE, ls: 1, gh: 1 }, free: 0, hands: 2 })).toBe('rest');
  });

  it('is off after Day 1, outside the first mission and in the other phases', () => {
    expect(at({ day: 2 })).toBeNull();
    expect(at({ firstMission: false })).toBeNull();
    expect(at({ phase: 'run' })).toBeNull();
    expect(at({ phase: 'night' })).toBeNull();
  });

  it('puts the beacon where the next battery goes', () => {
    expect(tutorialTarget('walkHub', 0)).toBe('hub');
    expect(tutorialTarget('carryLs', 1)).toBe('ls');
    expect(tutorialTarget('moreGh', 0)).toBe('hub');
    expect(tutorialTarget('moreGh', 1)).toBe('gh');
    expect(tutorialTarget('confirm', 0)).toBeNull();
    expect(tutorialTask('moreGh', 1)).toBe('ui.tut.carryGh.task');
    expect(tutorialTask('take', 0)).toBe('ui.tut.take.task');
  });
});

const day = (o: Partial<DayFacts>): DayFacts => ({ day: 3, phase: 'plan', card: null, choice: false, alert: false, forced: false, ...o });

describe('day goals and radio lines (scenario, Act 2)', () => {
  it('gives every day its own goal', () => {
    expect(dayGoal(day({ day: 2, card: 'shadow' }))).toEqual({ key: 'ui.goal.workshop', target: 'ws' });
    expect(dayGoal(day({ day: 3, card: 'ice' }))?.key).toBe('ui.goal.ice');
    expect(dayGoal(day({ day: 4, alert: true, choice: true }))?.key).toBe('ui.goal.alert');
    expect(dayGoal(day({ day: 5, choice: true }))?.key).toBe('ui.goal.storm');
    expect(dayGoal(day({ day: 6, choice: true }))?.key).toBe('ui.goal.harvest');
    expect(dayGoal(day({ day: 7 }))).toEqual({ key: 'ui.goal.launch', target: 'launch' });
    expect(dayGoal(day({ phase: 'night' }))).toBeNull();
  });

  it('lets the Day 4 family call and the Day 7 launch line through', () => {
    const r = (o: Partial<DayFacts> & { storm?: string | null; watch?: boolean }) =>
      radioLine({ ...day(o), storm: o.storm ?? null, watch: o.watch ?? false });
    expect(r({ day: 4, phase: 'morning', storm: 'alert', alert: true })).toBe('story.radio.family');
    expect(r({ day: 4, phase: 'plan', storm: 'alert', alert: true })).toBe('story.radio.callCut');
    expect(r({ day: 7, phase: 'morning', storm: 'storm' })).toBe('story.radio.launchDay');
    expect(r({ day: 7, phase: 'plan', storm: 'storm' })).toBe('story.radio.launchDay');
    expect(r({ day: 5, phase: 'plan', storm: 'storm' })).toBe('story.radio.storm');
    expect(r({ day: 2, phase: 'plan', watch: true })).toBe('story.radio.workshop');
    expect(r({ day: 2, phase: 'morning', watch: true })).toBe('story.radio.watch');
    expect(r({ day: 3, forced: true })).toBe('story.radio.emergency');
    expect(r({ phase: 'night' })).toBeNull();
  });
});

describe('the crash start (home story T2)', () => {
  const crash = (o: Partial<TutInput>) => at({ phase: 'morning', crash: true, ...o });

  it('walks to the base light, goes in at the door, then Next with Houston', () => {
    expect(crash({})).toBe('reach');
    expect(crash({ crashStage: 'walk' })).toBe('reach');
    expect(crash({ crashStage: 'door' })).toBe('enter');
    expect(crash({ crashStage: 'in' })).toBe('next');
  });

  it('puts the beacon at the habitat door; the door step has no radio line of its own', () => {
    expect(tutorialTarget('reach', 0)).toBe('door');
    expect(tutorialTarget('enter', 0)).toBe('door');
    expect(tutorialTask('reach', 0)).toBe('ui.tut.reach.task');
    expect(tutorialSay('reach')).toBe('ui.tut.reach.say');
    expect(tutorialSay('enter')).toBeNull();
  });

  it('leaves the old start as it was without the crash, and the plan steps as they were after it', () => {
    expect(at({ phase: 'morning' })).toBe('next');
    expect(at({ phase: 'morning', crashStage: 'walk' })).toBe('next');
    expect(at({ crash: false })).toBe('walkHub');
  });
});

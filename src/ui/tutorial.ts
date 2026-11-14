import type { AimId } from '../controls/bus';
import type { Phase, View } from '../state/game';
import type { ObjectiveTarget } from '../state/objective';

/**
 * The first-mission tutorial (Day 1 only) and the goal line of every later day, as pure functions: the HUD feeds
 * them what it already reads from the view and the aim channel, and shows / speaks / beacons what they return.
 * They never compute a game number: they only look at counts the engine already put in the view.
 *
 * Tutorial steps (15 Nov, "make it a game"): press Next → walk to the power hub → take a battery → carry it to
 * Life Support → put it in → one more to the Garden → your call: spend the rest or save it → confirm the day.
 */
export type TutStep = 'next' | 'walkHub' | 'take' | 'carryLs' | 'putLs' | 'moreGh' | 'rest' | 'confirm';

export interface TutInput {
  phase: Phase;
  day: number;
  firstMission: boolean;
  /** Batteries in the astronaut's hands (View.hands). */
  hands: number;
  alloc: View['alloc'];
  /** What the astronaut faces (useAim). */
  aim: AimId | null;
  /** Free batteries at the hub (View.batteries.left − hands). */
  free: number;
}

export function tutorialStep(s: TutInput): TutStep | null {
  if (!s.firstMission || s.day !== 1) return null;
  if (s.phase === 'morning') return 'next';
  if (s.phase !== 'plan') return null;
  const { ls, gh, ws, sc } = s.alloc;
  if (ls < 1) {
    if (s.hands > 0) return s.aim === 'ls' ? 'putLs' : 'carryLs';
    return s.aim === 'hub' ? 'take' : 'walkHub';
  }
  if (gh < 1) return 'moreGh';
  // Garden done: the rest is the player's call until nothing is left to place or they placed something more.
  const more = ls > 1 || gh > 1 || ws > 0 || sc > 0;
  return more || (s.free === 0 && s.hands === 0) ? 'confirm' : 'rest';
}

/** Where the beacon of a tutorial step stands. */
export function tutorialTarget(step: TutStep, hands: number): ObjectiveTarget {
  switch (step) {
    case 'walkHub':
    case 'take':
      return 'hub';
    case 'carryLs':
    case 'putLs':
      return 'ls';
    case 'moreGh':
      return hands > 0 ? 'gh' : 'hub';
    default:
      return null;
  }
}

/** Task line key of a step (ui.tut.<step>.task) and the CAPCOM line said with it (ui.tut.<step>.say). */
export const tutorialTask = (step: TutStep, hands: number) =>
  step === 'moreGh' && hands > 0 ? 'ui.tut.carryGh.task' : `ui.tut.${step}.task`;
export const tutorialSay = (step: TutStep) => `ui.tut.${step}.say`;

// ---- the day's goal after the tutorial (scenario, Act 2: every day has its own new thing) ----

export interface DayFacts {
  day: number;
  phase: Phase;
  /** Today's day card (engine dayInfo.card), the shelter choice, the flare alert, a forced day. */
  card: string | null;
  choice: boolean;
  alert: boolean;
  forced: boolean;
}

export interface Goal {
  key: string;
  target: ObjectiveTarget;
}

/** The "Today's goal" line for the morning and the plan phase; null at night and in the end screens. */
export function dayGoal(f: DayFacts): Goal | null {
  if (f.phase !== 'morning' && f.phase !== 'plan') return null;
  if (f.forced) return { key: 'ui.goal.forced', target: null };
  if (f.day === 7) return { key: 'ui.goal.launch', target: 'launch' };
  if (f.alert) return { key: 'ui.goal.alert', target: null };
  if (f.choice) return { key: f.day === 6 ? 'ui.goal.harvest' : 'ui.goal.storm', target: null };
  if (f.day === 2) return { key: 'ui.goal.workshop', target: 'ws' };
  if (f.card === 'ice') return { key: 'ui.goal.ice', target: 'sc' };
  if (f.day === 3) return { key: 'ui.goal.alone', target: null };
  if (f.day === 6) return { key: 'ui.goal.harvest', target: 'gh' };
  if (f.card) return { key: 'ui.goal.card', target: null };
  return { key: 'ui.goal.balance', target: 'ls' };
}

/**
 * Which radio line to play. Choice of words only. Priority fix (15 Nov): the Day 4 family call plays in the
 * morning and the flare cuts it in the plan; Day 7's launch line wins over a storm line in the morning.
 */
export function radioLine(f: DayFacts & { storm: string | null; watch: boolean }): string | null {
  if (f.phase !== 'morning' && f.phase !== 'plan') return null;
  if (f.forced) return 'story.radio.emergency';
  if (f.phase === 'morning') {
    if (f.day === 1) return 'story.radio.day1';
    if (f.day === 4) return 'story.radio.family';
    if (f.day === 7) return 'story.radio.launchDay';
  }
  if (f.storm === 'alert') return f.day === 4 ? 'story.radio.callCut' : 'story.radio.alert';
  if (f.day === 7) return 'story.radio.launchDay';
  if (f.storm === 'storm') return 'story.radio.storm';
  if (f.phase === 'plan' && f.day === 2) return 'story.radio.workshop';
  if (f.watch) return 'story.radio.watch';
  if (f.day === 6) return 'story.radio.harvest';
  return 'story.radio.quiet';
}

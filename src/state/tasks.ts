/**
 * "Today's 5" (home story, docs/plans/2026-11-15-home-story.md step 3; Shoxjahon aka's document, 15 Nov, pp. 14–17):
 * five small tasks a day, each one an action the game already has, ticked from the model — the child never ticks
 * anything. All five done = the day's star (src/state/stars.ts). A star is a reward, never a penalty: the game goes on
 * without it.
 *
 * The table is the document's, written for the first mission (week 2021-10-25: Shadow card on Day 2, Ice on Day 3,
 * flare alert on Day 4, storms on Days 5–6). On another week the decision task of a day follows that day's real
 * content (its card, or the shelter choice of a storm day), so every task can always be done.
 *
 * Pure: reads the model and the engine's constants, computes no game number.
 */
import { CARD_CHOICES, P, dayInfo, type CardId } from '../engine/rules';
import { shownDay, type Model } from './game';

export type TaskId =
  | 'reach' | 'air' | 'greenhouse' | 'rover' | 'sleep' | 'cardShadow' | 'cardIce' | 'card' | 'wall' | 'call'
  | 'shelter' | 'inside' | 'save' | 'harvest' | 'wallOrRover' | 'roverLast' | 'launch' | 'arm' | 'ladder';

/** Where the beacon stands for a task (an ObjectiveTarget of src/state/objective.ts). */
export type TaskTarget = 'ls' | 'gh' | 'ws' | 'sc' | 'launch' | 'hub';

export interface Task {
  /** Text key ui.task.<id>. */
  id: TaskId;
  done: boolean;
  /** The machine to point the beacon at; none for decisions and sleep. */
  target?: TaskTarget;
  /** The number in the text, {n} (wall level for `wall` and `wallOrRover`). */
  n?: number;
  /** The star never waits for it (Day 7's robot arm): it ticks when done, and counts as done for the star anyway. */
  optional?: boolean;
}

/**
 * What the game saw outside the model today (the HUD passes it): `arm` = the robot arm's scanner was switched on at
 * least once on the day shown (src/arm/state.ts armState.on).
 */
export interface Seen {
  arm?: boolean;
}

/** The document's table (p. 16), by day. */
const TABLE: Record<number, TaskId[]> = {
  1: ['reach', 'air', 'greenhouse', 'rover', 'sleep'],
  2: ['cardShadow', 'air', 'greenhouse', 'wall', 'sleep'],
  3: ['cardIce', 'air', 'greenhouse', 'wall', 'sleep'],
  4: ['call', 'shelter', 'air', 'greenhouse', 'sleep'],
  5: ['inside', 'air', 'greenhouse', 'save', 'sleep'],
  6: ['shelter', 'air', 'harvest', 'wallOrRover', 'sleep'],
  7: ['air', 'roverLast', 'launch', 'arm', 'ladder'],
};

const TARGET: Partial<Record<TaskId, TaskTarget>> = {
  reach: 'hub', air: 'ls', greenhouse: 'gh', harvest: 'gh', rover: 'sc', roverLast: 'sc', wall: 'ws', wallOrRover: 'ws',
  launch: 'launch',
};

const CARD_TASKS: TaskId[] = ['cardShadow', 'cardIce', 'card'];
const SHELTER_TASKS: TaskId[] = ['shelter', 'inside'];
/** Replaces a decision the day does not have (another week), first one not in the list yet. */
const FALLBACK: TaskId[] = ['rover', 'save', 'wall'];

/** The task of a day card; none for a card with nothing to answer (Request, Sunrise). */
function cardTask(card: CardId | null): TaskId | null {
  if (!card || !CARD_CHOICES[card].length) return null;
  return card === 'shadow' ? 'cardShadow' : card === 'ice' ? 'cardIce' : 'card';
}

/** The day's ids: the table, its decision tasks fitted to the day's real card and shelter choice. */
function idsOf(day: number, card: CardId | null, choice: boolean): TaskId[] {
  const out: TaskId[] = [];
  for (const id of TABLE[day]) {
    let real: TaskId | null = id;
    if (CARD_TASKS.includes(id)) real = cardTask(card) ?? (choice ? 'shelter' : null);
    else if (SHELTER_TASKS.includes(id)) real = choice ? id : cardTask(card);
    if (!real || out.includes(real)) real = FALLBACK.find((f) => !out.includes(f) && !TABLE[day].includes(f)) ?? null;
    if (real) out.push(real);
  }
  return out;
}

/** The five tasks of the day being shown (during run and night: the day just played); none before a game starts. */
export function dayTasks(model: Model, seen: Seen = {}): Task[] {
  const g = model.game;
  if (!g || !model.week) return [];
  const day = shownDay(model);
  // The day's content from the engine: its dealt card and whether it is a storm day (forced = an emergency, not content).
  const info = dayInfo({ ...g, day, forced: false }, model.week);
  const played = model.phase === 'run' || model.phase === 'night' || model.phase === 'launch' || model.phase === 'truth';
  const a = model.alloc;
  const answer = model.cardChoice ?? model.picks?.[day];
  // The wall level today's two Workshop batteries make: the wall this day started with + 1.
  const wallAtStart = played ? (g.days.find((r) => r.day === day)?.wall ?? g.wall) : g.wall;
  const wallN = Math.min(P.maxWall, wallAtStart + 1);

  const done = (id: TaskId): boolean => {
    switch (id) {
      case 'reach': // the doc: within 6 m of the habitat door, or Next pressed; the model knows the second
      case 'call': // Day 4's call from home plays in the morning
        return model.phase !== 'morning';
      case 'air': // enough for the crew: the reserve does not fall
        return a.ls >= P.crewUse;
      case 'greenhouse':
      case 'harvest':
        return a.gh >= 1;
      case 'rover':
      case 'roverLast':
        return a.sc >= 1;
      case 'wall':
        return a.build >= P.wallCost;
      case 'wallOrRover':
        return a.build >= P.wallCost || a.sc >= 1;
      case 'cardShadow':
      case 'cardIce':
      case 'card':
        return !!info.card && !!answer && answer.startsWith(`${info.card}:`);
      case 'shelter':
        return a.shelter !== 'none';
      case 'inside':
        return a.shelter === 'full';
      case 'save': // batteries left at the end of the day (stored for tomorrow, at most P.maxStored)
        return played ? g.bat >= P.maxStored : (model.preview?.left ?? 0) >= P.maxStored;
      case 'launch':
        return a.launch >= P.launchCost;
      case 'arm': // the doc (p. 17): the robot arm's scanner switched on once; optional, the star is given without it
        return !!seen.arm;
      case 'sleep':
        return played;
      case 'ladder':
        return played && g.launched;
    }
  };

  return idsOf(day, info.card, info.choice).map((id) => {
    const t: Task = { id, done: done(id) };
    if (TARGET[id]) t.target = TARGET[id];
    if (id === 'wall' || id === 'wallOrRover') t.n = wallN;
    if (id === 'arm') t.optional = true;
    return t;
  });
}

/** Done for the star: done, or optional (Day 7's robot arm). */
export const settled = (t: Task): boolean => t.done || !!t.optional;

/** The first task still to do (the beacon follows it; an optional one never holds it), or null when all are settled. */
export function firstOpen(tasks: readonly Task[]): Task | null {
  return tasks.find((t) => !settled(t)) ?? null;
}

/** The day's star: all five tasks done (an optional one counts either way). */
export function dayStar(model: Model, seen: Seen = {}): boolean {
  const tasks = dayTasks(model, seen);
  return tasks.length === 5 && tasks.every(settled);
}

/**
 * Decision buttons in words (home story; the lead's document p. 5: «1 batareya ketadi. Ferma sog' qoladi» instead of
 * "7 left · 6→4 · 2→1") and pieces instead of fractions ("8 of 10 blocked" instead of "77%" or "+0.07").
 *
 * Every number comes from the engine: each answer of a day card is compared with the same plan and no answer at all
 * (engine `preview`, `limits`, `confirm`, `result`), so a line says what that answer itself does. An answer gets a
 * "stays safe" / "no battery" line where its sibling loses or pays something, so the two buttons read side by side.
 * Pure; returns text keys (ui.say.*) and their numbers, never words.
 */
import { confirm, limits, preview, result, type Shelter } from '../engine/rules';
import type { Board, Model } from './game';

export interface Say {
  key: string;
  vars?: Record<string, number>;
}

/** A share (0..1) as pieces of ten, for "8 of 10 blocked". */
export const tenths = (share: number) => Math.max(0, Math.min(10, Math.round(share * 10)));

interface Fx {
  value: string;
  cost: number;
  air: number; // tonight vs no answer
  airEvery: boolean; // the answer takes air every day from now on (Filter: wait)
  food: number;
  parts: number;
  batEvery: number; // batteries lost every day from tomorrow (Dust: leave)
  roverMax: number | null; // a lower rover limit today than with no answer
  health: number;
  needRover: boolean;
}

/** What each answer of today's card does, against the same plan with no answer. */
function effects(m: Model, board: Board): Fx[] {
  const g = m.game!;
  const week = m.week!;
  return board.cardOptions.map(({ value }) => {
    // Ice "go" means sending the rover: the engine counts it only with a rover battery, so it is priced with one.
    const sends = value === 'ice:go';
    const alloc = sends && board.alloc.sc < 1 ? { ...board.alloc, sc: 1 } : board.alloc;
    const base = preview(g, week, alloc);
    const mine = preview(g, week, alloc, value);
    const limMine = limits(g, week, alloc.shelter, value);
    const limBase = limits(g, week, alloc.shelter);
    const nextMine = confirm(g, week, alloc, value);
    const nextBase = confirm(g, week, alloc);
    return {
      value,
      cost: limMine.cardCost,
      air: mine.reserveAfter - base.reserveAfter,
      airEvery: nextMine.filter && !nextBase.filter,
      food: mine.gardenAfter - base.gardenAfter,
      parts: mine.sciToday - base.sciToday,
      batEvery: nextMine.dusty && !nextBase.dusty ? limits(nextBase, week).available - limits(nextMine, week).available : 0,
      roverMax: limMine.max.sc < limBase.max.sc ? limMine.max.sc : null,
      health: result(nextMine, week).crew - result(nextBase, week).crew,
      needRover: sends && board.alloc.sc < 1,
    };
  });
}

/** The lines under each answer of today's day card, by answer ('shadow:heat' → lines). */
export function cardSays(m: Model, board: Board): Record<string, Say[]> {
  if (!m.game || !m.week) return {};
  const all = effects(m, board);
  const out: Record<string, Say[]> = {};
  for (const f of all) {
    const other = (test: (o: Fx) => boolean) => all.some((o) => o !== f && test(o));
    const lines: Say[] = [];
    if (f.cost > 0) lines.push({ key: f.cost === 1 ? 'ui.say.cost' : 'ui.say.costMany', vars: { n: f.cost } });
    else if (other((o) => o.cost > 0)) lines.push({ key: 'ui.say.free' });
    if (f.food < 0) lines.push({ key: 'ui.say.foodDown', vars: { n: -f.food } });
    else if (other((o) => o.food < 0)) lines.push({ key: 'ui.say.foodSafe' });
    if (f.airEvery) lines.push({ key: 'ui.say.airEvery', vars: { n: Math.max(1, -f.air) } });
    else if (f.air < 0) lines.push({ key: 'ui.say.airDown', vars: { n: -f.air } });
    else if (other((o) => o.air < 0 || o.airEvery)) lines.push({ key: 'ui.say.airSafe' });
    if (f.batEvery > 0) lines.push({ key: 'ui.say.batEvery', vars: { n: f.batEvery } });
    if (f.parts > 0) lines.push({ key: 'ui.say.parts', vars: { n: f.parts } });
    else if (other((o) => o.parts > 0)) lines.push({ key: 'ui.say.noParts' });
    if (f.roverMax !== null) lines.push({ key: 'ui.say.roverMax', vars: { n: f.roverMax } });
    if (f.health > 0) lines.push({ key: 'ui.say.healthUp' });
    else if (f.health < 0) lines.push({ key: 'ui.say.healthDown' });
    if (f.needRover) lines.push({ key: 'ui.say.needRover' });
    out[f.value] = lines.length ? lines : [{ key: 'ui.say.nothing' }];
  }
  return out;
}

/**
 * The lines under each shelter choice, when today's storm is known: how many of ten particles it blocks (computed)
 * and whether today's dose would cost health (the engine's result with today's dose added).
 */
export function shelterSays(m: Model, board: Board): Partial<Record<Shelter, Say[]>> {
  const g = m.game;
  const week = m.week;
  if (!g || !week || !board.info.known) return {};
  const now = result(g, week).crew;
  const out: Partial<Record<Shelter, Say[]>> = {};
  for (const { value, preview: p } of board.shelterOptions) {
    const lines: Say[] = [{ key: 'ui.say.blocked', vars: { n: tenths(p.blockedToday) } }];
    if (result({ ...g, extra: g.extra + p.doseToday }, week).crew < now) lines.push({ key: 'ui.say.healthDown' });
    out[value] = lines;
  }
  return out;
}

/**
 * Houston's plan (home story; the lead's document p. 5, "Taqsimlash boshqotirmasi": six to eight batteries over five
 * buildings is a puzzle for a 7–9-year-old, so one button puts a ready plan on the board and the child changes one
 * thing). The plan goes onto the board through the normal reducer actions (DROP, SET), so the reducer and the engine
 * still decide what fits; nothing here computes a game number.
 *
 * Which plan: on the first mission's week, the team's golden Plan A for today (src/engine/golden.ts) when it fits
 * today's batteries and limits as they are (the child's card answer and shelter stay the child's) and keeps the air
 * on; otherwise a plain plan from the engine's own limits: air steady, food steady (growing on harvest day), a wall
 * level while the Workshop is open, one rover run, the ship charged on Day 7, the rest saved.
 */
import { P, limits, playable, preview, type Alloc } from '../engine/rules';
import { PLAN_A } from '../engine/golden';
import { FIRST_WEEK, STEP, type Action, type Machine, type Model } from './game';

const KEY: Record<Machine, Exclude<keyof Alloc, 'shelter'>> = { ls: 'ls', gh: 'gh', ws: 'build', sc: 'sc', launch: 'launch' };
/** The board's own order (engine `playable`): launch first, the rover last. */
const ORDER: Machine[] = ['launch', 'ls', 'gh', 'ws', 'sc'];

const same = (a: Alloc, b: Alloc) => ORDER.every((k) => a[KEY[k]] === b[KEY[k]]);

/** Today's ready plan (batteries only; shelter and card answer stay as chosen), or null when there is no board. */
export function houstonAlloc(m: Model): Alloc | null {
  const g = m.game;
  const week = m.week;
  if (m.phase !== 'plan' || !g || !week || g.forced || g.day > 7) return null;
  const shelter = m.alloc.shelter;
  const card = m.cardChoice;

  const golden = week.id === FIRST_WEEK ? PLAN_A[g.day - 1] : undefined;
  if (golden) {
    const want: Alloc = { ...golden.alloc, shelter };
    if (same(playable(g, week, want, card), want) && preview(g, week, want, card).reserveAfter > 0) return want;
  }

  const lim = limits(g, week, shelter, card);
  const plain = (ls: number): Alloc =>
    playable(g, week, {
      launch: lim.max.launch,
      ls,
      gh: g.day === 7 ? 0 : g.day === 6 || g.plant <= 1 ? P.max.gh : 1,
      build: g.day < 7 && lim.max.build >= P.wallCost ? P.wallCost : 0,
      sc: Math.min(1, lim.max.sc),
      shelter,
    }, card);
  // Air steady: the fewest Air Maker batteries that keep tonight's reserve from falling (the engine's preview).
  for (let ls = Math.min(P.crewUse, lim.max.ls); ls <= lim.max.ls; ls++) {
    const a = plain(ls);
    if (preview(g, week, a, card).reserveAfter >= g.air) return a;
  }
  return plain(lim.max.ls);
}

/** The taps that put Houston's plan on today's board: hands emptied, extra batteries off, then the plan on. */
export function houstonActions(m: Model): Action[] {
  const want = houstonAlloc(m);
  if (!want) return [];
  const out: Action[] = [];
  if ((m.hands ?? 0) > 0) out.push({ type: 'DROP' });
  const steps = (k: Machine, from: number, to: number) => Math.max(0, Math.round((to - from) / STEP[k]));
  for (const k of ORDER) for (let i = steps(k, want[KEY[k]], m.alloc[KEY[k]]); i > 0; i--) out.push({ type: 'SET', k, delta: -1 });
  for (const k of ORDER) for (let i = steps(k, m.alloc[KEY[k]], want[KEY[k]]); i > 0; i--) out.push({ type: 'SET', k });
  return out;
}

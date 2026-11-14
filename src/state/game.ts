/**
 * One reducer → one View. Lane B. The scene and the UI only READ the view and the selectors below and DISPATCH
 * actions; they never compute game numbers. Actions: START · SET · CHOOSE · CONFIRM · NEXT · RESUME.
 * The `View` type is the only shared contract with the scene: add fields, never rename or remove them.
 * Day flow: morning (report) → plan (card, shelter, board) → run (≤ 6 s) → night (log) → … → launch → truth.
 */
import {
  CARD_CHOICES, confirm, dayInfo, limits, newGame, playable, preview, result,
  type Alloc, type CardId, type DayInfo, type Limits, type Preview, type Result, type Shelter, type State,
} from '../engine/rules';
import type { SkyDay, Week } from '../engine/week';

// ---- the contract with the scene (developer guide §02) ----
export type Phase = 'morning' | 'plan' | 'run' | 'night' | 'launch' | 'truth';

export type View = {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  level: 0 | 1 | 2 | 3 | 4;
  alert: boolean;
  alloc: { ls: number; gh: number; ws: number; sc: number; launch: number };
  wall: 0 | 1 | 2 | 3;
  plant: 0 | 1 | 2 | 3 | 4;
  shelter: 'none' | 'half' | 'full';
  phase: Phase;
  focus?: 'garden' | 'crater' | 'sun' | 'wing'; // where the camera looks
  // concept 3.0 additions (proposal — Samandar confirms or renames):
  sunAzDeg?: number; // sky.json, computed
  earthElDeg?: number;
  earthPhase?: number;
  ratio?: number; // today's (or this hour's) dose / normal, measured → dosimeter clicks, scout-cam snow
  batteries?: { left: number; total: number }; // power hub lights: total today, left = not placed yet
  // 15 Nov (engine owner Shoxjahon aka): where this day's real media lives — public/data/media/<weekId>/
  // (earth-<mediaDate>.webp, sdo-*.webp, manifest.json). File paths only: the date is never shown during play.
  weekId?: string;
  mediaDate?: string;
};

export type Machine = 'ls' | 'gh' | 'ws' | 'sc' | 'launch';

// ---- the model ----
export interface Model {
  week: Week | null;
  game: State | null;
  alloc: Alloc;
  cardChoice?: string;
  preview: Preview | null;
  phase: Phase;
  screen: 'start' | 'game' | 'end';
  seed: number;
  firstMission: boolean;
}

export type Action =
  | { type: 'START'; week: Week; seed?: number; firstMission?: boolean }
  | { type: 'SET'; k: Machine; delta?: 1 | -1 } // tap on a building: +1 battery (−1 = undo)
  | { type: 'CHOOSE'; shelter?: Shelter; card?: string } // card = 'shadow:heat'
  | { type: 'CONFIRM' }
  | { type: 'NEXT' }
  | { type: 'RESUME'; model: Model };

/** First mission (final version): always 25–31 Oct 2021, Shadow on day 2 and Ice on day 3 (golden plans). */
export const FIRST_WEEK = '2021-10-25';
export const FIRST_CARDS: CardId[] = ['shadow', 'ice'];

const EMPTY: Alloc = { ls: 0, gh: 0, build: 0, sc: 0, launch: 0, shelter: 'none' };
const KEY: Record<Machine, keyof Omit<Alloc, 'shelter'>> = { ls: 'ls', gh: 'gh', ws: 'build', sc: 'sc', launch: 'launch' };
const STEP: Record<Machine, number> = { ls: 1, gh: 1, ws: 2, sc: 1, launch: 4 };

export const initialModel: Model = {
  week: null, game: null, alloc: EMPTY, preview: null, phase: 'morning', screen: 'start', seed: 1, firstMission: true,
};

function withPreview(m: Model): Model {
  return m.game && m.week ? { ...m, preview: preview(m.game, m.week, m.alloc, m.cardChoice) } : m;
}

/** The board as the day opens: day 7 starts with four batteries on Launch; a forced day is already filled. */
function openBoard(m: Model): Model {
  if (!m.game || !m.week) return m;
  const base: Alloc = { ...EMPTY, launch: m.game.day === 7 ? 4 : 0 };
  return withPreview({ ...m, alloc: playable(m.game, m.week, base), cardChoice: undefined, phase: 'plan' });
}

function set(m: Model, k: Machine, delta: 1 | -1): Model {
  if (m.phase !== 'plan' || !m.game || !m.week || m.game.forced) return m;
  const key = KEY[k];
  const lim = limits(m.game, m.week, m.alloc.shelter, m.cardChoice);
  const step = STEP[k];
  const value = m.alloc[key] + delta * step;
  if (value < 0) return m;
  if (delta > 0 && (value > lim.max[key] || (m.preview?.left ?? 0) < step)) return m;
  return withPreview({ ...m, alloc: { ...m.alloc, [key]: value } });
}

function choose(m: Model, a: Extract<Action, { type: 'CHOOSE' }>): Model {
  if (m.phase !== 'plan' || !m.game || !m.week) return m;
  const cardChoice = a.card ?? m.cardChoice;
  const wanted = a.shelter ? { ...m.alloc, shelter: a.shelter } : m.alloc;
  // a new shelter or card price can make today's board too big: fit it to the new limits
  return withPreview({ ...m, cardChoice, alloc: playable(m.game, m.week, wanted, cardChoice) });
}

function next(m: Model): Model {
  if (!m.game) return m;
  switch (m.phase) {
    case 'morning':
      return openBoard(m);
    case 'run':
      if (m.game.day > 7) return { ...m, phase: m.game.launched ? 'launch' : 'truth' };
      return { ...m, phase: 'night' };
    case 'night':
      return { ...m, phase: 'morning', alloc: EMPTY, cardChoice: undefined, preview: null };
    case 'launch':
      return { ...m, phase: 'truth' };
    case 'truth':
      return { ...m, screen: 'end' };
    default:
      return m;
  }
}

export function reducer(m: Model, a: Action): Model {
  switch (a.type) {
    case 'START': {
      const seed = a.seed ?? 1;
      const firstMission = a.firstMission ?? a.week.id === FIRST_WEEK;
      const game = newGame(a.week, { modules: ['wall'], seed, cards: firstMission ? FIRST_CARDS : [] });
      return { ...initialModel, week: a.week, game, screen: 'game', phase: 'morning', seed, firstMission };
    }
    case 'SET':
      return set(m, a.k, a.delta ?? 1);
    case 'CHOOSE':
      return choose(m, a);
    case 'CONFIRM': {
      if (!m.game || !m.week || m.phase !== 'plan') return m;
      if (m.preview?.warning === 'engine.warn.chooseCard') return m; // the card needs an answer first
      return { ...m, game: confirm(m.game, m.week, m.alloc, m.cardChoice), phase: 'run', preview: null };
    }
    case 'NEXT':
      return next(m);
    case 'RESUME':
      return a.model.week && a.model.game ? a.model : m;
  }
}

// ---- selectors: everything the UI shows, from the engine ----

/** Day being shown: during run and night it is the day just played. */
export function shownDay(m: Model): number {
  if (!m.game) return 1;
  const played = m.phase === 'run' || m.phase === 'night' || m.phase === 'launch' || m.phase === 'truth';
  return Math.max(1, Math.min(7, played ? m.game.day - 1 : m.game.day));
}

export interface Option<T> {
  value: T;
  preview: Preview; // the price of this choice, shown before it is pressed
}

export interface Board {
  info: DayInfo;
  limits: Limits;
  preview: Preview | null;
  alloc: Alloc;
  cardChoice?: string;
  cardOptions: Option<string>[]; // 'shadow:heat', 'shadow:cool' …
  shelterOptions: Option<Shelter>[]; // only on alert and storm days
}

/** Morning report and energy board for the current day. */
export function board(m: Model): Board | null {
  if (!m.game || !m.week || m.game.day > 7) return null;
  const { game, week, alloc, cardChoice } = m;
  const info = dayInfo(game, week);
  const price = (a: Alloc, c?: string) => preview(game, week, playable(game, week, a, c), c);
  const choices = info.card ? CARD_CHOICES[info.card].map((pick) => `${info.card}:${pick}`) : [];
  const shelters: Shelter[] = info.choice ? ['full', 'half', 'none'] : [];
  return {
    info,
    limits: limits(game, week, alloc.shelter, cardChoice),
    preview: m.preview,
    alloc,
    cardChoice,
    cardOptions: choices.map((c) => ({ value: c, preview: price(alloc, c) })),
    shelterOptions: shelters.map((sh) => ({ value: sh, preview: price({ ...alloc, shelter: sh }, cardChoice) })),
  };
}

export interface Truth {
  result: Result;
  weekId: string;
  kind: string;
  days: { day: number; date: string; ratio: number; level: number; hours: number; dose: number; shelter: Shelter }[];
}

/** Truth screen data: the real week, revealed, and what the player did with it. */
export function truth(m: Model): Truth | null {
  if (!m.game || !m.week || m.game.day <= 7) return null;
  return {
    result: result(m.game, m.week),
    weekId: m.week.id,
    kind: String(m.week.kind ?? ''),
    days: m.week.days.map((d) => {
      const rec = m.game!.days.find((x) => x.day === d.day);
      return {
        day: d.day, date: d.date, ratio: d.ratio, level: d.level, hours: d.hours,
        dose: rec ? rec.stormGot + rec.outside : 0, shelter: rec?.shelter ?? 'none',
      };
    }),
  };
}

const clamp = <T extends number>(v: number, max: number) => Math.max(0, Math.min(max, Math.round(v))) as T;

/** Build the scene's View. Every number comes from the engine or the real week. */
export function toView(m: Model, sky?: Record<string, SkyDay[]>): View {
  const g = m.game;
  const day = shownDay(m) as View['day'];
  const info = g && m.week ? dayInfo({ ...g, day }, m.week) : null;
  const skyDay = m.week && sky ? sky[m.week.id]?.find((d) => d.day === day) : undefined;
  const today = m.week?.days.find((d) => d.day === day);
  const lim = g && m.week && g.day <= 7 ? limits(g, m.week, m.alloc.shelter, m.cardChoice) : null;
  return {
    day,
    level: (info?.level ?? 0) as View['level'],
    alert: info?.alert ?? false,
    alloc: { ls: m.alloc.ls, gh: m.alloc.gh, ws: m.alloc.build, sc: m.alloc.sc, launch: m.alloc.launch },
    wall: clamp<View['wall']>(g?.wall ?? 0, 3),
    plant: clamp<View['plant']>(g?.plant ?? 3, 4),
    shelter: m.alloc.shelter,
    phase: m.phase,
    sunAzDeg: skyDay?.sun_az_deg,
    earthElDeg: skyDay?.earth_el_deg,
    earthPhase: skyDay?.earth_phase,
    ratio: today?.ratio,
    weekId: m.week?.id,
    mediaDate: today?.date,
    batteries: lim && m.phase === 'plan' ? { left: m.preview?.left ?? lim.available, total: lim.available } : undefined,
  };
}

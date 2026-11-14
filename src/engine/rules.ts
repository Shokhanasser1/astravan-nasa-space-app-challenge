/**
 * Game rules — lane A. Written from docs/rules.md (concept v2 §05–§10) on 14 Nov because rules_engine.py is not in
 * the repo; the golden plans A 7/14 77 %, B 3/19, C 8/9 pass (plans.test.ts). Where the documents leave a choice
 * open, the decision is listed in docs/specs/2026-11-14-engine.md. If rules_engine.py differs, it wins: port it
 * over this file and keep the tests.
 * Pure: no React, three, DOM, Date.now or unseeded random. Same week + options + choices → same result.
 */
import type { Week, WeekDay } from './week';

export type Shelter = 'none' | 'half' | 'full';
export type CardId = 'dust' | 'filter' | 'shadow' | 'ice' | 'request' | 'tired' | 'sunrise';
export type StormCard = 'alert' | 'storm';
export type Machine = 'ls' | 'gh' | 'build' | 'sc' | 'launch';

/** Batteries per machine for one day + the shelter choice. */
export interface Alloc {
  ls: number; // life support 0..3
  gh: number; // garden 0..2
  build: number; // workshop 0 or 2 (one wall level)
  sc: number; // explore 0..3
  launch: number; // day 7 only: 4
  shelter: Shelter;
}

/** One night-log line: an i18n key (words by lane F) and its numbers. */
export interface LogLine {
  key: string;
  vars?: Record<string, number>;
}

export interface DayRecord {
  day: number;
  level: number;
  shelter: Shelter;
  wall: number; // wall that protected this day
  stormRaw: number;
  stormGot: number;
  outside: number;
  extra: number; // running total after the day
  air: number;
  plant: number;
  sci: number;
}

export interface Options {
  modules?: string[]; // only 'wall' before G2 (wing, dish, rover are layer 2)
  cards?: CardId[]; // fixed first cards (first mission, tests); the rest come from the seeded deck
  seed?: number;
  perDay?: number; // ★ = 7, otherwise 6
}

export interface State {
  day: number; // 1..7, 8 = week over
  bat: number; // stored batteries, 0..2
  air: number; // air and water reserve, 0..8
  plant: number; // garden health, 0..4
  wall: number; // wall levels, 0..3 (a level protects from the next day)
  extra: number; // extra dose so far
  storm_raw: number; // storm with no wall and no shelter
  storm_got: number; // storm received
  sci: number; // science: explore + card bonuses + garden result
  bonus: number; // card bonuses (part of sci)
  garden: number; // garden result science, set at the end of day 6
  emerg: number; // emergency days so far
  forced: boolean; // today runs itself (backup tank)
  dusty: boolean; // dust left on the wing: 1 battery less every day
  filter: boolean; // filter not swapped: reserve −1 every day
  crew_adj: number; // garden ±1, rest/push, emergencies, late ride
  req: number; // explore batteries since an open Request card, −1 = none open
  launched: boolean;
  late: boolean;
  perDay: number;
  seed: number;
  cards: (CardId | null)[]; // day card for days 1..7 (null on day 1, day 7 and storm days)
  log: LogLine[]; // last night's log, at most three lines
  days: DayRecord[];
}

export interface DayInfo {
  level: 0 | 1 | 2 | 3 | 4 | null; // null = not known yet ("?" on screen)
  realLevel: 0 | 1 | 2 | 3 | 4; // for the dose and the truth screen, never shown before the day is lived
  alert: boolean;
  watch: boolean;
  choice: boolean; // shelter choice offered today
  known: boolean;
  card: CardId | null; // today's day card
  storm: StormCard | null; // today's storm card
  forced: boolean;
}

export interface Limits {
  available: number; // batteries today after card prices
  max: Record<Machine, number>;
  cardCost: number;
}

export interface Preview {
  left: number;
  reserveAfter: number;
  gardenAfter: number;
  wallAfter: number;
  doseToday: number;
  blockedToday: number; // 0..1 of today's storm part
  sciToday: number;
  warning: string | null; // i18n key
}

export interface Result {
  crew: number;
  science: number;
  title: string;
  titleKey: string;
  blockedPct: number;
  extra: number;
  late: boolean;
  highCrew: number;
  highSci: number;
}

export const ENGINE_IS_STUB = false;

// ---- the P table: every number of the rules in one place (docs/rules.md) ----
export const P = {
  perDay: 6,
  startStored: 1,
  maxStored: 2,
  startAir: 5,
  maxAir: 8,
  crewUse: 2,
  startPlant: 3,
  maxPlant: 4,
  maxWall: 3,
  wallCost: 2,
  wallBlock: 0.25,
  launchCost: 4,
  max: { ls: 3, gh: 2, build: 2, sc: 3, launch: 4 } as Record<Machine, number>,
  e: [0, 0.3, 1, 2, 4] as const,
  shelter: { none: 1, half: 0.6, full: 0.25 } as Record<Shelter, number>,
  outsidePerBattery: 0.1,
  gardenByBatteries: [-1, 0, 1] as const,
  gardenResult: [
    { sci: 0, crew: -1 }, // health 0
    { sci: 0, crew: -1 }, // 1
    { sci: 2, crew: 0 }, // 2
    { sci: 4, crew: 1 }, // 3
    { sci: 5, crew: 1 }, // 4
  ],
  doseSteps: [1.0, 2.5, 5, 10] as const, // crew penalty 0, −1, −2, −3, else −4
  startCrew: 7,
  emergencyCrew: -2,
  lateCrew: -2,
  requestNeed: 4,
  requestBonus: 2,
  thresholds: {
    quiet: { crew: 8, sci: 14 },
    'false alarm': { crew: 8, sci: 14 },
    storm: { crew: 7, sci: 14 },
    severe: { crew: 6, sci: 11 },
  } as Record<string, { crew: number; sci: number }>,
  deck: ['dust', 'filter', 'shadow', 'ice', 'tired', 'request', 'sunrise'] as CardId[],
};

/** Card choices: the first is choice A, the second choice B. Request and Sunrise have none. */
export const CARD_CHOICES: Record<CardId, string[]> = {
  dust: ['brush', 'leave'],
  filter: ['swap', 'wait'],
  shadow: ['heat', 'cool'],
  ice: ['go', 'skip'],
  request: [],
  tired: ['rest', 'push'],
  sunrise: [],
};
const CARD_PRICE: Record<string, number> = { 'dust:brush': 1, 'filter:swap': 1, 'shadow:heat': 1 };

// ---- helpers ----
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const isStormDay = (d: WeekDay | undefined) => Boolean(d && (d.alert || d.level > 0));
const today = (s: State, week: Week) => week.days.find((d) => d.day === s.day);

/** Day cards: days 2..6 that are not storm days get one card each. Fixed cards first, then the seeded deck. */
function dealCards(week: Week, opts: Options, seed: number): (CardId | null)[] {
  const rnd = mulberry32(seed);
  const deck = P.deck.filter((c) => !(opts.cards ?? []).includes(c));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const queue = [...(opts.cards ?? []), ...deck];
  return Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    if (day === 1 || day === 7 || isStormDay(week.days.find((d) => d.day === day))) return null;
    return queue.shift() ?? null;
  });
}

function parseChoice(info: DayInfo, cardChoice?: string): string | null {
  if (!info.card || !cardChoice) return null;
  const [card, pick] = cardChoice.split(':');
  return card === info.card && CARD_CHOICES[info.card].includes(pick) ? pick : null;
}

// ---- the five exports ----
export function newGame(week: Week, opts: Options = { modules: ['wall'] }): State {
  const seed = opts.seed ?? 1;
  return {
    day: 1, bat: P.startStored, air: P.startAir, plant: P.startPlant, wall: 0, extra: 0, storm_raw: 0, storm_got: 0,
    sci: 0, bonus: 0, garden: 0, emerg: 0, forced: false, dusty: false, filter: false, crew_adj: 0, req: -1,
    launched: false, late: false, perDay: opts.perDay ?? P.perDay, seed, cards: dealCards(week, opts, seed), log: [], days: [],
  };
}

export function dayInfo(state: State, week: Week): DayInfo {
  const d = today(state, week);
  const realLevel = (d?.level ?? 0) as DayInfo['realLevel'];
  const storm: StormCard | null = state.forced || !isStormDay(d) ? null : d!.alert ? 'alert' : 'storm';
  const known = Boolean(d) && !d!.alert; // on an alert day nobody knows yet how hard it will hit
  return {
    level: known ? realLevel : null,
    realLevel,
    alert: d?.alert ?? false,
    watch: d?.watch ?? false,
    choice: storm !== null,
    known,
    card: state.forced ? null : state.cards[state.day - 1] ?? null,
    storm,
    forced: state.forced,
  };
}

/** What the board allows today: batteries after card prices and the most each machine can take. */
export function limits(state: State, week: Week, shelter: Shelter = 'none', cardChoice?: string): Limits {
  const info = dayInfo(state, week);
  const pick = parseChoice(info, cardChoice);
  const cardCost = pick ? CARD_PRICE[`${info.card}:${pick}`] ?? 0 : 0;
  const gift = info.card === 'sunrise' ? 1 : 0;
  const available = Math.max(0, state.bat + state.perDay + gift - (state.dusty ? 1 : 0) - cardCost);
  const sh = info.choice ? shelter : 'none';
  let sc = P.max.sc;
  if (sh === 'half') sc = Math.min(sc, 1);
  if (sh === 'full') sc = 0;
  if (info.card === 'dust' && pick === 'brush') sc = Math.min(sc, 2);
  if (info.card === 'tired' && pick === 'rest') sc = Math.min(sc, 1);
  const workshopOpen = state.day >= 2 && sh !== 'full' && state.wall < P.maxWall;
  return {
    available,
    cardCost,
    max: {
      ls: P.max.ls,
      gh: sh === 'full' ? 1 : P.max.gh,
      build: workshopOpen ? P.max.build : 0,
      sc,
      launch: state.day === 7 ? P.launchCost : 0,
    },
  };
}

/** The alloc that is actually played: limits applied, a forced day replaced by the backup-tank plan. */
export function playable(state: State, week: Week, alloc: Alloc, cardChoice?: string): Alloc {
  const info = dayInfo(state, week);
  if (state.forced) {
    const lim = limits(state, week, 'full');
    const launch = state.day === 7 ? Math.min(P.launchCost, lim.available) : 0;
    const ls = Math.min(3, lim.available - launch);
    return { ls, gh: Math.min(1, lim.available - launch - ls), build: 0, sc: 0, launch, shelter: 'full' };
  }
  const shelter = info.choice ? alloc.shelter : 'none';
  const lim = limits(state, week, shelter, cardChoice);
  const out = { ...alloc, shelter };
  let left = lim.available;
  for (const k of ['launch', 'ls', 'gh', 'build', 'sc'] as Machine[]) {
    let v = Math.min(clamp(Math.floor(alloc[k]), 0, lim.max[k]), left);
    if (k === 'build' && v < P.wallCost) v = 0; // a wall level needs both batteries
    out[k] = v;
    left -= v;
  }
  return out;
}

function dosePenalty(extra: number): number {
  const i = P.doseSteps.findIndex((limit) => extra <= limit + 1e-9);
  return i === -1 ? P.doseSteps.length : i;
}

/** One day of the rules. Returns the new state; the input is never changed. */
function step(state: State, week: Week, alloc: Alloc, cardChoice?: string): State {
  const info = dayInfo(state, week);
  const d = today(state, week);
  const a = playable(state, week, alloc, cardChoice);
  const pick = state.forced ? null : parseChoice(info, cardChoice);
  const lim = limits(state, week, a.shelter, cardChoice);
  const e = P.e[info.realLevel];

  // radiation: the wall built today protects from tomorrow, so today's wall is the old one
  const stormRaw = d ? e : 0;
  const stormGot = stormRaw * (1 - P.wallBlock * state.wall) * P.shelter[a.shelter];
  const outside = a.sc * P.outsidePerBattery * (1 + e);

  // air and water
  let air = state.air - P.crewUse + a.ls;
  const iceGo = info.card === 'ice' && pick === 'go' && a.sc >= 1;
  if (a.sc >= 2 || iceGo) air -= 1; // long walk
  const filter = state.filter || (info.card === 'filter' && pick === 'wait');
  if (filter) air -= 1;
  air = Math.min(P.maxAir, air);

  // garden
  let plant = state.plant + P.gardenByBatteries[a.gh];
  if (info.card === 'shadow' && pick === 'cool') plant -= 1;
  plant = clamp(plant, 0, P.maxPlant);

  // science and card bonuses
  let bonus = iceGo ? 1 : 0;
  let req = state.req;
  if (req >= 0) {
    if (req + a.sc >= P.requestNeed) bonus += P.requestBonus;
    req = -1;
  }
  if (info.card === 'request') req = a.sc;
  let crewAdj = state.crew_adj;
  if (info.card === 'tired') crewAdj += pick === 'rest' ? 1 : -1;

  const used = a.ls + a.gh + a.build + a.sc + a.launch;
  const wall = Math.min(P.maxWall, state.wall + (a.build >= P.wallCost ? 1 : 0));
  let sci = state.sci + a.sc + bonus;
  let garden = state.garden;
  if (state.day === 6) {
    const g = P.gardenResult[plant];
    garden = g.sci;
    sci += g.sci;
    crewAdj += g.crew;
  }
  let launched = state.launched;
  let late = state.late;
  if (state.day === 7) {
    launched = a.launch >= P.launchCost;
    late = !launched;
    if (late) crewAdj += P.lateCrew;
  }
  const emergency = air <= 0;
  if (emergency) crewAdj += P.emergencyCrew;
  const extra = state.extra + stormGot + outside;

  const next: State = {
    ...state,
    day: state.day + 1,
    bat: Math.min(P.maxStored, Math.max(0, lim.available - used)),
    air: Math.max(0, air),
    plant, wall, extra,
    storm_raw: state.storm_raw + stormRaw,
    storm_got: state.storm_got + stormGot,
    sci, bonus: state.bonus + bonus, garden,
    emerg: state.emerg + (emergency ? 1 : 0),
    forced: emergency && state.day < 7,
    dusty: state.dusty || (info.card === 'dust' && pick === 'leave'),
    filter, crew_adj: crewAdj, req, launched, late,
  };
  next.log = nightLog(state, next, { stormRaw, stormGot, built: wall > state.wall, found: a.sc + bonus, emergency });
  next.days = [
    ...state.days,
    { day: state.day, level: info.realLevel, shelter: a.shelter, wall: state.wall, stormRaw, stormGot, outside, extra, air: next.air, plant, sci },
  ];
  return next;
}

/** At most three cause → effect lines, most important first. Words are written by lane F. */
function nightLog(
  before: State,
  after: State,
  x: { stormRaw: number; stormGot: number; built: boolean; found: number; emergency: boolean },
): LogLine[] {
  const lines: LogLine[] = [];
  if (x.emergency) lines.push({ key: 'engine.log.emergency' });
  if (x.stormRaw > 0) lines.push({ key: 'engine.log.blocked', vars: { pct: Math.round((1 - x.stormGot / x.stormRaw) * 100) } });
  if (after.plant !== before.plant) lines.push({ key: after.plant < before.plant ? 'engine.log.gardenFell' : 'engine.log.gardenGrew', vars: { from: before.plant, to: after.plant } });
  if (x.built) lines.push({ key: 'engine.log.wallBuilt', vars: { level: after.wall } });
  if (after.air !== before.air) lines.push({ key: after.air < before.air ? 'engine.log.reserveFell' : 'engine.log.reserveRose', vars: { from: before.air, to: after.air } });
  if (x.found > 0) lines.push({ key: 'engine.log.found', vars: { n: x.found } });
  return lines.slice(0, 3);
}

/** Runs today's rules on a copy: what each choice would do. Saves nothing. */
export function preview(state: State, week: Week, alloc: Alloc, cardChoice?: string): Preview {
  const info = dayInfo(state, week);
  const a = playable(state, week, alloc, cardChoice);
  const lim = limits(state, week, a.shelter, cardChoice);
  const next = step(state, week, alloc, cardChoice);
  const rec = next.days[next.days.length - 1];
  const used = a.ls + a.gh + a.build + a.sc + a.launch;
  let warning: string | null = null;
  if (info.card && CARD_CHOICES[info.card].length && !parseChoice(info, cardChoice) && !state.forced) warning = 'engine.warn.chooseCard';
  else if (state.day === 7 && a.launch < P.launchCost) warning = 'engine.warn.noLaunch';
  else if (next.air <= 0) warning = 'engine.warn.reserveEmpty';
  else if (next.plant < state.plant) warning = 'engine.warn.gardenFalls';
  return {
    left: lim.available - used,
    reserveAfter: next.air,
    gardenAfter: next.plant,
    wallAfter: next.wall,
    doseToday: rec.stormGot + rec.outside,
    blockedToday: rec.stormRaw > 0 ? 1 - rec.stormGot / rec.stormRaw : 0,
    sciToday: next.sci - state.sci,
    warning,
  };
}

export function confirm(state: State, week: Week, alloc: Alloc, cardChoice?: string): State {
  if (state.day > 7) return state;
  return step(state, week, alloc, cardChoice);
}

const TITLE_KEYS: Record<string, string> = {
  'Balance Master': 'engine.title.balanceMaster',
  'Bold Explorer': 'engine.title.boldExplorer',
  'Careful Commander': 'engine.title.carefulCommander',
  'Cadet in Training': 'engine.title.cadetInTraining',
  'Late Ride Home': 'engine.title.lateRideHome',
};

export function result(state: State, week: Week): Result {
  const crew = clamp(P.startCrew - dosePenalty(state.extra) + state.crew_adj, 0, 10);
  const kind = String(week.kind ?? 'storm').toLowerCase();
  const th = P.thresholds[kind] ?? P.thresholds.severe;
  const highCrew = crew >= th.crew;
  const highSci = state.sci >= th.sci;
  const title = state.late
    ? 'Late Ride Home'
    : highCrew && highSci
      ? 'Balance Master'
      : highSci
        ? 'Bold Explorer'
        : highCrew
          ? 'Careful Commander'
          : 'Cadet in Training';
  return {
    crew,
    science: state.sci,
    title,
    titleKey: TITLE_KEYS[title],
    blockedPct: state.storm_raw > 0 ? (1 - state.storm_got / state.storm_raw) * 100 : 0,
    extra: state.extra,
    late: state.late,
    highCrew: th.crew,
    highSci: th.sci,
  };
}

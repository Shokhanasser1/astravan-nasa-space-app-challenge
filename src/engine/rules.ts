/**
 * ⚠ STUB — lane A (Samandar) REPLACES THIS WHOLE FILE with the TypeScript port of rules_engine.py.
 * Keep every name and number of the Python engine identical (P table, step, score, title, blocked, day_info).
 * Signatures follow the work plan (ish rejasi, section 03). The stub returns fixed values so screens and the
 * scene can be built today; it contains no game rules. plans.test.ts proves the real port: A 7/14, B 3/19, C 8/9.
 */
import type { Week } from './week';

export type Shelter = 'none' | 'half' | 'full';

/** Batteries per machine for one day + the shelter choice. */
export interface Alloc {
  ls: number; // life support
  gh: number; // garden (greenhouse)
  build: number; // workshop
  sc: number; // explore (science)
  launch: number; // day 7 only
  shelter: Shelter;
}

/** Field names from the work plan; the port defines the real ones. */
export interface State {
  day: number;
  bat: number;
  air: number;
  plant: number;
  wall: number;
  wing: boolean;
  dish: boolean;
  rover: boolean;
  extra: number;
  storm_raw: number;
  storm_got: number;
  sci: number;
  bonus: number;
  garden: number;
  emerg: boolean;
  forced: boolean;
  dusty: boolean;
  filter: boolean;
  crew_adj: number;
  req: number;
  launched: boolean;
  log: string[];
}

export interface DayInfo {
  level: 0 | 1 | 2 | 3 | 4 | null; // null = not known yet ("?" on screen)
  alert: boolean;
  choice: boolean; // shelter choice offered today
  known: boolean;
  card: string | null;
}

export interface Preview {
  left: number;
  reserveAfter: number;
  gardenAfter: number;
  blockedToday: number;
  warning: string | null; // i18n key
}

export interface Result {
  crew: number;
  science: number;
  title: string;
  blockedPct: number;
}

export const ENGINE_IS_STUB = true;

export function newGame(_week: Week, _opts: { modules: string[] } = { modules: ['wall'] }): State {
  return {
    day: 1, bat: 0, air: 0, plant: 0, wall: 0, wing: false, dish: false, rover: false, extra: 0,
    storm_raw: 0, storm_got: 0, sci: 0, bonus: 0, garden: 0, emerg: false, forced: false, dusty: false,
    filter: false, crew_adj: 0, req: 0, launched: false, log: [],
  };
}

export function dayInfo(state: State, week: Week): DayInfo {
  const d = week.days.find((x) => x.day === state.day);
  return { level: d ? d.level : null, alert: d?.alert ?? false, choice: false, known: Boolean(d), card: null };
}

export function preview(_state: State, _week: Week, _alloc: Alloc, _cardChoice?: string): Preview {
  return { left: 0, reserveAfter: 0, gardenAfter: 0, blockedToday: 0, warning: null };
}

export function confirm(state: State, _week: Week, _alloc: Alloc, _cardChoice?: string): State {
  return { ...state, day: state.day + 1, log: [...state.log] };
}

export function result(_state: State, _week: Week): Result {
  return { crew: 0, science: 0, title: '', blockedPct: 0 };
}

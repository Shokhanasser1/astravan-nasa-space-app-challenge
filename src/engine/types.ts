/**
 * L0 engine contract (concept v2, sections 06–10). Owner: Samandar.
 * The real, tested engine is ported into src/engine/index.ts. Adjust these names ONCE to match it,
 * early, and tell the team: screens, store and scene depend on this file.
 * Pure data only: no React, no three.js, no DOM.
 */
import type { Week } from '../data/types';

export type Level = 'cadet' | 'pilot' | 'commander';
export type Machine = 'lifeSupport' | 'garden' | 'workshop' | 'explore' | 'launch';
export type Shelter = 'work' | 'half' | 'inside';
export type Build = 'wall' | 'wing' | 'dish' | 'rover';

export interface GameSettings {
  level: Level;
  /** Cadet: 7 batteries a day; Pilot and Commander: 6 (concept 3.0, section 04). */
  batteriesPerDay: number;
}

export interface DayPlan {
  batteries: Partial<Record<Machine, number>>;
  /** Shelter choice on alert and storm days. */
  shelter?: Shelter;
  /** What the Workshop builds today, if it gets batteries. */
  build?: Build;
  /** Answer to today's day card, by card id. */
  cardChoice?: { cardId: string; option: string };
}

export interface Gauges {
  energyStored: number; // unused batteries, up to 2
  reserve: number; // air and water, of 8
  dose: number; // accumulated extra dose (game units)
  garden: number; // health, of 4
  wall: number; // shield wall level, of 3
}

export interface DayLogLine {
  /** i18n key for the cause → effect line; values fill the placeholders. */
  key: string;
  values?: Record<string, string | number>;
}

export interface DayPreview {
  /** Gauges after the day if the plan is confirmed: "price before choice". */
  after: Gauges;
  batteriesLeft: number;
  valid: boolean;
  problems: string[]; // i18n keys
}

export interface GameState {
  weekId: string;
  day: number; // 1..7, 8 = finished
  settings: GameSettings;
  gauges: Gauges;
  crew: number; // 0..10
  science: number;
  modules: Build[];
  log: DayLogLine[][]; // night log per finished day
  finished: boolean;
  title?: string; // commander title id at the end
  seed: number;
}

export interface Engine {
  startGame(input: { week: Week; settings: GameSettings; seed?: number }): GameState;
  previewDay(state: GameState, plan: DayPlan): DayPreview;
  confirmDay(state: GameState, plan: DayPlan): GameState;
}

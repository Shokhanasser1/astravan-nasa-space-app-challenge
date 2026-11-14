/**
 * L0 engine. PLACEHOLDER until Samandar ports the tested engine (concept v2: "the three engine functions,
 * even if they return fixed values"). Screens can be built against it today.
 * Replace the bodies, keep the signatures (see types.ts). Do not put numbers for screens anywhere else.
 */
import type { DayPlan, DayPreview, Engine, GameSettings, GameState } from './types';
import type { Week } from '../data/types';

function startGame({ week, settings, seed = 1 }: { week: Week; settings: GameSettings; seed?: number }): GameState {
  return {
    weekId: week.id,
    day: 1,
    settings,
    gauges: { energyStored: 1, reserve: 5, dose: 0, garden: 3, wall: 0 },
    crew: 7,
    science: 0,
    modules: [],
    log: [],
    finished: false,
    seed,
  };
}

function used(plan: DayPlan): number {
  return Object.values(plan.batteries).reduce((a, b) => a + (b ?? 0), 0);
}

function previewDay(state: GameState, plan: DayPlan): DayPreview {
  const left = state.settings.batteriesPerDay - used(plan);
  return { after: { ...state.gauges }, batteriesLeft: left, valid: left >= 0, problems: left < 0 ? ['engine.tooManyBatteries'] : [] };
}

function confirmDay(state: GameState, plan: DayPlan): GameState {
  if (!previewDay(state, plan).valid) return state;
  const day = state.day + 1;
  return { ...state, day, finished: day > 7, log: [...state.log, []] };
}

export const engine: Engine = { startGame, previewDay, confirmDay };
export const ENGINE_IS_PLACEHOLDER = true;

/**
 * One reducer → one View. Lane B (Samandar). The scene and the UI only READ the view and DISPATCH actions;
 * they never compute game numbers. Actions from the work plan: START · SET · CHOOSE · CONFIRM · NEXT.
 * The `View` type is the only shared contract with the scene; only Samandar changes it.
 * This is a starting skeleton: phases, cards, alerts, emergency day, express mission and saving are lane B's work.
 */
import { confirm, dayInfo, newGame, preview, type Alloc, type Preview, type Shelter, type State } from '../engine/rules';
import type { Week } from '../engine/week';

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
  screen: 'start' | 'intro' | 'game' | 'end';
}

export type Action =
  | { type: 'START'; week: Week }
  | { type: 'SET'; k: Machine; delta?: 1 | -1 } // tap on a building: +1 battery (or −1 = undo)
  | { type: 'CHOOSE'; shelter?: Shelter; card?: string }
  | { type: 'CONFIRM' }
  | { type: 'NEXT' };

const EMPTY: Alloc = { ls: 0, gh: 0, build: 0, sc: 0, launch: 0, shelter: 'none' };
const KEY: Record<Machine, keyof Omit<Alloc, 'shelter'>> = { ls: 'ls', gh: 'gh', ws: 'build', sc: 'sc', launch: 'launch' };

export const initialModel: Model = { week: null, game: null, alloc: EMPTY, preview: null, phase: 'morning', screen: 'start' };

function withPreview(m: Model): Model {
  return m.game && m.week ? { ...m, preview: preview(m.game, m.week, m.alloc, m.cardChoice) } : m;
}

export function reducer(m: Model, a: Action): Model {
  switch (a.type) {
    case 'START':
      return { ...initialModel, week: a.week, game: newGame(a.week), screen: 'game', phase: 'morning' };
    case 'SET': {
      if (m.phase !== 'plan') return m;
      const key = KEY[a.k];
      const value = Math.max(0, m.alloc[key] + (a.delta ?? 1));
      return withPreview({ ...m, alloc: { ...m.alloc, [key]: value } });
    }
    case 'CHOOSE':
      return withPreview({ ...m, alloc: a.shelter ? { ...m.alloc, shelter: a.shelter } : m.alloc, cardChoice: a.card ?? m.cardChoice });
    case 'CONFIRM': {
      if (!m.game || !m.week || m.phase !== 'plan') return m;
      return { ...m, game: confirm(m.game, m.week, m.alloc, m.cardChoice), phase: 'run', preview: null };
    }
    case 'NEXT': {
      if (!m.game) return m;
      const next: Record<Phase, Phase> = { morning: 'plan', plan: 'plan', run: 'night', night: 'morning', launch: 'truth', truth: 'truth' };
      let phase = next[m.phase];
      if (m.phase === 'night' && m.game.day > 7) phase = 'launch';
      if (m.phase === 'truth') return { ...m, screen: 'end' };
      return { ...m, phase, alloc: phase === 'morning' ? EMPTY : m.alloc, cardChoice: phase === 'morning' ? undefined : m.cardChoice };
    }
  }
}

const clamp = <T extends number>(v: number, max: number) => Math.max(0, Math.min(max, Math.round(v))) as T;

/** Build the scene's View. Every number comes from the engine or the real week. */
export function toView(m: Model, sky?: Record<string, { day: number; sun_az_deg: number; earth_el_deg: number; earth_phase: number }[]>): View {
  const g = m.game;
  const day = clamp<View['day']>(Math.min(g?.day ?? 1, 7), 7) || 1;
  const info = g && m.week ? dayInfo({ ...g, day }, m.week) : null;
  const skyDay = m.week && sky ? sky[m.week.id]?.find((d) => d.day === day) : undefined;
  const today = m.week?.days.find((d) => d.day === day);
  return {
    day: day as View['day'],
    level: (info?.level ?? 0) as View['level'],
    alert: info?.alert ?? false,
    alloc: { ls: m.alloc.ls, gh: m.alloc.gh, ws: m.alloc.build, sc: m.alloc.sc, launch: m.alloc.launch },
    wall: clamp<View['wall']>(g?.wall ?? 0, 3),
    plant: clamp<View['plant']>(g?.plant ?? 0, 4),
    shelter: m.alloc.shelter,
    phase: m.phase,
    sunAzDeg: skyDay?.sun_az_deg,
    earthElDeg: skyDay?.earth_el_deg,
    earthPhase: skyDay?.earth_phase,
    ratio: today?.ratio,
  };
}

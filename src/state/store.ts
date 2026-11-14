import { create } from 'zustand';
import { engine } from '../engine';
import type { DayPlan, DayPreview, GameState, Level } from '../engine/types';
import type { SkyFile, Week } from '../data/types';
import { load, save } from '../lib/storage';

export type Screen = 'loading' | 'title' | 'story' | 'training' | 'day' | 'truth' | 'end';
/** Five steps of a day (concept v2, section 05) + the morning guess (concept 3.0, section 04). */
export type DayStep = 'report' | 'guess' | 'card' | 'board' | 'run' | 'log';
export type Lang = 'en' | 'uz' | 'ru';
export type Quality = 'high' | 'medium' | 'low';

interface Settings {
  lang: Lang;
  level: Level;
  sound: boolean;
  quality: Quality;
}

interface GameStore {
  // data
  week: Week | null;
  sky: SkyFile | null;
  // engine
  game: GameState | null;
  plan: DayPlan;
  preview: DayPreview | null;
  // flow
  screen: Screen;
  step: DayStep;
  // settings (persisted)
  settings: Settings;

  setData(week: Week, sky: SkyFile | null): void;
  newGame(seed?: number): void;
  setPlan(plan: DayPlan): void;
  confirmDay(): void;
  go(screen: Screen): void;
  setStep(step: DayStep): void;
  setSettings(patch: Partial<Settings>): void;
}

const BATTERIES: Record<Level, number> = { cadet: 7, pilot: 6, commander: 6 };
const defaults: Settings = { lang: 'en', level: 'pilot', sound: true, quality: 'high' };

export const useGame = create<GameStore>()((set, get) => ({
  week: null,
  sky: null,
  game: null,
  plan: { batteries: {} },
  preview: null,
  screen: 'loading',
  step: 'report',
  settings: { ...defaults, ...load<Partial<Settings>>('settings', {}) },

  setData(week, sky) {
    set({ week, sky, screen: 'title' });
  },

  newGame(seed) {
    const { week, settings } = get();
    if (!week) return;
    const game = engine.startGame({
      week,
      settings: { level: settings.level, batteriesPerDay: BATTERIES[settings.level] },
      seed: seed ?? Math.floor(Math.random() * 2 ** 31),
    });
    set({ game, plan: { batteries: {} }, preview: null, screen: 'day', step: 'report' });
  },

  // Price before choice: every change of the draft plan recomputes the preview; nothing is spent.
  setPlan(plan) {
    const { game } = get();
    set({ plan, preview: game ? engine.previewDay(game, plan) : null });
  },

  // Undo is free until here; after confirm the day is final.
  confirmDay() {
    const { game, plan } = get();
    if (!game) return;
    const next = engine.confirmDay(game, plan);
    set({ game: next, plan: { batteries: {} }, preview: null, step: next.finished ? 'log' : 'run' });
    if (next.finished) set({ screen: 'truth' });
  },

  go(screen) {
    set({ screen });
  },

  setStep(step) {
    set({ step });
  },

  setSettings(patch) {
    const settings = { ...get().settings, ...patch };
    save('settings', settings);
    set({ settings });
  },
}));

/** Today's record from the real week (null before the game starts). */
export function today(s: Pick<GameStore, 'week' | 'game'>) {
  if (!s.week || !s.game) return null;
  return s.week.days.find((d) => d.day === Math.min(s.game!.day, 7)) ?? null;
}

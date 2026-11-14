import { useSyncExternalStore } from 'react';
import type { AimId } from '../controls/bus';

/**
 * The current task of the player (tutorial step or the day's goal) — not game state: the engine never sees it.
 * The HUD (src/ui) decides it and writes it here; the scene reads `target` to draw a beacon over that place, and
 * reads `idle` to make the beacon pulse when the player has been stuck for a while.
 * Written only when it changes (never per frame).
 */
export type ObjectiveTarget = AimId | 'door' | 'ladder' | null;

export interface Objective {
  /** i18n key of the task line, e.g. 'ui.goal.takeBattery'. */
  key: string | null;
  /** Where the beacon stands. */
  target: ObjectiveTarget;
  /** The player has done nothing for a while: make the target pulse. */
  idle: boolean;
}

let current: Objective = { key: null, target: null, idle: false };
const subs = new Set<() => void>();

export function setObjective(next: Objective): void {
  if (next.key === current.key && next.target === current.target && next.idle === current.idle) return;
  current = next;
  for (const f of subs) f();
}

export const getObjective = (): Objective => current;

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

/** React: the current objective; re-renders only when it changes. */
export function useObjective(): Objective {
  return useSyncExternalStore(subscribe, getObjective, getObjective);
}

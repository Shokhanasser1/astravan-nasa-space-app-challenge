import { useSyncExternalStore } from 'react';
import type { Phase } from './game';

/**
 * Home story T2: how far the walk from the crash site has come on Day 1's morning (View.crash) — not game state, the
 * engine never sees it. The rig writes it (only when it changes, never per frame); the HUD reads it for the tutorial
 * step ("Reach the base" → "Go inside" → Houston) and Today's 5 ticks "Reach the base" by it.
 * - walk: still on the way (further than src/scene/crash.ts REACH_M from the habitat door)
 * - door: the base is reached (within REACH_M of its door)
 * - in: inside the habitat
 * It only moves forward during that morning, and is back to `walk` whenever the day does not start at the crash.
 */
export type CrashStage = 'walk' | 'door' | 'in';

let stage: CrashStage = 'walk';
const subs = new Set<() => void>();

export function setCrashStage(next: CrashStage): void {
  if (next === stage) return;
  stage = next;
  for (const f of subs) f();
}

export const getCrashStage = (): CrashStage => stage;

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

/** React: the walk's stage; re-renders only when it changes. */
export function useCrashStage(): CrashStage {
  return useSyncExternalStore(subscribe, getCrashStage, getCrashStage);
}

/**
 * "Reach the base" (Day 1's first task, the document p. 17): the astronaut came within 6 m of the habitat door, or
 * Next ended the morning (the walk skipped). Pure.
 */
export const reachDone = (phase: Phase, stage: CrashStage): boolean => phase !== 'morning' || stage !== 'walk';

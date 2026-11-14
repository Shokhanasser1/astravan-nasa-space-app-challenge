import { useSyncExternalStore } from 'react';
import type { Machine } from '../state/game';
import type { PointId } from '../scene/points';

/**
 * Two small channels between the scene and the HUD that are not game state (the engine never sees them):
 * - aim: the building in front of the astronaut, written by the rig only when it changes;
 * - travel: the base map asks the rig to float to a standing point.
 */
/** What the astronaut faces: a machine, or the power hub where batteries are taken and returned. */
export type AimId = Machine | 'hub';

let aim: AimId | null = null;
const aimSubs = new Set<() => void>();

export function setAim(k: AimId | null): void {
  if (k === aim) return;
  aim = k;
  for (const f of aimSubs) f();
}

export const getAim = () => aim;

function subscribeAim(f: () => void) {
  aimSubs.add(f);
  return () => {
    aimSubs.delete(f);
  };
}

/** React: the aimed building; re-renders only when it changes (never per frame). */
export function useAim(): AimId | null {
  return useSyncExternalStore(subscribeAim, getAim, getAim);
}

const travelSubs = new Set<(p: PointId) => void>();

export function travel(p: PointId): void {
  for (const f of travelSubs) f(p);
}

export function onTravel(f: (p: PointId) => void): () => void {
  travelSubs.add(f);
  return () => {
    travelSubs.delete(f);
  };
}

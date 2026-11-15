import { useSyncExternalStore } from 'react';
import type { Machine } from '../state/game';
import type { PointId } from '../scene/points';

/**
 * Two small channels between the scene and the HUD that are not game state (the engine never sees them):
 * - aim: the building in front of the astronaut, written by the rig only when it changes;
 * - travel: the base map asks the rig to float to a standing point;
 * - ride (`?drive`): what E does at the crew rover now (climb in, or stop and climb out), written by the rig only when
 *   it changes; E or the rover button asks the rig to do it.
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

/** E's action now: climb into the rover, stop it and get out, go into a building at its door, go out, climb a ladder up or down;
 * home story: go to sleep at the habitat door once the day has run (src/state/homeDay.ts bedtime). */
export type Ride = 'board' | 'exit' | 'enter' | 'leave' | 'up' | 'down' | 'sleep';
let ride: Ride | null = null;
const rideSubs = new Set<() => void>();
const rideAsks = new Set<() => void>();

export function setRide(r: Ride | null): void {
  if (r === ride) return;
  ride = r;
  for (const f of rideSubs) f();
}

export const getRide = () => ride;

function subscribeRide(f: () => void) {
  rideSubs.add(f);
  return () => {
    rideSubs.delete(f);
  };
}

/** React: what E does at the rover; re-renders only when it changes. */
export function useRide(): Ride | null {
  return useSyncExternalStore(subscribeRide, getRide, getRide);
}

export function askRide(): void {
  for (const f of rideAsks) f();
}

export function onRide(f: () => void): () => void {
  rideAsks.add(f);
  return () => {
    rideAsks.delete(f);
  };
}

/**
 * The walker: keys and stick → velocity → a step with collisions, at a fixed 60 ticks a second whatever the frame
 * rate (handoff "first-person walk", section 5). One per rig; it keeps the velocity between frames and allocates
 * nothing while it runs.
 */
import { BODY, walkStep, type Area, type XZ } from './collide';
import { axes, type Axes } from './input';
import { accelerate, heading, PACE } from './move';

/** What the debug view shows; written by the walker, read only by src/scene/WalkDebug.tsx. */
export const walkDebug = { speed: 0, x: 0, z: 0, inside: false };

export function createWalker() {
  const v: XZ = { x: 0, z: 0 };
  const wish: XZ = { x: 0, z: 0 };
  const next: XZ = { x: 0, z: 0 };
  const ax: Axes = { ahead: 0, side: 0, turn: 0 };
  let owed = 0;
  return {
    /** The arrow keys' turn, −1…1. */
    turn(): number {
      return axes(ax).turn;
    },
    /** Stand still (the camera is being moved for the walker: a float to a marker, a new phase). */
    stop(): void {
      v.x = 0;
      v.z = 0;
      owed = 0;
    },
    /**
     * Advance by `dt` seconds: moves `pos` (x and z) inside `area`, facing `yaw`. Returns true while a key or the
     * stick is held or the walker is still slowing down, so the caller keeps drawing frames.
     */
    step(pos: XZ, yaw: number, area: Area, dt: number, k = 1, body = BODY * k): boolean {
      // (k: the scale of the room it walks in — the habitat's interior is drawn at ASTRA_SCALE.habitat: body and pace shrink with it)
      axes(ax);
      const asked = ax.ahead !== 0 || ax.side !== 0;
      // (A stalled tab owes at most a tenth of a second: no leap on coming back.)
      owed = Math.min(owed + dt, 0.1);
      while (owed >= PACE.tick) {
        owed -= PACE.tick;
        heading(yaw, ax.ahead, ax.side, wish);
        accelerate(v, wish, PACE.walk * k, PACE.tick, v);
        if (!asked && Math.hypot(v.x, v.z) < 0.01) {
          v.x = 0;
          v.z = 0;
          continue;
        }
        walkStep(pos, v.x * PACE.tick, v.z * PACE.tick, area, body, next);
        // What really happened is the new velocity: a wall takes away the part of it that pushed into the wall.
        v.x = (next.x - pos.x) / PACE.tick;
        v.z = (next.z - pos.z) / PACE.tick;
        pos.x = next.x;
        pos.z = next.z;
      }
      walkDebug.speed = Math.hypot(v.x, v.z);
      walkDebug.x = pos.x;
      walkDebug.z = pos.z;
      return asked || walkDebug.speed > 0;
    },
  };
}
export type Walker = ReturnType<typeof createWalker>;

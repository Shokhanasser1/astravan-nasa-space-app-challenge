/**
 * How walking feels (handoff "first-person walk", section 5): the numbers, and the two small formulas that turn
 * keys or a stick into a velocity. Pure. Scene-only numbers: tune them with children, they are not game rules.
 */
import type { XZ } from './collide';

export const PACE = {
  /** Walking speed, metres a second (try 1.5–2.5). */
  walk: 2.0,
  /** Rates per second for setting off and for stopping: full speed in about 0.15 s, a stop in about 0.1 s. */
  accel: 20,
  brake: 30,
  /** Fixed step of the walk, seconds (60 a second), whatever the screen's frame rate. */
  tick: 1 / 60,
} as const;

/**
 * The direction on the ground that the keys or the stick ask for, given where the camera faces.
 * `yaw` is the rig's camera yaw (camera.rotation.y: 0 looks down −z); `ahead` and `side` are −1…1.
 * Looking up or down never changes it, and a diagonal is no faster than straight ahead (length ≤ 1).
 */
export function heading(yaw: number, ahead: number, side: number, out: XZ = { x: 0, z: 0 }): XZ {
  const x = -Math.sin(yaw) * ahead + Math.cos(yaw) * side;
  const z = -Math.cos(yaw) * ahead - Math.sin(yaw) * side;
  const len = Math.hypot(x, z);
  out.x = len > 1 ? x / len : x;
  out.z = len > 1 ? z / len : z;
  return out;
}

/**
 * The velocity one tick later: eased towards `wish` × `speed`, more quickly when letting go than when setting off.
 * `out` may be `v` itself.
 */
export function accelerate(v: XZ, wish: XZ, speed: number, dt: number, out: XZ = { x: 0, z: 0 }): XZ {
  const stopping = Math.hypot(wish.x, wish.z) < 1e-3;
  const k = 1 - Math.exp(-(stopping ? PACE.brake : PACE.accel) * dt);
  out.x = v.x + (wish.x * speed - v.x) * k;
  out.z = v.z + (wish.z * speed - v.z) * k;
  return out;
}

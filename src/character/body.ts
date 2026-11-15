/**
 * The astronaut's body on foot: Moon gravity, Apollo walking and loping speeds and the lunar jump from the demo's
 * physics (./physics.js, Samandar: sources in that file), on the base's flat hitboxes from the free walk
 * (src/walk/collide.ts: discs and bars, sub-stepped, never passes through a wall). Pure: no three.js, no DOM.
 *
 * Horizontal: eased toward the wanted velocity, limited by traction (∝ g: you cannot stop quickly on the Moon).
 * Vertical: a short crouch (the JumpStart clip), then take-off at 1.2 m/s → 0.44 m apex on the Moon (v² / 2g).
 */
import { BODY as RADIUS, walkStep, type Area, type XZ } from '../walk/collide';
import { GRAVITY, MOVE, groundAccel, jumpSpeed } from './physics.js';

export type Ground = (x: number, z: number) => number;

export interface Wish {
  /** Wanted direction on the ground, length ≤ 1 (src/walk/move.ts heading()). */
  x: number;
  z: number;
  run: boolean;
  /** Jump pressed this step. */
  jump: boolean;
}

export interface Body {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  /** ≥ 0 while crouching before take-off (s), −1 otherwise. */
  windup: number;
  /** Take-off speed of the last jump (the animation scrubs the flight by it). */
  v0: number;
  /** Facing on the ground: 0 = +z (the model's front). */
  facing: number;
  /** Loping (run held) in the last step. */
  running: boolean;
  /** Drawn and moved at this scale (1 outside; a building's room scale inside it, src/walk/rooms.ts). */
  scale: number;
}

/** Fixed physics step (s): the same as the demo. */
export const STEP = 1 / 120;

export function createBody(x: number, z: number, ground: Ground, facing = 0): Body {
  return { x, y: ground(x, z), z, vx: 0, vy: 0, vz: 0, onGround: true, windup: -1, v0: 0, facing, running: false, scale: 1 };
}

const at: XZ = { x: 0, z: 0 };
const next: XZ = { x: 0, z: 0 };

/** One fixed step. Returns true while the body moves, crouches or flies (the scene keeps drawing). */
// `k` scales the body for a room drawn at a building's scale (src/walk/rooms.ts): its size, pace, push-off and
// gravity all by k, so it moves exactly like a full-size body seen at that scale (same timing, same arcs).
export function stepBody(b: Body, wish: Wish, area: Area, ground: Ground, g = GRAVITY.moon, k = 1, radius = RADIUS * k): boolean {
  const dt = STEP;
  b.running = wish.run;
  const vmax = (wish.run ? MOVE.run : MOVE.walk) * k;
  const len = Math.min(1, Math.hypot(wish.x, wish.z));
  const tx = len > 1e-3 ? (wish.x / Math.hypot(wish.x, wish.z)) * vmax * len : 0;
  const tz = len > 1e-3 ? (wish.z / Math.hypot(wish.x, wish.z)) * vmax * len : 0;
  const lim = groundAccel(g) * k * (b.onGround ? 1 : MOVE.airControl) * dt;
  const dvx = tx - b.vx, dvz = tz - b.vz, dv = Math.hypot(dvx, dvz);
  if (dv > lim) {
    b.vx += (dvx / dv) * lim;
    b.vz += (dvz / dv) * lim;
  } else {
    b.vx = tx;
    b.vz = tz;
  }

  if (wish.jump && b.onGround && b.windup < 0) b.windup = 0;
  if (b.windup >= 0) {
    b.windup += dt;
    if (b.windup >= MOVE.windup) {
      b.windup = -1;
      b.v0 = jumpSpeed(0) * k;
      b.vy = b.v0;
      b.onGround = false;
    }
  }

  // across the ground, stopped and slid along by the hitboxes
  at.x = b.x;
  at.z = b.z;
  walkStep(at, b.vx * dt, b.vz * dt, area, radius, next);
  // What really happened is the new velocity, but a hitbox only takes speed away (stops it, slides it along): when
  // the body was put inside one (the hop out of the rover lands inside its hitbox) the push out moves it, and must
  // not become speed. (At 120 steps a second a 17 cm push was 20 m/s; Moon traction let it slide on for ~80 m.)
  const vIn = Math.hypot(b.vx, b.vz);
  let nvx = (next.x - b.x) / dt;
  let nvz = (next.z - b.z) / dt;
  const vOut = Math.hypot(nvx, nvz);
  if (vOut > vIn) {
    const s = vOut > 0 ? vIn / vOut : 0;
    nvx *= s;
    nvz *= s;
  }
  b.vx = nvx;
  b.vz = nvz;
  b.x = next.x;
  b.z = next.z;

  // up and down: an exact parabola in the air, following the ground on foot
  const gy = ground(b.x, b.z);
  if (!b.onGround) {
    b.y += b.vy * dt - 0.5 * g * k * dt * dt;
    b.vy -= g * k * dt;
    if (b.y <= gy && b.vy <= 0) {
      b.y = gy;
      b.vy = 0;
      b.onGround = true;
    }
  } else if (b.y - gy > MOVE.groundSnap * k && b.windup < 0) {
    b.onGround = false;            // walked off an edge: fall
    b.vy = 0;
  } else {
    b.y = gy;
  }

  const speed = Math.hypot(b.vx, b.vz);
  if (speed > 0.15 * k) {
    const want = Math.atan2(b.vx, b.vz);
    const d = Math.atan2(Math.sin(want - b.facing), Math.cos(want - b.facing));
    b.facing += d * Math.min(1, 10 * dt);
  }
  return speed > 0.01 || !b.onGround || b.windup >= 0;
}

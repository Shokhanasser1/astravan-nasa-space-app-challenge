/**
 * The crew rover driven by the player (`?drive`, local preview): a small car model for the Moon. Pure: no three.js,
 * no DOM, same input → same output. Game rules picked to feel like the SEV (public/models/nasa-decor/sev.glb):
 * - the motors speed it up gently (0.8 m/s²) to 2.5 m/s forward, 1.0 m/s backward;
 * - the brakes (pedal against the motion, or stopping to get out) take 1.2 m/s²: about all the grip regolith gives at
 *   1/6 g (μ ≈ 0.75 × 1.62 m/s²); with no pedal it rolls out slowly (0.4 m/s²);
 * - steering turns it only while it rolls (a car, not a tank): yaw rate = speed / 3.5 m (its tightest circle), capped
 *   where the side force would make it slide (speed × yaw rate ≤ the same 1.2 m/s² of grip);
 * - its footprint is a 2.2 m disc (the model's COL_sev) that slides along the base's hitboxes (src/walk/collide.ts);
 * - it sits on the ground under its wheels: height, pitch and roll from its front, back, left and right bogies.
 *
 * Model frame (glTF): front +Z, left +X; heading = (sin yaw, cos yaw), the same as src/scene/arrival.ts.
 */
import { walkStep, type Area, type XZ } from '../walk/collide';

export const ROVER = { vmax: 2.5, vback: 1.0, accel: 0.8, brake: 1.2, coast: 0.4, turnR: 3.5, grip: 1.2, r: 2.2 } as const;
/** Bogie centres in the model (metres, sev.glb): front and back axle, left and right track. */
const WHEELS = { front: 0.94, back: -1.65, mid: -0.36, track: 1.29 } as const;

export interface Rover {
  x: number;
  z: number;
  yaw: number;
  /** Along its heading (m/s), negative backing up. */
  speed: number;
  y: number;
  /** Nose down (+), about its left axis (three.js Euler 'YXZ'). */
  pitch: number;
  /** Left side up (+), about its front axis. */
  roll: number;
}

export interface Pedals {
  /** Forward (+) or back (−), −1…1: W/S or the stick. */
  throttle: number;
  /** Right (+) or left (−), −1…1: D/A or the stick. */
  steer: number;
  /** Stop: the brakes, whatever the throttle says. */
  brake: boolean;
}

export type Ground = (x: number, z: number) => number;

const at: XZ = { x: 0, z: 0 };
const next: XZ = { x: 0, z: 0 };
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/** Height, pitch and roll from the ground under its bogies. */
export function placeOnGround(r: Rover, ground: Ground): Rover {
  const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
  // model (x, z) → world (x·cos + z·sin, −x·sin + z·cos), as in arrival.ts hatchAt()
  const front = ground(r.x + WHEELS.front * s, r.z + WHEELS.front * c);
  const back = ground(r.x + WHEELS.back * s, r.z + WHEELS.back * c);
  const left = ground(r.x + WHEELS.track * c + WHEELS.mid * s, r.z - WHEELS.track * s + WHEELS.mid * c);
  const right = ground(r.x - WHEELS.track * c + WHEELS.mid * s, r.z + WHEELS.track * s + WHEELS.mid * c);
  r.y = (front + back + left + right) / 4;
  r.pitch = Math.atan2(back - front, WHEELS.front - WHEELS.back);
  r.roll = Math.atan2(left - right, 2 * WHEELS.track);
  return r;
}

/** One frame of driving (dt in seconds). Returns true while it moves (the scene keeps drawing). */
export function stepRover(r: Rover, p: Pedals, area: Area, ground: Ground, dt: number): boolean {
  // speed: the motors towards the wanted speed; the brakes, or rolling out, back towards zero
  const t = clamp1(p.throttle);
  const want = p.brake ? 0 : t >= 0 ? t * ROVER.vmax : t * ROVER.vback;
  const dv = want - r.speed;
  const slowing = r.speed * dv < 0;
  const rate = !slowing ? ROVER.accel : p.brake || t * r.speed < 0 ? ROVER.brake : ROVER.coast;
  let v = r.speed + Math.sign(dv) * Math.min(Math.abs(dv), rate * dt);
  if (slowing && v * r.speed < 0) v = 0; // the brakes stop it; backing up is the motors' job
  r.speed = v;

  // heading: turns only while it rolls, faster with speed until the side grip runs out; steering right turns it to
  // its right (yaw down: its left is +x), and backing up turns the nose the other way, like any car
  const sp = Math.abs(v);
  const yawRate = sp > 1e-6 ? Math.min(sp / ROVER.turnR, ROVER.grip / sp) : 0;
  r.yaw -= clamp1(p.steer) * yawRate * Math.sign(v) * dt;

  // across the ground, slid along by the hitboxes. A hitbox takes speed by how much of the move it blocks: head-on
  // it stops the rover, met at 45° it lets it scrape along at up to 0.7 × its top speed.
  if (v !== 0 && dt > 0) {
    at.x = r.x;
    at.z = r.z;
    walkStep(at, Math.sin(r.yaw) * v * dt, Math.cos(r.yaw) * v * dt, area, ROVER.r, next);
    const free = Math.hypot(next.x - r.x, next.z - r.z) / (Math.abs(v) * dt);
    r.speed = Math.sign(v) * Math.min(Math.abs(v), free * (v > 0 ? ROVER.vmax : ROVER.vback));
    r.x = next.x;
    r.z = next.z;
  }
  placeOnGround(r, ground);
  return r.speed !== 0;
}

/**
 * Arrival (local preview, `?arrive`): the crew rover (SEV, public/models/nasa-decor/sev.glb, its `Drive` clip planted
 * at 1.0 m/s) drives up to its parking spot, stops, and the astronaut hops out of its side hatch onto the regolith
 * in a slow Moon fall — then the player takes over. Drive (local preview, `?drive`): the player climbs in with E,
 * drives it (src/scene/roverDrive.ts) and climbs out with E. Maths and the shared rover state here; Rig.tsx moves
 * the rover and the body, Decor.tsx draws the rover where it is, Astronaut.tsx hides the astronaut while it rides.
 *
 * Rover model frame (glTF): front +Z, left +X; the round side hatches are centred at (±1.30, 1.70, 0.30), a 1.17 m
 * opening with its sill 1.12 m above the ground (blender/decor_anim/sev_full). The astronaut (1.85 m) cannot stand
 * in it, so it steps off just outside the open door, at sill height.
 */
import type * as THREE from 'three';
import { PARKED_ROVER } from './layout';
import { groundHeight } from './ground';
import { placeOnGround, type Rover } from './roverDrive';
import { GRAVITY } from '../character/physics.js';

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const ARRIVE = params.has('arrive');
/** The player may drive the crew rover (E at its hatch climbs in, E again stops and climbs out). */
export const DRIVABLE = params.has('drive') || ARRIVE; // (?arrive brings the rover; it is drivable then too)

/** Drive: the last L metres to the parking spot in T seconds, slowing to a stop (speed 2L/T → 0). */
export const DRIVE = { L: 16, T: 12, pause: 1.2 } as const;
/** The hop out of the hatch: crouch (the JumpStart clip's length), take-off speeds (m/s), sill height (m). */
/** Out of the hatch: a step down off the sill (a small lift, then the slow 1 m Moon fall), not a jump. */
export const HOP = { crouch: 0.833, up: 0.35, out: 0.75, sill: 1.12, hatch: { x: 1.5, z: 0.3 } } as const;

export type RoverPose = { x: number; z: number; yaw: number; speed: number };

/** Rover pose t seconds after the start (heading = (sin yaw, cos yaw), its front). */
export function roverAt(t: number, out: RoverPose = { x: 0, z: 0, yaw: 0, speed: 0 }): RoverPose {
  const { x, z, yaw } = PARKED_ROVER;
  const hx = Math.sin(yaw), hz = Math.cos(yaw);
  const u = Math.min(1, Math.max(0, t / DRIVE.T));
  const left = DRIVE.L * (1 - u) * (1 - u); // distance still to go: ease-out to a stop
  out.x = x - hx * left;
  out.z = z - hz * left;
  out.yaw = yaw;
  out.speed = u < 1 ? ((2 * DRIVE.L) / DRIVE.T) * (1 - u) : 0;
  return out;
}

/** Seconds the hop out is in the air, and how far out of the hatch it lands (on level ground: 2.1 s, 1.7 m). */
const HOP_AIR = (HOP.up + Math.sqrt(HOP.up * HOP.up + 2 * GRAVITY.moon * HOP.sill)) / GRAVITY.moon;
export const HOP_OUT = HOP.out * HOP_AIR;

/** World point and outward direction of the rover's hatch for a rover pose: left (side 1) or right (side −1). */
export function hatchAt(p: RoverPose, out = { x: 0, z: 0, nx: 0, nz: 0 }, side = 1) {
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  const hx = HOP.hatch.x * side;
  // three.js rotation.y = yaw: local (x, z) → world (x·cos + z·sin, −x·sin + z·cos)
  out.x = p.x + hx * c + HOP.hatch.z * s;
  out.z = p.z - hx * s + HOP.hatch.z * c;
  out.nx = c * side; // local ±X (the left or right side) in the world
  out.nz = -s * side;
  return out;
}

/** Shared between Rig (it runs the arrival) and Decor. */
export const arrival = {
  /** seconds since the scene started the arrival; NaN = not running */
  t: ARRIVE ? 0 : NaN,
  /** where the arrival camera looks (eased) */
  look: { x: NaN, y: 0, z: 0 },
};

/** The arrival camera: standing on the ground beside the parking spot (left and a little ahead of the rover). */
export function arrivalCameraSpot(out = { x: 0, z: 0 }) {
  const { x, z, yaw } = PARKED_ROVER;
  out.x = x + Math.cos(yaw) * 7.5 + Math.sin(yaw) * 3.0;
  out.z = z - Math.sin(yaw) * 7.5 + Math.cos(yaw) * 3.0;
  return out;
}

/**
 * The crew rover, shared: the Rig writes it (the arrival script, or the player driving), Decor draws the model there
 * and plays its wheels at its speed, Astronaut hides the astronaut while `crew` rides inside.
 */
export type RoverLive = Rover & {
  driver: 'arrival' | 'player' | null;
  crew: boolean;
  /** front wheel pairs' steer angle (rad, + = left; the rear pairs turn the other way) and the input (−1 left … 1 right) */
  steer: number;
  steerInput: number;
  /** camera while driving: behind the rover, or from the cockpit seat (C) */
  cam: 'chase' | 'cockpit';
  /** filled by Decor once the model has loaded (blender/decor_anim/sev_full): the rover and its parts */
  object: THREE.Object3D | null;
  steerParts: { node: THREE.Object3D; k: number }[];
  seatLocal: THREE.Matrix4 | null;
  camLocal: THREE.Matrix4 | null;
  /** the round side hatches: how open (0…1, eased in applyRover), where each is going, their hinges from the model */
  door: { L: number; R: number };
  doorWant: { L: number; R: number };
  doorParts: { node: THREE.Object3D; side: 'L' | 'R' }[];
};
export const rover: RoverLive = {
  x: PARKED_ROVER.x,
  z: PARKED_ROVER.z,
  yaw: PARKED_ROVER.yaw,
  speed: 0,
  y: 0,
  pitch: 0,
  roll: 0,
  /** who moves it now; null: it stands where it was left */
  driver: ARRIVE ? 'arrival' : null,
  /** the astronaut rides inside (not drawn on the arrival; seated at the controls when the player drives) */
  crew: ARRIVE,
  steer: 0,
  steerInput: 0,
  cam: 'chase',
  object: null,
  steerParts: [],
  seatLocal: null,
  camLocal: null,
  door: { L: 0, R: 0 },
  doorWant: { L: 0, R: 0 },
  doorParts: [],
};

/** The hatch door: swings out on its front hinge in DOOR.T seconds to DOOR.open rad (L −, R +; blender/decor_anim/sev_full). */
export const DOOR = { T: 0.8, open: 1.75 } as const;
export const sideKey = (side: number): 'L' | 'R' => (side < 0 ? 'R' : 'L');

/** Move each door toward where it is wanted. True while one moves. */
export function stepDoors(dt: number): boolean {
  let moving = false;
  for (const k of ['L', 'R'] as const) {
    const d = rover.doorWant[k] - rover.door[k];
    if (Math.abs(d) < 1e-4) continue;
    rover.door[k] += Math.sign(d) * Math.min(Math.abs(d), dt / DOOR.T);
    moving = true;
  }
  return moving;
}

/** Put the rover model where the shared state says, wheels steered (the Rig calls it in the same frame as the camera). */
export function applyRover() {
  const o = rover.object;
  if (!o) return;
  o.position.set(rover.x, rover.y, rover.z);
  o.rotation.set(rover.pitch, rover.yaw, rover.roll, 'YXZ'); // heading, then nose and side on the ground
  for (const p of rover.steerParts) p.node.rotation.y = rover.steer * p.k;
  for (const p of rover.doorParts) {
    const u = rover.door[p.side];
    p.node.rotation.y = (p.side === 'L' ? -1 : 1) * DOOR.open * u * u * (3 - 2 * u); // L opens at −, R at + (measured)
  }
}
if (ARRIVE) {
  roverAt(0, rover); // waits at the start of its path under the title screen, wheels still
  rover.speed = 0;
}
placeOnGround(rover, groundHeight);

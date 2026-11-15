/**
 * Things the robot arm can lift (15 Nov, Samandar: "put things next to it to lift with it"): three rock samples and
 * two sample boxes on the ground in front of the parked crew rover, within the roof arm's reach. Closing the jaws
 * with the gripper's centre near one picks it up (the nearest, one at a time); it then rides in the claws, keeping
 * where it sat against them, wherever the arm or the rover goes; opening the jaws lets it fall at Moon gravity to
 * the ground and lie there. Pure (no three.js): src/scene/ArmCargo.tsx draws it and feeds the claw each frame.
 */
import { GRAVITY } from '../character/physics.js';

export type CargoKind = 'rock' | 'box';
/** A quaternion [x, y, z, w]. */
export type Quat = [number, number, number, number];

/** Sizes (m): the centre's height over the ground when it lies there, at scale 1 (ArmCargo.tsx builds them so). */
export const CARGO_SIZE = {
  /** a rough ~0.25 m stone, a little flat */
  rock: { half: 0.09, r: 0.14 },
  /** a 0.32 × 0.22 × 0.26 m sample box, white with an orange band */
  box: { half: 0.11, r: 0.2 },
} as const;
/** Jaws (armState.shown.open, 1 open … 0 closed): closing below `close` grabs, opening past `open` lets go. */
export const JAWS = { close: 0.35, open: 0.6 } as const;
/** m from the gripper's centre to a thing's centre, within which closing the jaws takes it. */
export const GRAB_R = 0.35;
/** Falling: one small bounce when it lands faster than `minV` (m/s), keeping `keep` of the speed; the tilt it had in
 * the claws eases upright at `upright` rad/s on the way down (it lies flat when it lands). */
export const FALL = { g: GRAVITY.moon as number, keep: 0.22, minV: 1.0, upright: 2.5 } as const;

export interface CargoSpot {
  kind: CargoKind;
  x: number;
  z: number;
  /** heading on the ground, rad */
  yaw: number;
  /** size against CARGO_SIZE */
  s: number;
  /** grey shade (rocks): 0 or 1 */
  shade: number;
}

export interface CargoItem extends CargoSpot {
  mode: 'rest' | 'held' | 'fall';
  y: number;
  q: Quat;
  vy: number;
  bounced: boolean;
  /** while held: the centre and the turn in the gripper's own frame */
  off: [number, number, number];
  lq: Quat;
  /** the upright turn it eases to while falling */
  up: Quat;
}

export interface CargoState {
  items: CargoItem[];
  /** index of the held one, −1 none */
  held: number;
  /** the jaws' latch (between the two thresholds it keeps what it was); null before the first step */
  jaw: 'open' | 'closed' | null;
  ground: (x: number, z: number) => number;
}

/** The gripper's centre between the claws and its turn, world space. */
export interface Grip {
  x: number;
  y: number;
  z: number;
  q: Quat;
}

/**
 * Where they lie, in the rover's own frame (front +Z, left +X; metres from its middle): an arc 3.4–3.6 m out in
 * front, past its hitbox (2.4 m) and the hatches' landing spots (±3.2 m to the sides), 3.6–4.1 m from the arm's foot
 * on the roof (0, −0.5): the gripper reaches the ground there with the arm half folded.
 */
const LOCAL: readonly (Omit<CargoSpot, 'x' | 'z' | 'yaw'> & { lx: number; lz: number; yaw: number })[] = [
  { kind: 'rock', lx: 2.65, lz: 2.3, yaw: 0.4, s: 1.0, shade: 0 },
  { kind: 'box', lx: 1.45, lz: 3.25, yaw: 0.25, s: 1, shade: 0 },
  { kind: 'rock', lx: -0.05, lz: 3.6, yaw: 2.1, s: 1.15, shade: 1 },
  { kind: 'box', lx: -1.5, lz: 3.2, yaw: -0.35, s: 1, shade: 0 },
  { kind: 'rock', lx: -2.7, lz: 2.25, yaw: 4.0, s: 0.9, shade: 1 },
];

/** The five spots in the game, in front of a rover parked at (x, z) facing yaw (three.js rotation-y). */
export function cargoSpots(rover: { x: number; z: number; yaw: number }): CargoSpot[] {
  const c = Math.cos(rover.yaw), s = Math.sin(rover.yaw);
  return LOCAL.map(({ lx, lz, yaw, ...rest }) => ({
    ...rest,
    x: rover.x + lx * c + lz * s,
    z: rover.z - lx * s + lz * c,
    yaw: yaw + rover.yaw,
  }));
}

const yawQuat = (yaw: number, out: Quat): Quat => {
  out[0] = 0;
  out[1] = Math.sin(yaw / 2);
  out[2] = 0;
  out[3] = Math.cos(yaw / 2);
  return out;
};

/** Height of a thing's centre when it lies on the ground at (x, z). */
export const restY = (it: CargoSpot, ground: (x: number, z: number) => number): number =>
  ground(it.x, it.z) + CARGO_SIZE[it.kind].half * it.s;

export function makeCargo(spots: readonly CargoSpot[], ground: (x: number, z: number) => number): CargoState {
  const items = spots.map((p): CargoItem => {
    const it: CargoItem = {
      ...p,
      mode: 'rest',
      y: 0,
      q: yawQuat(p.yaw, [0, 0, 0, 1]),
      vy: 0,
      bounced: false,
      off: [0, 0, 0],
      lq: [0, 0, 0, 1],
      up: [0, 0, 0, 1],
    };
    it.y = restY(it, ground);
    return it;
  });
  return { items, held: -1, jaw: null, ground };
}

// --- quaternion helpers, writing into `out` (no allocation) ---
function qmul(a: Quat, b: Quat, out: Quat): Quat {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];
  out[0] = aw * bx + ax * bw + ay * bz - az * by;
  out[1] = aw * by - ax * bz + ay * bw + az * bx;
  out[2] = aw * bz + ax * by - ay * bx + az * bw;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}
const conj = (a: Quat, out: Quat): Quat => ((out[0] = -a[0]), (out[1] = -a[1]), (out[2] = -a[2]), (out[3] = a[3]), out);
/** v turned by q, into out. */
function qrot(q: Quat, x: number, y: number, z: number, out: [number, number, number]): [number, number, number] {
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  out[0] = x + qw * tx + qy * tz - qz * ty;
  out[1] = y + qw * ty + qz * tx - qx * tz;
  out[2] = z + qw * tz + qx * ty - qy * tx;
  return out;
}
/** Turn a towards b by at most `maxAngle` rad (in place). */
function qtoward(a: Quat, b: Quat, maxAngle: number): void {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const sgn = d < 0 ? -1 : 1;
  d = Math.min(1, Math.abs(d));
  const ang = 2 * Math.acos(d);
  const t = ang <= maxAngle || ang < 1e-6 ? 1 : maxAngle / ang;
  for (let i = 0; i < 4; i++) a[i] = a[i] + (sgn * b[i] - a[i]) * t;
  const n = Math.hypot(a[0], a[1], a[2], a[3]) || 1;
  for (let i = 0; i < 4; i++) a[i] /= n;
}
/** The heading (rotation-y) of a turn: where its +X points on the ground. */
function headingOf(q: Quat, tmp: [number, number, number]): number {
  qrot(q, 1, 0, 0, tmp);
  return Math.atan2(-tmp[2], tmp[0]);
}

const T3: [number, number, number] = [0, 0, 0];
const TQ: Quat = [0, 0, 0, 1];

/**
 * One step: the jaws closing (`jawsOpen` falling below JAWS.close) take the nearest thing within GRAB_R of the grip;
 * the held one follows the grip; the jaws opening past JAWS.open drop it; falling ones fall and land. Returns true
 * while anything moved (the scene draws another frame).
 */
export function stepCargo(st: CargoState, dt: number, grip: Grip, jawsOpen: number): boolean {
  let moved = false;
  const was = st.jaw;
  if (jawsOpen < JAWS.close) st.jaw = 'closed';
  else if (jawsOpen > JAWS.open) st.jaw = 'open';
  else if (st.jaw === null) st.jaw = jawsOpen < (JAWS.close + JAWS.open) / 2 ? 'closed' : 'open';

  // let go
  if (was === 'closed' && st.jaw === 'open' && st.held >= 0) {
    const it = st.items[st.held];
    it.mode = 'fall';
    it.vy = 0;
    it.bounced = false;
    yawQuat(headingOf(it.q, T3), it.up);
    st.held = -1;
    moved = true;
  }
  // take the nearest within reach
  if (was === 'open' && st.jaw === 'closed' && st.held < 0) {
    let best = -1, bestD = GRAB_R;
    for (let i = 0; i < st.items.length; i++) {
      const it = st.items[i];
      const d = Math.hypot(it.x - grip.x, it.y - grip.y, it.z - grip.z);
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      const it = st.items[best];
      conj(grip.q, TQ);
      qrot(TQ, it.x - grip.x, it.y - grip.y, it.z - grip.z, it.off);
      qmul(TQ, it.q, it.lq);
      it.mode = 'held';
      it.vy = 0;
      st.held = best;
    }
  }

  for (let i = 0; i < st.items.length; i++) {
    const it = st.items[i];
    if (it.mode === 'held') {
      qrot(grip.q, it.off[0], it.off[1], it.off[2], T3);
      const x = grip.x + T3[0], y = grip.y + T3[1], z = grip.z + T3[2];
      qmul(grip.q, it.lq, TQ);
      const dq = Math.abs(TQ[0] - it.q[0]) + Math.abs(TQ[1] - it.q[1]) + Math.abs(TQ[2] - it.q[2]) + Math.abs(TQ[3] - it.q[3]);
      if (Math.abs(x - it.x) + Math.abs(y - it.y) + Math.abs(z - it.z) > 1e-5 || dq > 1e-5) moved = true;
      it.x = x;
      it.y = y;
      it.z = z;
      for (let k = 0; k < 4; k++) it.q[k] = TQ[k];
    } else if (it.mode === 'fall') {
      moved = true;
      it.vy -= FALL.g * dt;
      it.y += it.vy * dt;
      qtoward(it.q, it.up, FALL.upright * dt);
      const floor = restY(it, st.ground);
      if (it.y <= floor) {
        it.y = floor;
        if (!it.bounced && -it.vy > FALL.minV) {
          it.vy = -it.vy * FALL.keep;
          it.bounced = true;
        } else {
          it.vy = 0;
          it.mode = 'rest';
          for (let k = 0; k < 4; k++) it.q[k] = it.up[k];
        }
      }
    }
  }
  return moved;
}

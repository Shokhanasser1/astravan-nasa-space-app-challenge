/**
 * Climbing the habitat's ladder between its two floors (src/walk/rooms.ts `ladder`): a pure path in time. The
 * astronaut steps from where it stood to the ladder's foot spot (in front of the rungs, facing them), climbs (or
 * climbs down) at an even pace with soft starts and stops, then steps off to the other floor's arrival spot, where
 * the room handover puts it. On the rungs the body's origin slides onto the rungs' plane while the Climb clip fades
 * in (its origin is there, the body hangs behind it) and back as it fades out. Game metres and seconds; facing:
 * 0 = +z (the body's convention).
 */

/** Vertical climbing speed (game m/s, at the room's scale): 1.71 m between the habitat's decks in ~3.1 s. */
export const CLIMB_V = 0.6;
/** Stepping onto the ladder and off it: at this pace (game m/s), never quicker than STEP_MIN_S. */
const STEP_V = 0.8;
const STEP_MIN_S = 0.35;
/** Soft start and stop of the climb itself (s): the speed ramps up and down over this long. */
const RAMP_S = 0.25;
/** The Climb clip's cross-fade (s; src/character/anim.js): the origin moves onto the rungs over this long. */
export const GRIP_S = 0.2;
/**
 * The Climb clip (blender/game3d/characters/anim/clips/climb.py, full-size m): one cycle climbs two 0.30 m rungs;
 * at phase 0 the origin is level with the middle of the rung under the left boot. The habitat's rung middles are
 * 0.2825 + 0.3 i m above its lower deck.
 */
export const CLIMB_CYCLE = 0.6;
const RUNG0 = 0.2825;

/** The Climb clip's phase (0…1) for the origin `h` m (full size) above the lower deck: boots and hands on rungs. */
export function climbPhase(h: number): number {
  const u = (h - RUNG0) / CLIMB_CYCLE;
  return u - Math.floor(u);
}

export interface Spot {
  x: number;
  z: number;
  facing: number;
}

export interface LadderClimb {
  /** Where the body stood when E was pressed, on its floor at y0. */
  from: Spot;
  y0: number;
  /** The climbing spot in front of the rungs (facing them), the same on both floors, and the rungs' plane. */
  foot: Spot;
  rungs: { x: number; z: number };
  /** The other floor's arrival spot (the room handover's spot) and its floor height. */
  to: Spot;
  y1: number;
}

export interface ClimbPose {
  x: number;
  y: number;
  z: number;
  facing: number;
  /** Velocity (game m/s) along the path at this moment. */
  vx: number;
  vy: number;
  vz: number;
  /** 'on' (stepping to the ladder), 'climb' (on the rungs), 'off' (stepping off), 'done' (at the arrival spot). */
  stage: 'on' | 'climb' | 'off' | 'done';
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (u: number) => u * u * (3 - 2 * u);
const dSmooth = (u: number) => 6 * u * (1 - u);

/** Seconds on the rungs for a height difference of `h` (game m), ramps included. */
export function climbTime(h: number): number {
  return Math.abs(h) / CLIMB_V + RAMP_S;
}

const stepTime = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.max(STEP_MIN_S, Math.hypot(b.x - a.x, b.z - a.z) / STEP_V);

/** The whole climb's length (s). */
export function climbDuration(c: LadderClimb): number {
  return stepTime(c.from, c.foot) + climbTime(c.y1 - c.y0) + stepTime(c.foot, c.to);
}

/**
 * Height gained after `t` s of a climb of `h` m lasting `T` s: a trapezoid speed profile (ramps of RAMP_S at both
 * ends, even speed between), so it is monotonic and lands exactly on `h` at `T`. Also returns the speed.
 */
function rise(t: number, h: number, T: number): [number, number] {
  const a = Math.min(RAMP_S, T / 2);
  const v = h / (T - a); // cruise speed: area of the trapezoid = v · (T − a)
  if (t <= 0) return [0, 0];
  if (t >= T) return [h, 0];
  if (t < a) return [(v * t * t) / (2 * a), (v * t) / a];
  if (t > T - a) {
    const r = T - t;
    return [h - (v * r * r) / (2 * a), (v * r) / a];
  }
  return [v * (t - a / 2), v];
}

/** Turn from facing `a` to facing `b` the short way, by fraction `u`. */
const turn = (a: number, b: number, u: number) => a + wrap(b - a) * u;

/** Where the body is `t` s into the climb (writes into `out`, no allocation). */
export function climbPose(c: LadderClimb, t: number, out: ClimbPose): ClimbPose {
  const Tc = climbTime(c.y1 - c.y0);
  const STEP_ON_S = stepTime(c.from, c.foot);
  const STEP_OFF_S = stepTime(c.foot, c.to);
  if (t < STEP_ON_S) {
    const u = Math.max(0, t) / STEP_ON_S;
    const k = smooth(u), dk = dSmooth(u) / STEP_ON_S;
    out.x = c.from.x + (c.foot.x - c.from.x) * k;
    out.z = c.from.z + (c.foot.z - c.from.z) * k;
    out.y = c.y0;
    out.facing = turn(c.from.facing, c.foot.facing, Math.min(1, u * 1.6));
    out.vx = (c.foot.x - c.from.x) * dk;
    out.vz = (c.foot.z - c.from.z) * dk;
    out.vy = 0;
    out.stage = 'on';
    return out;
  }
  const tc = t - STEP_ON_S;
  if (tc < Tc) {
    const [dy, vy] = rise(tc, c.y1 - c.y0, Tc);
    const w = Math.min(1, tc / GRIP_S, (Tc - tc) / GRIP_S);
    out.x = c.foot.x + (c.rungs.x - c.foot.x) * w;
    out.z = c.foot.z + (c.rungs.z - c.foot.z) * w;
    out.y = c.y0 + dy;
    out.facing = c.foot.facing;
    out.vx = out.vz = 0;
    out.vy = vy;
    out.stage = 'climb';
    return out;
  }
  const to = tc - Tc;
  if (t < STEP_ON_S + Tc + STEP_OFF_S) {
    const u = to / STEP_OFF_S;
    const k = smooth(u), dk = dSmooth(u) / STEP_OFF_S;
    out.x = c.foot.x + (c.to.x - c.foot.x) * k;
    out.z = c.foot.z + (c.to.z - c.foot.z) * k;
    out.y = c.y1;
    out.facing = turn(c.foot.facing, c.to.facing, smooth(u));
    out.vx = (c.to.x - c.foot.x) * dk;
    out.vz = (c.to.z - c.foot.z) * dk;
    out.vy = 0;
    out.stage = 'off';
    return out;
  }
  out.x = c.to.x;
  out.z = c.to.z;
  out.y = c.y1;
  out.facing = c.to.facing;
  out.vx = out.vy = out.vz = 0;
  out.stage = 'done';
  return out;
}

/**
 * On the rungs now (written by the Rig, read by the Astronaut for the Climb clip): `vy` the vertical speed in game
 * m/s (negative: climbing down), `phase` the Climb clip's phase there (climbPhase).
 */
export const climbState = { on: false, vy: 0, phase: 0 };

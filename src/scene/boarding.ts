/**
 * Day 7 boarding (home story, features.homeStory; the lead's document p. 12 "Astronavt yerda qolardi", p. 17): on
 * launch, under a short countdown, the astronaut walks to the base ship's ladder, climbs it, steps along the porch
 * through the forward hatch and is on board (hidden); then the camera shows the liftoff from the hill. It is a cut,
 * never a walk across the base: from wherever it stood (a room, the rover, behind a building) the astronaut appears
 * a few steps from the ladder's foot, so it never walks through a wall. Off → the lander lifts off at once, as before.
 *
 * The ladder is ASTRA's (src/vendor/astra/scene/models/site.ts buildLander('moon')): down the front-left landing leg,
 * at 135° in the lander's model frame (+z = its front, which faces the middle of the base, AstraBase.tsx faceCentre),
 * leaning out from the porch deck to the ground; the porch and the walkway to the hatch are our lander interior's
 * (public/models/interiors/lander.glb, sill y 3.00 — src/scene/astra/shellFit.test.ts). Both base plans place the same
 * lander, ASTRA's spot or the HDU complex's (layout.ts basePlan), so the path is built per plan.
 *
 * Pure: a path in time, game metres and seconds; facing 0 = +z (the body's convention). No allocation per frame.
 */
import { features } from '../config/features';
import { ASTRA_SCALE, PLAN, type BasePlan } from './layout';
import { CLIMB_CYCLE, GRIP_S } from '../walk/ladder';

/** The astronaut boards before the liftoff (home story); off → the lander lifts off at once, as before. */
export const boarding = features.homeStory;

/** ASTRA's lander, model frame (native metres). */
const M = {
  /** The ladder's leg: x = cos(az)·r, z = sin(az)·r. */
  az: (3 * Math.PI) / 4,
  bottom: { r: 3.2, y: 0.45 },
  top: { r: 1.95, y: 2.6 },
  /** The porch deck and the walkway to the hatch. */
  deck: 3.0,
  /** On the porch, in front of the forward hatch; and through it, on board. */
  porch: { x: 0, z: 1.65 },
  inside: { x: 0, z: 0.95 },
};
/** On the Climb clip the body hangs this far (game m) behind the rungs (src/walk/rooms.ts BODY_BEHIND). */
const BEHIND = 0.42;
/** Walked to the ladder's foot after the cut (game m). */
const APPROACH = 1.0;
/** Walking pace on the ground and on the porch (game m/s). */
const WALK_V = 0.9;
/** Up the rungs (game m/s; the habitat's ladder is climbed at 0.6 — a launch is a hurry). */
const CLIMB_V = 1.0;
/** Soft start and stop of the climb (s). */
const RAMP_S = 0.25;
/** A breath on board before the engine lights (s). */
const HOLD_S = 0.4;
/** The boarding shot: the camera this far out from the lander along the ladder's leg, this far to its side, this high. */
const CAM = { out: 7.0, side: 3.5, h: 2.3 };

export interface XZ {
  x: number;
  z: number;
}
export type BoardStage = 'walk' | 'climb' | 'porch' | 'in' | 'aboard';

export interface BoardPath {
  /** Where the cut puts the astronaut, and the ladder's foot (both on the ground, facing the ladder). */
  approach: XZ;
  foot: XZ;
  /** The climber's origin on the rungs' line: at the ground (y 0) and at the deck (y = deckY). */
  low: XZ;
  high: XZ;
  deckY: number;
  /** Facing the rungs (toward the lander's axis). */
  climbFacing: number;
  porch: XZ;
  inside: XZ;
  /** Facing into the hatch. */
  hatchFacing: number;
  /** The boarding shot's spot (on the ground: add the ground height and `h`). */
  camera: XZ & { h: number };
  /** Seconds of each stage. */
  T: { walk: number; climb: number; porch: number; in: number };
}

export interface BoardPose {
  x: number;
  y: number;
  z: number;
  facing: number;
  vx: number;
  vy: number;
  vz: number;
  stage: BoardStage;
  /** Height climbed so far (game m): scrubs the Climb clip. */
  h: number;
}

const smooth = (u: number) => u * u * (3 - 2 * u);
const dSmooth = (u: number) => 6 * u * (1 - u);
const dist = (a: XZ, b: XZ) => Math.hypot(b.x - a.x, b.z - a.z);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** The ladder's line, model frame: its radius at height y (native m), straight on past both ends. */
const lineR = (y: number) => M.bottom.r + ((y - M.bottom.y) * (M.top.r - M.bottom.r)) / (M.top.y - M.bottom.y);

/** The boarding path at one base plan's lander (model frame → game: turned to face the base's middle, scaled). */
export function boardPath(plan: BasePlan = PLAN): BoardPath {
  const [lx, lz] = plan.LAYOUT.lander;
  const turn = Math.atan2(-lx, -lz); // AstraBase.tsx faceCentre
  const k = ASTRA_SCALE.lander;
  const c = Math.cos(turn), s = Math.sin(turn);
  /** A model-frame point (native m) in the game (three.js rotation about y). */
  const at = (mx: number, mz: number): XZ => ({ x: lx + (mx * c + mz * s) * k, z: lz + (-mx * s + mz * c) * k });
  const ux = Math.cos(M.az), uz = Math.sin(M.az); // model: out along the ladder's leg
  const onLeg = (r: number) => at(ux * r, uz * r);
  // (game metres along the leg ÷ k = model metres)
  const foot = onLeg(M.bottom.r + BEHIND / k);
  const approach = onLeg(M.bottom.r + (BEHIND + APPROACH) / k);
  const low = onLeg(lineR(0));
  const high = onLeg(lineR(M.deck));
  const porch = at(M.porch.x, M.porch.z);
  const inside = at(M.inside.x, M.inside.z);
  // facing a direction (dx, dz) in the game: atan2(dx, dz)
  const climbFacing = Math.atan2(low.x - foot.x, low.z - foot.z);
  const hatchFacing = Math.atan2(inside.x - porch.x, inside.z - porch.z);
  // the shot: out along the leg, then to its side away from the base's front (model −x, −z)
  const camM = { x: ux * (CAM.out / k) + uz * (CAM.side / k), z: uz * (CAM.out / k) - ux * (CAM.side / k) };
  const cam = at(camM.x, camM.z);
  const deckY = M.deck * k;
  return {
    approach, foot, low, high, deckY, climbFacing, porch, inside, hatchFacing,
    camera: { ...cam, h: CAM.h },
    T: {
      walk: APPROACH / WALK_V,
      climb: deckY / CLIMB_V + RAMP_S,
      porch: dist(high, porch) / WALK_V,
      in: dist(porch, inside) / WALK_V,
    },
  };
}

/** Seconds from the launch to on board, the hold included: the countdown, and when the lander lifts off. */
export function boardSeconds(p: BoardPath): number {
  return p.T.walk + p.T.climb + p.T.porch + p.T.in + HOLD_S;
}

/** The game's boarding path (the plan the game is on) and how long it takes (the same on both plans). */
export const BOARD_PATH = boardPath();
export const BOARD_S = boardSeconds(BOARD_PATH);
/** Liftoff waits this long after the launch phase opens (0 with the flag off: as before). */
export const LIFTOFF_DELAY_S = boarding ? BOARD_S : 0;

/** Height gained after `t` s of a climb of `h` m lasting `T` s: trapezoid speed (soft start and stop), and the speed. */
function rise(t: number, h: number, T: number): [number, number] {
  const a = Math.min(RAMP_S, T / 2);
  const v = h / (T - a);
  if (t <= 0) return [0, 0];
  if (t >= T) return [h, 0];
  if (t < a) return [(v * t * t) / (2 * a), (v * t) / a];
  if (t > T - a) {
    const r = T - t;
    return [h - (v * r * r) / (2 * a), (v * r) / a];
  }
  return [v * (t - a / 2), v];
}

/** A straight step from a to b over T s with a soft start and stop, at height y (writes `out`). */
function step(out: BoardPose, a: XZ, b: XZ, t: number, T: number, y: number) {
  const u = Math.min(1, Math.max(0, t / T));
  const kk = smooth(u), dk = dSmooth(u) / T;
  out.x = a.x + (b.x - a.x) * kk;
  out.z = a.z + (b.z - a.z) * kk;
  out.y = y;
  out.vx = (b.x - a.x) * dk;
  out.vz = (b.z - a.z) * dk;
  out.vy = 0;
}

/** Where the astronaut is `t` s after the launch opened (writes into `out`, no allocation). */
export function boardPose(p: BoardPath, t: number, out: BoardPose): BoardPose {
  const { T } = p;
  let tt = Math.max(0, t);
  if (tt < T.walk) {
    step(out, p.approach, p.foot, tt, T.walk, 0);
    out.facing = p.climbFacing;
    out.stage = 'walk';
    out.h = 0;
    return out;
  }
  tt -= T.walk;
  if (tt < T.climb) {
    const [y, vy] = rise(tt, p.deckY, T.climb);
    const u = y / p.deckY;
    // the origin slides from the foot spot onto the rungs' line as the Climb clip fades in (ladder.ts GRIP_S)
    const w = Math.min(1, tt / GRIP_S);
    const lx = p.low.x + (p.high.x - p.low.x) * u, lz = p.low.z + (p.high.z - p.low.z) * u;
    out.x = p.foot.x + (lx - p.foot.x) * w;
    out.z = p.foot.z + (lz - p.foot.z) * w;
    out.y = y;
    out.vx = out.vz = 0;
    out.vy = vy;
    out.facing = p.climbFacing;
    out.stage = 'climb';
    out.h = y;
    return out;
  }
  tt -= T.climb;
  out.h = p.deckY;
  if (tt < T.porch) {
    step(out, p.high, p.porch, tt, T.porch, p.deckY);
    out.facing = p.climbFacing + wrap(p.hatchFacing - p.climbFacing) * smooth(Math.min(1, tt / T.porch));
    out.stage = 'porch';
    return out;
  }
  tt -= T.porch;
  if (tt < T.in) {
    step(out, p.porch, p.inside, tt, T.in, p.deckY);
    out.facing = p.hatchFacing;
    out.stage = 'in';
    return out;
  }
  out.x = p.inside.x;
  out.z = p.inside.z;
  out.y = p.deckY;
  out.vx = out.vy = out.vz = 0;
  out.facing = p.hatchFacing;
  out.stage = 'aboard';
  return out;
}

/** The Climb clip's phase (0…1) for a height climbed `h` (game m; the clip climbs two rungs a cycle, full size). */
export function boardClimbPhase(h: number): number {
  const u = h / CLIMB_CYCLE;
  return u - Math.floor(u);
}

/** Runtime: when this launch's boarding began (performance.now() s; < 0 = none). Written by the Rig only. */
export const boardState = { t0: -1, pose: { x: 0, y: 0, z: 0, facing: 0, vx: 0, vy: 0, vz: 0, stage: 'walk', h: 0 } as BoardPose };

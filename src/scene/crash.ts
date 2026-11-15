/**
 * Home story T2 (Shoxjahon aka's document "tanqid, yangi ssenariy va o'yin mantig'i", 15 Nov, pp. 6–7 and 18): Day 1
 * of a first mission opens at the crash site, not at the airlock. "CRASH = [-22, -50]: ~55 m from the habitat, on the
 * dark ice-crater side, inside the walk edge." Beside the astronaut: the lander tipped ~35° on its side and an
 * overturned rover (src/scene/Wreck.tsx); far ahead, the base light at the habitat door. The first task is to walk
 * there: done within REACH_M of the door (or when Next skips the walk, as before).
 *
 * The crash site is the same on both base plans (ASTRA's and the HDU complex, `?hdu`): 55 m out, it is far from
 * everything either plan moves, and its frame points at the middle of the pad, where both habitat doors stand within
 * 4 m. Scene-only numbers (positions, sizes), never game numbers; pure, tested in src/scene/crash.test.ts.
 */
import { features } from '../config/features';
import { PLAN, type BasePlan, type XZ } from './layout';
import type { Solid } from '../walk/collide';

/** The crash start is on (it needs the home story). */
export const CRASH_ON: boolean = features.homeStory && features.homeStoryCrash;

/** The document's crash site: where the astronaut wakes up. */
export const CRASH: XZ = [-22, -50];

const D = Math.hypot(CRASH[0], CRASH[1]);
/** Ahead: from the crash site toward the middle of the base. */
const AHEAD: XZ = [-CRASH[0] / D, -CRASH[1] / D];
/** Left of AHEAD (looking along +z, +x is on the left in three.js). Day 1's low Sun (azimuth ~304°) is on the right:
 * the wreck on the left shows its lit side to the path, and its shadow falls away from it. */
const LEFT: XZ = [AHEAD[1], -AHEAD[0]];

/** A point `ahead` metres toward the base and `left` metres to the left of the crash site. */
function crashFrame(ahead: number, left: number): [number, number] {
  return [CRASH[0] + AHEAD[0] * ahead + LEFT[0] * left, CRASH[1] + AHEAD[1] * ahead + LEFT[1] * left];
}

const W = crashFrame(14, 4.2);
/**
 * The wrecked lander (ASTRA's lander model at its base scale, src/scene/AstraBase.tsx): its base on the ground ahead
 * left of the path (in a phone's narrow upright view from behind the astronaut), tipped `tilt` toward `lean` (away
 * from the path, its legs on that side buried), sunk `sink` metres. `r` = its hitbox round the tipped body and legs.
 */
export const WRECK = {
  x: W[0],
  z: W[1],
  /** three.js rotation-y that turns the model's +z toward the lean. */
  yaw: Math.atan2(LEFT[0], LEFT[1]),
  tilt: (35 * Math.PI) / 180,
  sink: 0.35,
  /** How far the tipped top reaches out along the lean (4.1 m tall × sin 35°). */
  reach: 2.35,
  r: 2.5,
} as const;

const R = crashFrame(10, -3.0);
/** The overturned rover (the scout kit model, upside down) ahead right of the path; r = its hitbox. */
export const WRECK_ROVER = { x: R[0], z: R[1], yaw: Math.atan2(AHEAD[0], AHEAD[1]) + 0.6, r: 1.2 } as const;

/** The red light blinking on the wreck: its place in the lander model's own frame (metres, before its 0.7 scale). */
export const WRECK_LIGHT: readonly [number, number, number] = [0.5, 5.75, 0.3];

/** The hitboxes of the crash site: the tipped lander (a bar along its lean) and the rover. */
export function wreckSolids(): Solid[] {
  return [
    {
      name: 'wreck',
      x: WRECK.x,
      z: WRECK.z,
      bx: WRECK.x + LEFT[0] * WRECK.reach,
      bz: WRECK.z + LEFT[1] * WRECK.reach,
      r: WRECK.r,
    },
    { name: 'wreck rover', x: WRECK_ROVER.x, z: WRECK_ROVER.z, r: WRECK_ROVER.r },
  ];
}

/** Within this many metres of the habitat door the first task, "Reach the base", is done (the document, p. 17). */
export const REACH_M = 6;

/** The habitat door's outer face on a plan (where its glowing marker stands). */
export function doorSpot(plan: BasePlan = PLAN): [number, number] {
  return plan.fromDoor(plan.DOOR_R);
}

/** The astronaut at (x, z) has reached the base: within REACH_M of the habitat door. */
export function reachedBase(x: number, z: number, plan: BasePlan = PLAN): boolean {
  const [dx, dz] = doorSpot(plan);
  return Math.hypot(x - dx, z - dz) <= REACH_M;
}

/** Where the astronaut starts and which way it faces (body.facing: 0 = +z): at the crash site, toward the door. */
export function crashStart(plan: BasePlan = PLAN): { x: number; z: number; facing: number } {
  const [dx, dz] = doorSpot(plan);
  return { x: CRASH[0], z: CRASH[1], facing: Math.atan2(dx - CRASH[0], dz - CRASH[1]) };
}

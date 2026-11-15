/**
 * Going through a building's door on foot (15 Nov playtest: "it goes in without touching the door"). E at the door
 * no longer jumps the astronaut inside: it walks onto the doorstep, turns to the door, waits while the door swings
 * open, walks into the doorway, and the view dips to black for a moment while it passes inside. Going out is the
 * same backwards: the door opens, a dip, the astronaut steps out of the doorway onto the doorstep, facing out.
 *
 * Pure: the rig asks for the pose at a time and applies it (src/scene/Rig.tsx). Scene-only numbers.
 */
import type { XZ } from './collide';

export interface Spot extends XZ {
  facing: number;
}

export interface DoorPlan {
  /** 1 in, −1 out. */
  dir: 1 | -1;
  /** Where the astronaut stands when E is pressed (outside: on or near the doorstep). */
  from: Spot;
  /** The doorstep outside, facing the door. */
  step: Spot;
  /** The doorway (null: the door is out of reach on foot, the lander's hatch up its ladder). */
  way: XZ | null;
}

export const DOOR_WALK = {
  /** Walking pace through the door, m/s (the Walk clip's own speed: src/character/physics.js MOVE.walk). */
  speed: 1.0,
  /** The door swings open in this long (src/scene/Interiors.tsx DOOR_S). */
  open: 0.8,
  /** The dip to black and back, s each way. */
  fade: 0.22,
  /** Out of a door that cannot be walked through (the lander), the astronaut still takes this one step out. */
  stepOut: 0.6,
} as const;

export interface DoorTimes {
  /** In: on the doorstep. */
  atStep: number;
  /** The door is open (and the astronaut faces it): it walks into the doorway. */
  go: number;
  /** The cut: inside the room (in) or outside in the doorway (out). */
  cut: number;
  /** All over: the door closes behind. */
  end: number;
}

const dist = (a: XZ, b: XZ) => Math.hypot(b.x - a.x, b.z - a.z);

export function doorTimes(p: DoorPlan): DoorTimes {
  const { speed, open, fade } = DOOR_WALK;
  if (p.dir > 0) {
    const atStep = dist(p.from, p.step) / speed;
    const go = Math.max(atStep + 0.15, open); // (a moment on the doorstep to turn to the door)
    const cut = go + (p.way ? dist(p.step, p.way) / speed : 0) + (p.way ? 0 : fade);
    return { atStep, go, cut, end: cut + fade };
  }
  const cut = open;
  const walk = p.way ? dist(p.way, p.step) : DOOR_WALK.stepOut;
  return { atStep: cut + walk / speed, go: cut, cut, end: Math.max(cut + walk / speed, cut + fade) };
}

/** 0 = clear view, 1 = black: down over the last `fade` before the cut, back up over `fade` after it. */
export function doorFade(p: DoorPlan, t: number, T = doorTimes(p)): number {
  const f = DOOR_WALK.fade;
  if (t <= T.cut - f || t >= T.cut + f) return 0;
  return t < T.cut ? (t - (T.cut - f)) / f : 1 - (t - T.cut) / f;
}

export interface DoorPose extends Spot {
  vx: number;
  vz: number;
}

/** Linear walk from a to b at the door pace, `t` seconds after leaving a. */
function along(a: XZ, b: XZ, t: number, out: DoorPose): DoorPose {
  const d = dist(a, b);
  const k = d > 1e-6 ? Math.min(1, (t * DOOR_WALK.speed) / d) : 1;
  out.x = a.x + (b.x - a.x) * k;
  out.z = a.z + (b.z - a.z) * k;
  const moving = d > 1e-6 && t * DOOR_WALK.speed < d - 1e-6;
  out.vx = moving ? ((b.x - a.x) / d) * DOOR_WALK.speed : 0;
  out.vz = moving ? ((b.z - a.z) / d) * DOOR_WALK.speed : 0;
  if (d > 0.05) out.facing = Math.atan2(b.x - a.x, b.z - a.z);
  return out;
}

/**
 * The astronaut's place, facing and walking velocity at `t`. In: outside until the cut (after it the rig has put it
 * in its room). Out: outside from the cut on (before it, it stands in its room while the door opens).
 */
export function doorPose(p: DoorPlan, t: number, out: DoorPose, T = doorTimes(p)): DoorPose {
  if (p.dir > 0) {
    if (t < T.atStep) {
      along(p.from, p.step, t, out);
    } else if (t < T.go || !p.way) {
      out.x = p.step.x;
      out.z = p.step.z;
      out.vx = out.vz = 0;
      out.facing = p.step.facing;
    } else {
      along(p.step, p.way, t - T.go, out);
      out.facing = p.step.facing;
    }
    return out;
  }
  const outward = p.step.facing + Math.PI;
  const a = p.way ?? p.step;
  const b = p.way ? p.step : { x: p.step.x + Math.sin(outward) * DOOR_WALK.stepOut, z: p.step.z + Math.cos(outward) * DOOR_WALK.stepOut };
  along(a, b, Math.max(0, t - T.cut), out);
  out.facing = outward;
  return out;
}

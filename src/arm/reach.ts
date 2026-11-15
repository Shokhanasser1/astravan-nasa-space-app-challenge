/**
 * Robot arm hand scanner: camera points -> the robot arm's targets. Pure functions on MediaPipe landmarks
 * (normalised image coordinates: x to the right, y down, 0..1).
 *   Pose, 33 points: 13/14 elbows, 15/16 wrists (each with .visibility 0..1). The shoulder is not used.
 *   Hand, 21 points: 0 wrist, 9 middle-finger knuckle, 4/8/12/16/20 fingertips.
 * The scan runs from the fingertips to the elbow (Shoxjahon aka, 15 Nov) and the player's forearm and hand play the
 * robot arm:
 *   forearm (elbow -> wrist) raised -> the robot's upper arm lifts by the same angle;
 *   hand bent at the wrist (up or down from the forearm's line) -> the robot's wrist (the tool turret) turns that way,
 *   and its elbow follows by a smaller share, so the arm curls like the hand;
 *   all fingertips together -> the gripper closes; hand open -> it opens.
 * Without the elbow in view (only a hand), the hand's own direction lifts the arm and the elbow and wrist stay
 * straight. The robot never follows into the ground: kin.ts limits the pose it shows.
 */

export interface Pt {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/** Robot shoulder lift, degrees above horizontal. */
export const LIFT = { min: -20, max: 75 };
/** Robot elbow, degrees from a straight arm: + bends the forearm up, - down (the model rests at +90). */
export const BEND = { min: -80, max: 120 };
/** Robot wrist (tool turret), degrees from the forearm's line: + up, - down. */
export const WRIST = { min: -95, max: 95 };
/** The roof turret turns this far either way (degrees): the keys turn it (src/arm/keys.ts); the scanner leaves it. */
export const TURN = { min: -170, max: 170 };
/** The player's wrist bend -> the robot's wrist (scaled up: a hand bends less than a robot wrist) and elbow. */
export const WRIST_GAIN = 1.3;
export const ELBOW_SHARE = 0.5;
/** Fingertip spread (in palm lengths) read as a closed and as a fully open hand. */
export const GRIP = { closed: 0.2, open: 0.5 };
/** Pose points [elbow, wrist] of each arm (MediaPipe's left = the person's left). */
export const ARM_SIDES = { left: [13, 15], right: [14, 16] } as const;
export type Side = keyof typeof ARM_SIDES;

export interface Targets {
  lift: number | null;
  bend: number | null;
  wrist: number | null;
  open: number | null;
  side: Side | null;
  elbow: Pt | null;
}

const DEG = 180 / Math.PI;
const TIPS = [4, 8, 12, 16, 20];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const seen = (p: Pt | undefined) => !!p && (p.visibility == null || p.visibility >= 0.5);

/** Elevation of the direction a -> b in degrees: -90 down, 0 level (either way), +90 straight up. */
export function elevation(a: Pt, b: Pt, aspect = 1): number {
  const dx = (b.x - a.x) * aspect;
  const dy = a.y - b.y;
  return Math.atan2(dy, Math.abs(dx)) * DEG;
}

/** How open the hand is: 0 = all fingertips together (or a fist), 1 = fingers spread. Null without a palm. */
export function openness(hand: readonly Pt[], aspect = 1): number | null {
  const palm = Math.hypot((hand[9].x - hand[0].x) * aspect, hand[9].y - hand[0].y);
  if (palm < 1e-6) return null;
  let cx = 0;
  let cy = 0;
  for (const i of TIPS) {
    cx += hand[i].x;
    cy += hand[i].y;
  }
  cx /= TIPS.length;
  cy /= TIPS.length;
  let spread = 0;
  for (const i of TIPS) spread += Math.hypot((hand[i].x - cx) * aspect, hand[i].y - cy);
  spread /= TIPS.length * palm;
  return clamp((spread - GRIP.closed) / (GRIP.open - GRIP.closed), 0, 1);
}

/** Which arm's elbow belongs to the scan: the arm whose wrist is nearest the tracked hand, else the better seen one. */
export function pickSide(pose: readonly Pt[], hand: readonly Pt[] | null, aspect = 1): Side | null {
  const ok = (side: Side) => seen(pose[ARM_SIDES[side][0]]) && !!pose[ARM_SIDES[side][1]];
  const sides = (['left', 'right'] as const).filter(ok);
  if (!sides.length) return null;
  if (sides.length === 1 && !hand) return sides[0];
  if (hand) {
    const d = (side: Side) => {
      const w = pose[ARM_SIDES[side][1]];
      return Math.hypot((w.x - hand[0].x) * aspect, w.y - hand[0].y);
    };
    // the hand must really sit at that arm's wrist (within ~2 palm lengths), or the elbow is someone else's guess
    const palm = Math.hypot((hand[9].x - hand[0].x) * aspect, hand[9].y - hand[0].y);
    const best = sides.reduce((a, b) => (d(a) <= d(b) ? a : b));
    return d(best) <= Math.max(2 * palm, 0.05) ? best : null;
  }
  const v = (side: Side) => (pose[ARM_SIDES[side][0]].visibility ?? 1) + (pose[ARM_SIDES[side][1]].visibility ?? 1);
  return v('left') >= v('right') ? 'left' : 'right';
}

/**
 * One camera frame -> the arm's targets (degrees, 0..1 for open). A value the camera did not see is null, so the
 * arm keeps its last pose for it.
 */
export function armTargets(pose: readonly Pt[] | null, hand: readonly Pt[] | null, aspect = 4 / 3): Targets {
  let lift: number | null = null;
  let bend: number | null = null;
  let wrist: number | null = null;
  let side: Side | null = null;
  let elbow: Pt | null = null;
  if (pose) {
    side = pickSide(pose, hand, aspect);
    if (side) elbow = pose[ARM_SIDES[side][0]];
  }
  if (elbow && pose && side) {
    const at = hand ? hand[0] : pose[ARM_SIDES[side][1]];
    const fore = elevation(elbow, at, aspect);
    lift = clamp(fore, LIFT.min, LIFT.max);
    if (hand) {
      const d = elevation(hand[0], hand[9], aspect) - fore; // the player's wrist bend, + up
      wrist = clamp(d * WRIST_GAIN, WRIST.min, WRIST.max);
      bend = clamp(d * ELBOW_SHARE, BEND.min, BEND.max);
    }
  } else if (hand) {
    lift = clamp(elevation(hand[0], hand[9], aspect), LIFT.min, LIFT.max);
    bend = 0;
    wrist = 0;
  }
  const open = hand ? openness(hand, aspect) : null;
  return { lift, bend, wrist, open, side, elbow };
}

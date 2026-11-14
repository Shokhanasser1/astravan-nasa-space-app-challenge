/**
 * Hand gestures from the 21 MediaPipe hand points (docs/specs/2026-11-14-hand-control-research.md, Asilbek).
 * Pure: no camera, no DOM. Points are in the camera picture, 0…1; the picture is a selfie, so x is mirrored.
 *
 *   ☝️ index finger only → a cursor on the screen      🤏 thumb to index → tap where the cursor is
 *   ✋ open palm → walk the way the palm is from the middle   ✊ fist → jump
 */
export interface Pt {
  x: number;
  y: number;
}
export type Pose = 'point' | 'pinch' | 'open' | 'fist' | 'none';

export interface Hand {
  /** Cursor on the screen, 0…1 (index fingertip, mirrored; the middle 60 % of the picture covers the screen). */
  x: number;
  y: number;
  /** Palm centre on the screen, 0…1 (for walking). */
  px: number;
  py: number;
  /** Thumb tip to index tip, in palm sizes (small = pinched). */
  pinch: number;
  /** Long fingers stretched out (index, middle, ring, little): 0…4. */
  fingers: number;
  /** Long fingers folded into the palm (tip nearer the wrist than its knuckle): 4 = a fist. */
  curled: number;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** The middle 60 % of the picture fills the screen: no need to stretch the arm to the edge (tired arms). */
const toScreen = (x: number, y: number): [number, number] => [clamp01((1 - x - 0.2) / 0.6), clamp01((y - 0.2) / 0.6)];

/** Tip, middle joint: a finger is out when its tip is clearly farther from the wrist than its middle joint. */
const FINGERS: [number, number, number][] = [
  [8, 6, 5],
  [12, 10, 9],
  [16, 14, 13],
  [20, 18, 17],
];

export function readHand(l: readonly Pt[]): Hand {
  const palm = Math.max(dist(l[0], l[9]), 1e-3); // wrist to the middle finger's knuckle
  const fingers = FINGERS.filter(([tip, mid]) => dist(l[0], l[tip]) > dist(l[0], l[mid]) * 1.12).length;
  const curled = FINGERS.filter(([tip, , knuckle]) => dist(l[0], l[tip]) < dist(l[0], l[knuckle]) * 1.05).length;
  const [x, y] = toScreen(l[8].x, l[8].y);
  const [px, py] = toScreen(l[9].x, l[9].y);
  return { x, y, px, py, pinch: dist(l[4], l[8]) / palm, fingers, curled };
}

/**
 * A fist first (its thumb rests on the index, which would look like a pinch); then the pinch, with two thresholds so
 * a half-open pinch does not flicker: it closes below 0.25 palms and opens above 0.4.
 */
export function poseOf(h: Hand, wasPinch: boolean): Pose {
  if (h.curled === 4) return 'fist';
  if (h.pinch < (wasPinch ? 0.4 : 0.25)) return 'pinch';
  if (h.fingers >= 4) return 'open';
  if (h.fingers === 1) return 'point';
  return 'none';
}

/** Walking with an open palm: how far the palm is from the middle of the picture, as the touch stick (−1…1). */
export function palmStick(h: Hand): Pt {
  const dead = 0.08;
  const f = (v: number) => (Math.abs(v) < dead ? 0 : Math.max(-1, Math.min(1, (v - Math.sign(v) * dead) * 3)));
  return { x: f(h.px - 0.5), y: f(0.5 - h.py) };
}

/** A steady cursor: follows slow moves smoothly and fast moves quickly (a simple version of the 1€ filter). */
export function follow(prev: Pt, next: Pt, dt: number): Pt {
  const speed = Math.hypot(next.x - prev.x, next.y - prev.y) / Math.max(dt, 1e-3);
  const k = 1 - Math.exp(-dt * (8 + 60 * speed));
  return { x: prev.x + (next.x - prev.x) * k, y: prev.y + (next.y - prev.y) * k };
}

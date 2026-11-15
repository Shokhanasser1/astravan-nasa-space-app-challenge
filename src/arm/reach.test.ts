import { describe, expect, it } from 'vitest';
import { BEND, ELBOW_SHARE, LIFT, WRIST, WRIST_GAIN, armTargets, elevation, openness, pickSide } from './reach';

type P = { x: number; y: number; visibility?: number };
const pt = (x: number, y: number, visibility = 1): P => ({ x, y, visibility });

/** A pose with only the given points set (others unseen). */
function pose(points: Record<number, P>): P[] {
  const out: P[] = Array.from({ length: 33 }, () => pt(0, 0, 0));
  for (const [i, p] of Object.entries(points)) out[Number(i)] = p;
  return out;
}

/**
 * A hand: wrist at (x, y), the palm 0.1 long pointing at `deg` (0 = to the right, 90 = up), fingertips spread by
 * `spread` (in palm lengths) around a point past the knuckles.
 */
function hand(x: number, y: number, deg: number, spread: number): P[] {
  const r = (deg * Math.PI) / 180;
  const ux = Math.cos(r), uy = -Math.sin(r);
  const h: P[] = Array.from({ length: 21 }, () => pt(x, y));
  h[9] = pt(x + ux * 0.1, y + uy * 0.1);
  const cx = x + ux * 0.17, cy = y + uy * 0.17;
  [4, 8, 12, 16, 20].forEach((i, k) => {
    const a = (k / 5) * Math.PI * 2;
    h[i] = pt(cx + Math.cos(a) * spread * 0.1, cy + Math.sin(a) * spread * 0.1);
  });
  return h;
}

describe('elevation', () => {
  it('reads down, level (either way) and up', () => {
    const a = pt(0.5, 0.5);
    expect(elevation(a, pt(0.5, 0.7))).toBeCloseTo(-90);
    expect(elevation(a, pt(0.7, 0.5))).toBeCloseTo(0);
    expect(elevation(a, pt(0.3, 0.5))).toBeCloseTo(0);
    expect(elevation(a, pt(0.5, 0.3))).toBeCloseTo(90);
  });
});

describe('hand openness', () => {
  it('is 0 with all fingertips together and 1 with the fingers spread', () => {
    expect(openness(hand(0.5, 0.5, 90, 0.05))).toBe(0);
    expect(openness(hand(0.5, 0.5, 90, 0.8))).toBe(1);
    const half = openness(hand(0.5, 0.5, 90, 0.35))!;
    expect(half).toBeGreaterThan(0.3);
    expect(half).toBeLessThan(0.7);
  });
});

describe('whose elbow', () => {
  const both = pose({ 13: pt(0.7, 0.7), 15: pt(0.75, 0.5), 14: pt(0.3, 0.7), 16: pt(0.25, 0.5) });
  it('takes the arm whose wrist holds the tracked hand', () => {
    expect(pickSide(both, hand(0.25, 0.5, 90, 0.5))).toBe('right');
    expect(pickSide(both, hand(0.75, 0.5, 90, 0.5))).toBe('left');
  });
  it('ignores an elbow whose wrist is far from the hand', () => {
    expect(pickSide(pose({ 14: pt(0.3, 0.7), 16: pt(0.25, 0.5) }), hand(0.8, 0.2, 90, 0.5))).toBeNull();
  });
  it('without a hand takes the arm it sees, or none', () => {
    expect(pickSide(pose({ 14: pt(0.3, 0.7), 16: pt(0.25, 0.5) }), null)).toBe('right');
    expect(pickSide(pose({}), null)).toBeNull();
  });
});

describe('arm targets: fingertips to elbow', () => {
  const E = pt(0.4, 0.7);
  it('lifts the robot arm by the forearm angle', () => {
    const level = armTargets(pose({ 14: E, 16: pt(0.6, 0.7) }), hand(0.6, 0.7, 0, 0.5), 1);
    const half = armTargets(pose({ 14: E, 16: pt(0.54, 0.56) }), hand(0.54, 0.56, 45, 0.5), 1);
    const up = armTargets(pose({ 14: E, 16: pt(0.4, 0.5) }), hand(0.4, 0.5, 90, 0.5), 1);
    expect(level.lift).toBeCloseTo(0);
    expect(half.lift).toBeCloseTo(45);
    expect(up.lift).toBe(LIFT.max);
    expect(level.side).toBe('right');
  });
  it('turns the robot wrist with the player wrist, up or down, the elbow following by a share', () => {
    const straight = armTargets(pose({ 14: E, 16: pt(0.6, 0.7) }), hand(0.6, 0.7, 0, 0.5), 1);
    const up = armTargets(pose({ 14: E, 16: pt(0.6, 0.7) }), hand(0.6, 0.7, 40, 0.5), 1);
    const down = armTargets(pose({ 14: E, 16: pt(0.6, 0.7) }), hand(0.6, 0.7, -70, 0.5), 1);
    expect(straight.wrist).toBeCloseTo(0);
    expect(straight.bend).toBeCloseTo(0);
    expect(up.wrist).toBeCloseTo(40 * WRIST_GAIN);
    expect(up.bend).toBeCloseTo(40 * ELBOW_SHARE);
    expect(down.wrist).toBeCloseTo(-70 * WRIST_GAIN);
    expect(down.bend).toBeCloseTo(-70 * ELBOW_SHARE);
    expect(down.bend!).toBeGreaterThan(BEND.min);
    const limp = armTargets(pose({ 14: E, 16: pt(0.6, 0.7) }), hand(0.6, 0.7, -90, 0.5), 1);
    expect(limp.wrist).toBe(WRIST.min);
  });
  it('closes the gripper when the fingertips meet and opens it when the hand opens', () => {
    const p = pose({ 14: E, 16: pt(0.6, 0.7) });
    expect(armTargets(p, hand(0.6, 0.7, 0, 0.05), 1).open).toBe(0);
    expect(armTargets(p, hand(0.6, 0.7, 0, 0.8), 1).open).toBe(1);
  });
  it('with only a hand in view, the hand lifts the arm and the elbow and wrist stay straight', () => {
    const t = armTargets(null, hand(0.5, 0.5, 30, 0.5), 1);
    expect(t.lift).toBeCloseTo(30);
    expect(t.bend).toBe(0);
    expect(t.wrist).toBe(0);
    expect(t.elbow).toBeNull();
  });
  it('returns null for what the camera did not see', () => {
    expect(armTargets(null, null)).toEqual({ lift: null, bend: null, wrist: null, open: null, side: null, elbow: null });
    const noHand = armTargets(pose({ 14: E, 16: pt(0.6, 0.5) }), null, 1);
    expect(noHand.lift).toBeCloseTo(45);
    expect(noHand.bend).toBeNull();
    expect(noHand.wrist).toBeNull();
    expect(noHand.open).toBeNull();
  });
});

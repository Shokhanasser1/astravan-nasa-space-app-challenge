import { describe, expect, it } from 'vitest';
import { follow, palmStick, poseOf, readHand, type Pt } from './gestures';

/** A made-up right hand in the camera picture: wrist low, palm up; `out` = which long fingers are stretched. */
function hand({ out = [true, true, true, true], pinch = false, at = { x: 0.5, y: 0.5 } } = {}): Pt[] {
  const l: Pt[] = Array.from({ length: 21 }, () => ({ x: at.x, y: at.y }));
  const p = (i: number, dx: number, dy: number) => (l[i] = { x: at.x + dx, y: at.y + dy });
  p(0, 0, 0.2); // wrist
  p(9, 0, 0); // middle knuckle: palm size 0.2
  [5, 9, 13, 17].forEach((k, f) => {
    const dx = (f - 1.5) * 0.05;
    p(k, dx, 0);
    p(k + 1, dx, -0.04); // middle joint
    p(k + 2, dx, out[f] ? -0.08 : 0.02);
    p(k + 3, dx, out[f] ? -0.12 : 0.04); // tip: far out, or curled back toward the wrist
  });
  p(4, -0.12, 0.02); // thumb tip, away from the index
  if (pinch) l[4] = { x: l[8].x + 0.01, y: l[8].y }; // thumb tip on the index tip
  return l;
}

describe('hand gestures', () => {
  it('tells the four poses apart', () => {
    expect(poseOf(readHand(hand()), false)).toBe('open');
    expect(poseOf(readHand(hand({ out: [false, false, false, false] })), false)).toBe('fist');
    expect(poseOf(readHand(hand({ out: [true, false, false, false] })), false)).toBe('point');
    expect(poseOf(readHand(hand({ out: [true, false, false, false], pinch: true })), false)).toBe('pinch');
  });

  it('a pinch opens only past the wider threshold (no flicker)', () => {
    const h = { ...readHand(hand({ out: [true, false, false, false] })), pinch: 0.3 };
    expect(poseOf(h, true)).toBe('pinch');
    expect(poseOf(h, false)).toBe('point');
  });

  it('the cursor is mirrored like a selfie and the middle of the picture covers the screen', () => {
    const left = readHand(hand({ at: { x: 0.25, y: 0.5 } }));
    const right = readHand(hand({ at: { x: 0.75, y: 0.5 } }));
    expect(left.x).toBeGreaterThan(right.x); // your hand on your left is on the screen's left
    expect(readHand(hand({ at: { x: 0.95, y: 0.5 } })).x).toBe(0);
  });

  it('an open palm in the middle stands still; moved up it walks ahead', () => {
    expect(palmStick(readHand(hand({ at: { x: 0.5, y: 0.5 } })))).toEqual({ x: 0, y: 0 });
    expect(palmStick(readHand(hand({ at: { x: 0.5, y: 0.3 } }))).y).toBeGreaterThan(0.5);
  });

  it('the cursor follows smoothly and catches up', () => {
    let p = { x: 0, y: 0 };
    for (let i = 0; i < 30; i++) p = follow(p, { x: 1, y: 1 }, 1 / 15);
    expect(p.x).toBeGreaterThan(0.99);
  });
});

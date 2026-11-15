import { describe, expect, it } from 'vitest';
import { TITLE, titleAngles, titlePose } from './title';

const at = (t: number, still = false) => titlePose(t, still, { x: 0, y: 0, z: 0 });
const dist = (p: { x: number; z: number }) => Math.hypot(p.x - TITLE.target[0], p.z - TITLE.target[2]);

describe('title camera', () => {
  it('stays on its circle around the base, at its height', () => {
    for (const t of [0, 7, 17.5, 33, 61]) {
      const p = at(t);
      expect(dist(p)).toBeCloseTo(TITLE.radius, 6);
      expect(p.y).toBe(TITLE.height);
    }
  });

  it('swings slowly: well under the 60°/s turn limit (about 2.5°/s at most)', () => {
    const maxDegPerS = (TITLE.swing * 2 * Math.PI) / TITLE.period;
    expect(maxDegPerS).toBeLessThan(5);
    const a = at(0);
    const b = at(0.1);
    const step = (Math.hypot(a.x - b.x, a.z - b.z) / TITLE.radius) * (180 / Math.PI);
    expect(step / 0.1).toBeLessThan(maxDegPerS + 1e-6);
  });

  it('with reduced motion it stands still in the middle of the arc', () => {
    expect(at(0, true)).toEqual(at(25, true));
    expect(at(0, true)).toEqual(at(0));
  });

  it('comes back to where it started after one period', () => {
    const a = at(3);
    const b = at(3 + TITLE.period);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.z).toBeCloseTo(a.z, 6);
  });
});

describe('title framing', () => {
  it('looks at the base, a little down, never rolling (only yaw and pitch exist)', () => {
    const p = at(0, true);
    const { pitch } = titleAngles(p, 1);
    expect(pitch).toBeLessThan(0);
    expect(pitch).toBeGreaterThan(-Math.PI / 4);
  });

  it('on a wide screen turns left so the base sits right of the menu', () => {
    const p = at(0, true);
    const wide = titleAngles(p, 16 / 9);
    const tall = titleAngles(p, 9 / 16);
    expect(wide.yaw - tall.yaw).toBeCloseTo((16 * Math.PI) / 180, 6);
    expect(tall.pitch).toBeLessThan(wide.pitch); // tall: looks lower, the base rises above the bottom sheet
  });
});

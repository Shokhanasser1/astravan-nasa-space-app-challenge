// The astronaut's body: Apollo speeds, the lunar jump, and the base's hitboxes (src/walk/world.ts).
import { describe, expect, it } from 'vitest';
import { OUTSIDE, ROVER_DISC } from '../walk/world';
import { LAYOUT, PARKED_ROVER, RADIUS } from '../scene/layout';
import { HOP_OUT, hatchAt } from '../scene/arrival';
import { STEP, createBody, stepBody, type Wish } from './body';
import { GRAVITY, MOVE, jumpHeight } from './physics.js';

const flat = () => 0;
const go = (x: number, z: number, run = false): Wish => ({ x, z, run, jump: false });

function run(seconds: number, f: (t: number) => Wish, b = createBody(0, 20, flat)) {
  let peak = 0;
  for (let t = 0; t < seconds; t += STEP) {
    stepBody(b, f(t), OUTSIDE, flat);
    peak = Math.max(peak, b.y);
  }
  return { b, peak };
}

describe('astronaut body', () => {
  it('walks at 1.0 m/s and lopes at 2.0 m/s (Apollo), and faces where it goes', () => {
    expect(Math.hypot(run(4, () => go(1, 0)).b.vx, 0)).toBeCloseTo(MOVE.walk, 3);
    const lope = run(4, () => go(0, 1, true)).b;
    expect(lope.vz).toBeCloseTo(MOVE.run, 3);
    expect(lope.facing).toBeCloseTo(0, 2);
  });

  it('jumps 0.44 m on the Moon after the crouch, and lands', () => {
    const { b, peak } = run(4, (t) => ({ ...go(0, 0), jump: t < STEP }));
    expect(peak).toBeCloseTo(jumpHeight(MOVE.jumpV0, GRAVITY.moon), 2);
    expect(b.onGround).toBe(true);
    expect(b.y).toBe(0);
  });

  it('cannot walk into the habitat', () => {
    const [hx, hz] = LAYOUT.habitat;
    const b = createBody(hx, hz + 6, flat);
    for (let t = 0; t < 10; t += STEP) stepBody(b, go(0, -1), OUTSIDE, flat);
    expect(Math.hypot(b.x - hx, b.z - hz)).toBeGreaterThan(RADIUS.habitat);
  });

  it('follows the ground up and down a slope', () => {
    const slope = (x: number) => x * 0.1;
    const b = createBody(0, 20, slope);
    for (let t = 0; t < 3; t += STEP) stepBody(b, go(1, 0), OUTSIDE, slope);
    expect(b.y).toBeCloseTo(slope(b.x), 6);
    expect(b.onGround).toBe(true);
  });

  it('is pushed out of a hitbox it was put into, but not launched (out of the rover: it "flew away")', () => {
    // the hop out of the parked rover's hatch lands HOP_OUT beyond the sill: 2.58 m from the rover's middle, inside
    // its hitbox (2.4 m + the body's 0.35 m). The push out of it must not turn into speed: at 120 steps a second a
    // 17 cm push was 20 m/s, and Moon traction (2.5 m/s²) let the astronaut slide on for ~80 m.
    expect(ROVER_DISC.x).toBe(PARKED_ROVER.x);
    for (const side of [1, -1]) {
      const h = hatchAt({ ...PARKED_ROVER, speed: 0 }, undefined, side);
      const b = createBody(h.x + h.nx * HOP_OUT, h.z + h.nz * HOP_OUT, flat);
      const x0 = b.x, z0 = b.z;
      for (let t = 0; t < 3; t += STEP) stepBody(b, go(0, 0), OUTSIDE, flat);
      expect(Math.hypot(b.x - PARKED_ROVER.x, b.z - PARKED_ROVER.z), `side ${side}`).toBeGreaterThanOrEqual(ROVER_DISC.r + 0.35 - 1e-6);
      expect(Math.hypot(b.x - x0, b.z - z0), `side ${side}`).toBeLessThan(0.5);
      expect(Math.hypot(b.vx, b.vz)).toBeLessThan(1e-6);
      expect(b.onGround).toBe(true);
    }
  });
});

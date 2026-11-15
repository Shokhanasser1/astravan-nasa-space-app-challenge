// The crew rover's suspension (src/scene/arrival.ts): the chassis follows the ground pose on springs — it settles,
// overshoots a little (Moon-soft), never leaves its travel, squats when it speeds up; each wheel pair's reach stays
// within the travel.
import { describe, expect, it } from 'vitest';
import { SPRING, chassis, rover, stepSuspension, wheelReach } from './arrival';

function reset(y = 0) {
  Object.assign(rover, { x: 0, z: 0, yaw: 0, speed: 0, y, pitch: 0, roll: 0 });
  Object.assign(chassis, { y, pitch: 0, roll: 0, vy: 0, vp: 0, vr: 0, speed: 0 });
}

describe('rover suspension', () => {
  it('settles on a new ground height with a small overshoot', () => {
    reset(0);
    rover.y = 0.12; // the wheels ride up onto a rock
    let peak = 0;
    let t = 0;
    while (t < 4) {
      stepSuspension(1 / 60);
      peak = Math.max(peak, chassis.y);
      t += 1 / 60;
    }
    expect(Math.abs(chassis.y - 0.12)).toBeLessThan(0.003);
    expect(peak).toBeGreaterThan(0.12); // it bounces (soft at 1/6 g)…
    expect(peak).toBeLessThan(0.12 + 0.12 * 0.4); // …but not much
    expect(stepSuspension(1 / 60)).toBe(false); // settled: the scene may rest
  });

  it('never leaves its travel, and the wheel pairs reach no further', () => {
    reset(0);
    rover.y = 1; // a drop far bigger than the springs
    for (let i = 0; i < 30; i++) {
      stepSuspension(1 / 60);
      expect(Math.abs(chassis.y - rover.y)).toBeLessThanOrEqual(SPRING.travel + 1e-9);
      for (const [x, z] of [[1.29, 0.94], [-1.29, -1.65]]) expect(Math.abs(wheelReach(x, z))).toBeLessThanOrEqual(SPRING.travel + 1e-9);
    }
  });

  it('squats when it speeds up (nose up), then levels out', () => {
    reset(0);
    let low = 0;
    for (let i = 0; i < 60; i++) {
      rover.speed = Math.min(2.5, rover.speed + 0.8 / 60);
      stepSuspension(1 / 60);
      low = Math.min(low, chassis.pitch);
    }
    expect(low).toBeLessThan(-0.02);
    for (let i = 0; i < 300; i++) stepSuspension(1 / 60); // steady speed
    expect(Math.abs(chassis.pitch)).toBeLessThan(0.003);
  });
});

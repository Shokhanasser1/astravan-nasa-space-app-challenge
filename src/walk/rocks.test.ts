// The rocks as the walk and the rover feel them (src/walk/rocks.ts): the low ones are ground — the astronaut steps
// onto them, the rover's wheels climb them and it tilts — and the tall ones stop you.
import { describe, expect, it } from 'vitest';
import { groundHeight } from '../scene/ground';
import { STEP_FOOT, STEP_WHEEL, footGround, rockSolids, wheelGround } from './rocks';
import { clearance, type Area } from './collide';
import { EDGE, OUTSIDE, ROVER_AREA } from './world';
import { ROVER, placeOnGround, stepRover, type Rover } from '../scene/roverDrive';

const lift = (f: (x: number, z: number) => number, x: number, z: number) => f(x, z) - groundHeight(x, z);

/** The highest point of the rocks the wheels climb, on the playable ground (a coarse search). */
function highestClimb() {
  let best = { x: 0, z: 0, h: 0 };
  for (let x = -58; x <= 58; x += 0.2)
    for (let z = -58; z <= 58; z += 0.2) {
      if (Math.hypot(x, z) > EDGE - 3) continue;
      const h = lift(wheelGround, x, z);
      if (h > best.h) best = { x, z, h };
    }
  return best;
}

describe('rocks', () => {
  it('lift the ground no higher than a step (feet) or a climb (wheels); the taller ones are hitboxes', () => {
    for (let x = -58; x <= 58; x += 0.5)
      for (let z = -58; z <= 58; z += 0.5) {
        expect(lift(footGround, x, z)).toBeLessThanOrEqual(STEP_FOOT + 1e-9);
        expect(lift(wheelGround, x, z)).toBeLessThanOrEqual(STEP_WHEEL + 1e-9);
      }
    const foot = OUTSIDE.solids.filter((s) => s.name === 'rock').length;
    const wheel = ROVER_AREA.solids.filter((s) => s.name === 'rock').length;
    expect(foot).toBe(rockSolids(STEP_FOOT, EDGE).length);
    expect(wheel).toBe(rockSolids(STEP_WHEEL, EDGE).length);
    expect(wheel).toBeLessThanOrEqual(foot);
  });

  it('the rover climbs a rock: it rides up and tilts', () => {
    const top = highestClimb();
    expect(top.h).toBeGreaterThan(0.08); // (the phone tier: its biggest rocks lie beyond the playable edge)
    // the rover's front bogies on the rock's top, heading across it
    const r: Rover = { x: top.x - Math.sin(0.4) * 0.94, z: top.z - Math.cos(0.4) * 0.94, yaw: 0.4, speed: 0, y: 0, pitch: 0, roll: 0 };
    placeOnGround(r, wheelGround);
    const flat = { ...r };
    placeOnGround(flat, groundHeight);
    expect(r.y - flat.y).toBeGreaterThan(0.03);
    expect(Math.abs(r.pitch - flat.pitch) + Math.abs(r.roll - flat.roll)).toBeGreaterThan(0.03);
  });

  it('a rock taller than the wheels climb stops the rover (it never drives into it)', () => {
    const rock = rockSolids(STEP_WHEEL, 1000)[0];
    expect(rock).toBeTruthy();
    const area: Area = { solids: [rock], bounds: { x: rock.x, z: rock.z, r: 50 } };
    const a = 0.3;
    const r: Rover = { x: rock.x - Math.sin(a) * 6, z: rock.z - Math.cos(a) * 6, yaw: a, speed: 0, y: 0, pitch: 0, roll: 0 };
    for (let i = 0; i < 480; i++) {
      stepRover(r, { throttle: 1, steer: 0, brake: false }, area, groundHeight, 1 / 60);
      expect(clearance(rock, r.x, r.z, ROVER.r)).toBeGreaterThanOrEqual(-1e-6);
    }
  });
});

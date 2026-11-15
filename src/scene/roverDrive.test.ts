import { describe, expect, it } from 'vitest';
import { ROVER, placeOnGround, stepRover, type Pedals, type Rover } from './roverDrive';
import { clearance, type Area } from '../walk/collide';

const flat = () => 0;
const open: Area = { solids: [], bounds: { x: 0, z: 0, r: 1000 } };
const DT = 1 / 60;
const rover = (speed = 0, yaw = 0): Rover => ({ x: 0, z: 0, yaw, speed, y: 0, pitch: 0, roll: 0 });
const pedals = (throttle: number, steer = 0, brake = false): Pedals => ({ throttle, steer, brake });

function drive(r: Rover, p: Pedals, seconds: number, area = open, ground = flat) {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepRover(r, p, area, ground, DT);
  return r;
}

describe('rover: speed', () => {
  it('speeds up gently (0.8 m/s²) and tops out at 2.5 m/s', () => {
    expect(drive(rover(), pedals(1), 1).speed).toBeCloseTo(0.8, 5);
    const r = drive(rover(), pedals(1), 10);
    expect(r.speed).toBeCloseTo(ROVER.vmax, 9);
    expect(r.z).toBeGreaterThan(15); // heading 0 = +z
  });

  it('half throttle wants half the speed', () => {
    expect(drive(rover(), pedals(0.5), 10).speed).toBeCloseTo(1.25, 9);
  });

  it('S brakes at 1.2 m/s², stops, and only then backs up — at most 1.0 m/s', () => {
    const r = drive(rover(2.4), pedals(-1), 1);
    expect(r.speed).toBeCloseTo(1.2, 5);
    drive(r, pedals(-1), 1);
    expect(r.speed).toBeCloseTo(0, 9); // stopped, not rolling back yet
    drive(r, pedals(-1), 1);
    expect(r.speed).toBeCloseTo(-0.8, 5); // the motors, backwards
    drive(r, pedals(-1), 10);
    expect(r.speed).toBeCloseTo(-ROVER.vback, 9);
  });

  it('with no pedal it rolls out slowly; the brake (getting out) stops it hard', () => {
    expect(drive(rover(2), pedals(0), 1).speed).toBeCloseTo(2 - ROVER.coast, 5);
    expect(drive(rover(2), pedals(1, 0, true), 1).speed).toBeCloseTo(2 - ROVER.brake, 5);
    expect(drive(rover(2), pedals(1, 0, true), 3).speed).toBe(0);
  });
});

describe('rover: steering', () => {
  it('does not turn on the spot', () => {
    const r = drive(rover(), pedals(0, 1), 3);
    expect(r.yaw).toBe(0);
    expect(stepRover(r, pedals(0, 1), open, flat, DT)).toBe(false); // nothing moves, the scene may rest
  });

  it('turns faster with speed, right is right, and backing up turns the nose the other way', () => {
    const slow = rover(0.5);
    const fast = rover(1.8);
    stepRover(slow, pedals(0.2, 1), open, flat, DT);
    stepRover(fast, pedals(0.72, 1), open, flat, DT);
    expect(fast.yaw).toBeLessThan(slow.yaw); // yaw down = to its right (its left is +x)
    expect(slow.yaw).toBeLessThan(0);
    const back = rover(-0.5);
    stepRover(back, pedals(-0.5, 1), open, flat, DT);
    expect(back.yaw).toBeGreaterThan(0);
  });

  it('never turns faster than its grip allows (speed × yaw rate ≤ 1.2 m/s²)', () => {
    const r = rover(ROVER.vmax);
    stepRover(r, pedals(1, 1), open, flat, DT);
    expect((Math.abs(r.yaw) / DT) * ROVER.vmax).toBeLessThanOrEqual(ROVER.grip + 1e-9);
  });
});

describe('rover: hitboxes and ground', () => {
  it('stops at a building in front and never drives into it', () => {
    const area: Area = { solids: [{ x: 0, z: 10, r: 2 }], bounds: { x: 0, z: 0, r: 1000 } };
    const r = drive(rover(), pedals(1), 15, area);
    expect(r.speed).toBe(0);
    expect(clearance(area.solids[0], r.x, r.z, ROVER.r)).toBeGreaterThan(-1e-6);
    expect(r.z).toBeCloseTo(10 - 2 - ROVER.r, 2);
  });

  it('slides along a wall it meets at an angle', () => {
    // a wall along x at z = 6; the rover heads 45° into it (yaw π/4: towards +x and +z)
    const wall: Area = { solids: [{ x: -50, z: 6, bx: 50, bz: 6, r: 0.25 }], bounds: { x: 0, z: 0, r: 1000 } };
    const r = drive(rover(0, Math.PI / 4), pedals(1), 12, wall);
    expect(r.z).toBeCloseTo(6 - 0.25 - ROVER.r, 3); // against the wall, not through it
    expect(r.x).toBeGreaterThan(10); // and it kept going along it
    expect(r.speed).toBeGreaterThan(1);
    expect(r.speed).toBeLessThanOrEqual(Math.SQRT1_2 * ROVER.vmax + 1e-3); // scraping, slower than free
  });

  it('stays inside the playable ground', () => {
    const small: Area = { solids: [], bounds: { x: 0, z: 0, r: 10 } };
    const r = drive(rover(), pedals(1), 20, small);
    expect(Math.hypot(r.x, r.z)).toBeLessThanOrEqual(10 - ROVER.r + 1e-6);
  });

  it('sits on the ground under its wheels: nose up a slope, left side up on a side slope', () => {
    const up = placeOnGround(rover(), (_x, z) => 0.1 * z); // rising ahead (+z)
    expect(up.pitch).toBeCloseTo(-Math.atan(0.1), 6); // nose up
    expect(up.roll).toBeCloseTo(0, 9);
    const side = placeOnGround(rover(), (x) => 0.1 * x); // rising to its left (+x)
    expect(side.roll).toBeCloseTo(Math.atan(0.1), 6);
    expect(side.pitch).toBeCloseTo(0, 9);
    expect(placeOnGround(rover(), () => 3).y).toBe(3);
  });
});

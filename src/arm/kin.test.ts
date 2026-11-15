import { describe, expect, it } from 'vitest';
import { clearPose } from './kin';

const PEDESTAL_R = 0.75;
const arm = (ground = (_r: number) => 0) => ({
  H: 1.0,
  L1: 1.46,
  L2: 1.41,
  L3: 1.46,
  T: 0.5,
  clear: { elbow: 0.25, wrist: 0.35, turret: 0.5, tip: 0.1 },
  groundAt: (r: number) => Math.max(ground(r), Math.abs(r) < PEDESTAL_R ? 0.95 : 0),
});
const above = (p: ReturnType<typeof clearPose>, a: ReturnType<typeof arm>) => {
  expect(p.points.elbow[1]).toBeGreaterThanOrEqual(a.groundAt(p.points.elbow[0]) + a.clear.elbow - 1e-6);
  expect(p.points.wrist[1]).toBeGreaterThanOrEqual(a.groundAt(p.points.wrist[0]) + a.clear.wrist - 1e-6);
  expect(p.points.turret[1]).toBeGreaterThanOrEqual(a.groundAt(p.points.turret[0]) + a.clear.turret - 1e-6);
  expect(p.points.tip[1]).toBeGreaterThanOrEqual(a.groundAt(p.points.tip[0]) + a.clear.tip - 1e-6);
};

describe('the arm never goes into the ground', () => {
  it('leaves a pose that is clear as it is', () => {
    const p = clearPose({ lift: 30, bend: 20, wrist: 10 }, arm());
    expect(p.lift).toBeCloseTo(30);
    expect(p.bend).toBeCloseTo(20);
    expect(p.wrist).toBeCloseTo(10);
  });

  it('stops a forearm bent down into the ground just above it', () => {
    const a = arm();
    const p = clearPose({ lift: -20, bend: -80, wrist: 0 }, a);
    above(p, a);
    expect(p.bend).toBeGreaterThan(-80);
    expect(p.lift).toBeCloseTo(-20);
  });

  it('stops the jaws pointing down into the ground', () => {
    const a = arm();
    const p = clearPose({ lift: -15, bend: 0, wrist: -90 }, a);
    above(p, a);
    expect(p.wrist).toBeGreaterThan(-90);
  });

  it('keeps clear of a rise in the ground under the reach', () => {
    const a = arm((r) => (r > 2 ? 0.8 : 0));
    const p = clearPose({ lift: -20, bend: -30, wrist: -40 }, a);
    above(p, a);
  });

  it('does not fold the forearm down into its own pedestal', () => {
    const a = arm();
    const p = clearPose({ lift: 75, bend: 120, wrist: 0 }, a);
    above(p, a);
  });

  it('always returns a clear pose, whatever is asked', () => {
    const a = arm((r) => 0.3 * Math.sin(r * 2));
    for (let lift = -20; lift <= 75; lift += 19) {
      for (let bend = -80; bend <= 120; bend += 40) {
        for (let wrist = -90; wrist <= 90; wrist += 45) above(clearPose({ lift, bend, wrist }, a), a);
      }
    }
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { walkStep, type Area } from './collide';
import { axes, releaseAll, walkInput } from './input';
import { accelerate, heading, PACE } from './move';
import { createWalker } from './walker';

const open: Area = { solids: [], bounds: { x: 0, z: 0, r: 500 } };
const speed = (v: { x: number; z: number }) => Math.hypot(v.x, v.z);

beforeEach(() => {
  releaseAll();
  walkInput.inGame = true;
  walkInput.phaseOk = true;
});

describe('heading', () => {
  it('goes where the camera faces: yaw 0 looks down −z, and a quarter turn left looks down −x', () => {
    const ahead = heading(0, 1, 0);
    expect(ahead.x).toBeCloseTo(0, 9);
    expect(ahead.z).toBeCloseTo(-1, 9);
    const left = heading(Math.PI / 2, 1, 0);
    expect(left.x).toBeCloseTo(-1, 9);
    expect(left.z).toBeCloseTo(0, 9);
    // Stepping right while facing −z goes to +x.
    expect(heading(0, 0, 1).x).toBeCloseTo(1, 9);
  });

  it('is no faster on a diagonal than straight ahead', () => {
    expect(speed(heading(0.7, 1, 1))).toBeCloseTo(1, 9);
    expect(speed(heading(0.7, 1, 0))).toBeCloseTo(1, 9);
    expect(speed(heading(0.7, 0.4, 0))).toBeCloseTo(0.4, 9);
  });
});

describe('speeding up and stopping', () => {
  it('is at walking speed in about 0.15 s and stopped in about 0.1 s, never over the speed', () => {
    let v = { x: 0, z: 0 };
    const wish = { x: 0, z: -1 };
    v = accelerate(v, wish, PACE.walk, PACE.tick);
    expect(speed(v)).toBeGreaterThan(0);
    expect(speed(v)).toBeLessThan(PACE.walk * 0.4); // a smooth start, not a jump
    for (let i = 1; i < 9; i++) v = accelerate(v, wish, PACE.walk, PACE.tick);
    expect(speed(v)).toBeGreaterThan(PACE.walk * 0.9);
    expect(speed(v)).toBeLessThanOrEqual(PACE.walk + 1e-9);
    for (let i = 0; i < 6; i++) v = accelerate(v, { x: 0, z: 0 }, PACE.walk, PACE.tick);
    expect(speed(v)).toBeLessThan(PACE.walk * 0.1);
  });
});

describe('keys and stick', () => {
  it('reads W A S D and the arrows; left and right arrows turn; opposite keys cancel', () => {
    walkInput.keys.add('KeyW');
    walkInput.keys.add('ArrowUp');
    walkInput.keys.add('KeyD');
    expect(axes()).toEqual({ ahead: 1, side: 1, turn: 0 });
    walkInput.keys.add('KeyS');
    walkInput.keys.add('ArrowDown');
    expect(axes().ahead).toBe(0);
    releaseAll();
    walkInput.keys.add('ArrowLeft');
    expect(axes()).toEqual({ ahead: 0, side: 0, turn: -1 });
  });

  it('adds the stick to the keys without going past one step, and lets go of everything at once', () => {
    walkInput.stick.y = 0.5;
    expect(axes().ahead).toBe(0.5);
    walkInput.keys.add('KeyW');
    expect(axes().ahead).toBe(1);
    releaseAll();
    expect(axes()).toEqual({ ahead: 0, side: 0, turn: 0 });
  });

  it('does nothing on the start screen or during the launch and the truth sequence', () => {
    walkInput.keys.add('KeyW');
    walkInput.inGame = false;
    expect(axes().ahead).toBe(0);
    walkInput.inGame = true;
    walkInput.phaseOk = false;
    expect(axes().ahead).toBe(0);
  });
});

describe('the walker', () => {
  it('walks ahead at 2 m/s, and as far in a second at 20 frames a second as at 120', () => {
    const far = (hz: number) => {
      releaseAll();
      walkInput.keys.add('KeyW');
      const w = createWalker();
      const p = { x: 0, z: 0 };
      for (let i = 0; i < hz; i++) w.step(p, 0, open, 1 / hz);
      return -p.z;
    };
    expect(far(60)).toBeGreaterThan(1.7);
    expect(far(60)).toBeLessThanOrEqual(PACE.walk);
    expect(Math.abs(far(20) - far(120))).toBeLessThan(0.08);
  });

  it('is not walking after the keys are let go (Alt-Tab with W held)', () => {
    walkInput.keys.add('KeyW');
    const w = createWalker();
    const p = { x: 0, z: 0 };
    for (let i = 0; i < 60; i++) w.step(p, 0, open, 1 / 60);
    releaseAll(); // what the blur and visibilitychange listeners do
    let moving = true;
    for (let i = 0; i < 30; i++) moving = w.step(p, 0, open, 1 / 60);
    const rest = p.z;
    for (let i = 0; i < 30; i++) moving = w.step(p, 0, open, 1 / 60);
    expect(p.z).toBe(rest);
    expect(moving).toBe(false);
  });

  it('loses the speed that pushed into a wall, and keeps the rest', () => {
    const walled: Area = { solids: [{ x: -50, z: -3, bx: 50, bz: -3, r: 0.2 }], bounds: open.bounds };
    walkInput.keys.add('KeyW');
    walkInput.keys.add('KeyD');
    const w = createWalker();
    const p = { x: 0, z: 0 };
    for (let i = 0; i < 240; i++) w.step(p, 0, walled, 1 / 60);
    const before = p.x;
    for (let i = 0; i < 60; i++) w.step(p, 0, walled, 1 / 60);
    expect(p.z).toBeCloseTo(-3 + 0.2 + 0.35, 6);
    expect(p.x - before).toBeGreaterThan(1); // still sliding along it
    expect(walkStep(p, 0, -1, walled).z).toBeCloseTo(p.z, 6);
  });

  it('does not leap after a stalled frame', () => {
    walkInput.keys.add('KeyW');
    const w = createWalker();
    const p = { x: 0, z: 0 };
    w.step(p, 0, open, 5);
    expect(-p.z).toBeLessThan(0.25);
  });
});

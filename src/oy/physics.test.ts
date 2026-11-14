// The 3D demo's physics (src/oy/physics.js): the numbers the HUD shows children must come out of the simulation.
import { describe, expect, it } from 'vitest';
import { GRAVITY, MOVE, PlayerBody, carryFactor, jumpHeight, makeOBB } from './physics.js';

type Box = ReturnType<typeof makeOBB>;
const DT = 1 / 120; // the game's fixed step (game.js)
const flat = (g: number, colliders: Box[] = []) => ({ g, groundHeight: () => 0, colliders, bounds: 100 });
const still = { x: 0, z: 0, run: false, jump: false };

function settle(body: PlayerBody, world: ReturnType<typeof flat>, seconds: number, input = still) {
  for (let t = 0; t < seconds; t += DT) body.step(DT, input, world);
}

describe('demo physics', () => {
  it('falls onto the ground and stands on it', () => {
    const b = new PlayerBody([0, 1, 0]);
    settle(b, flat(GRAVITY.moon), 3);
    expect(b.onGround).toBe(true);
    expect(b.pos[1]).toBeCloseTo(0, 6);
  });

  it('a jump peaks at v²/2g: 0.44 m on the Moon, about six times the Earth jump', () => {
    for (const g of [GRAVITY.moon, GRAVITY.earth]) {
      const b = new PlayerBody([0, 0, 0]);
      const w = flat(g);
      settle(b, w, 0.5);
      b.step(DT, { ...still, jump: true }, w);
      settle(b, w, 4);
      expect(b.maxHeightThisJump).toBeCloseTo(jumpHeight(MOVE.jumpV0, g), 2);
    }
    expect(jumpHeight(MOVE.jumpV0, GRAVITY.moon)).toBeCloseTo(0.444, 3);
    expect(jumpHeight(MOVE.jumpV0, GRAVITY.moon) / jumpHeight(MOVE.jumpV0, GRAVITY.earth)).toBeCloseTo(6.06, 1);
  });

  it('a box stops the walker in front of it', () => {
    const wall = makeOBB([0, 1, 3], [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [2, 1, 0.5], 'COL_wall');
    const b = new PlayerBody([0, 0, 0]);
    settle(b, flat(GRAVITY.moon, [wall]), 6, { ...still, z: 1 });
    expect(b.pos[2]).toBeLessThan(3 - 0.5 - 0.3);
    expect(b.pos[2]).toBeGreaterThan(1.5);
  });

  it('a 27 kg bag slows walking by M / (M + m)', () => {
    expect(carryFactor(27)).toBeCloseTo(220 / 247, 6);
  });
});

import { describe, expect, it } from 'vitest';
import { ASTRA_PLAN, HDU_PLAN } from './layout';
import { BOARD_S, boardClimbPhase, boardPath, boardPose, boardSeconds, type BoardPose } from './boarding';
import { fits } from '../walk/collide';
import { makeOutside } from '../walk/world';

const pose = (): BoardPose => ({ x: 0, y: 0, z: 0, facing: 0, vx: 0, vy: 0, vz: 0, stage: 'walk', h: 0 });

describe('Day 7 boarding path (home story)', () => {
  for (const [name, plan, hdu] of [['ASTRA', ASTRA_PLAN, false], ['HDU', HDU_PLAN, true]] as const) {
    describe(`${name} plan`, () => {
      const p = boardPath(plan);
      const [lx, lz] = plan.LAYOUT.lander;
      const out = makeOutside(hdu);

      it('the cut lands clear of every hitbox, the ladder foot just outside the lander, and the shot camera is clear', () => {
        const fromLander = (q: { x: number; z: number }) => Math.hypot(q.x - lx, q.z - lz);
        expect(fits(p.approach.x, p.approach.z, out)).toBe(true);
        expect(fromLander(p.foot)).toBeGreaterThan(plan.RADIUS.lander);
        expect(fromLander(p.approach)).toBeGreaterThan(fromLander(p.foot));
        expect(fits(p.camera.x, p.camera.z, out, 0.5)).toBe(true);
        // the rungs' line leans in: the top is nearer the lander's axis than the bottom
        expect(fromLander(p.high)).toBeLessThan(fromLander(p.low));
        expect(fromLander(p.inside)).toBeLessThan(fromLander(p.porch));
      });

      it('walks, climbs, steps along the porch, goes in, then is on board — continuous, always facing a sane way', () => {
        const q = pose();
        const stages: string[] = [];
        let last = { ...boardPose(p, 0, q) };
        for (let t = 0; t <= BOARD_S + 0.5; t += 0.02) {
          boardPose(p, t, q);
          if (stages[stages.length - 1] !== q.stage) stages.push(q.stage);
          // no jump bigger than 0.12 m between frames 20 ms apart (the grip slide is the largest, 0.4 m in 0.2 s)
          expect(Math.hypot(q.x - last.x, q.y - last.y, q.z - last.z), `t ${t.toFixed(2)} ${q.stage}`).toBeLessThan(0.12);
          expect(Number.isFinite(q.facing)).toBe(true);
          last = { ...q };
        }
        expect(stages).toEqual(['walk', 'climb', 'porch', 'in', 'aboard']);
        expect(boardPose(p, 0, q)).toMatchObject({ x: p.approach.x, z: p.approach.z, y: 0, stage: 'walk' });
        expect(boardPose(p, 99, q)).toMatchObject({ x: p.inside.x, z: p.inside.z, y: p.deckY, stage: 'aboard' });
      });
    });
  }

  it('takes the same time on both plans (one countdown), a few seconds', () => {
    expect(boardSeconds(boardPath(ASTRA_PLAN))).toBeCloseTo(boardSeconds(boardPath(HDU_PLAN)), 6);
    expect(BOARD_S).toBeGreaterThan(3.5);
    expect(BOARD_S).toBeLessThan(7);
  });

  it('scrubs the Climb clip by height, two rungs a cycle', () => {
    expect(boardClimbPhase(0)).toBe(0);
    expect(boardClimbPhase(0.3)).toBeCloseTo(0.5, 6);
    expect(boardClimbPhase(0.6)).toBeCloseTo(0, 6);
  });
});

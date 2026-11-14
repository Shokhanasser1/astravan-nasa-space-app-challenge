import { describe, expect, it } from 'vitest';
import { LAYOUT } from '../scene/layout';
import { MARKERS, POINTS } from '../scene/points';
import { BODY, clearance, fits, walkStep } from './collide';
import { EDGE, INSIDE, OUTSIDE, ROOM } from './world';

describe("the base's hitboxes", () => {
  it('has one for every solid thing in the layout', () => {
    const names = OUTSIDE.solids.map((s) => s.name);
    for (const k of ['habitat', 'garden', 'workshop', 'lander', 'scout', 'hub', 'dish', 'wing']) expect(names).toContain(k);
    // Nothing thinner than 0.4 m (it would be easy to clip).
    for (const s of OUTSIDE.solids) expect(s.r * 2, s.name).toBeGreaterThanOrEqual(0.4);
  });

  it('leaves every standing point free, with room to stand in front of the hub and at the ladder', () => {
    for (const id of MARKERS) {
      const [x, , z] = POINTS[id].pos;
      expect(fits(x, z, OUTSIDE), id).toBe(true);
      expect(Math.hypot(x, z), id).toBeLessThan(EDGE - 5);
    }
    // 1.5 m of clear ground somewhere round the hub, and the ladder point within reach of the lander.
    const hub = OUTSIDE.solids.find((s) => s.name === 'hub')!;
    const [hx, , hz] = POINTS.hub.pos;
    expect(clearance(hub, hx, hz)).toBeGreaterThan(1.5);
    const [lx, , lz] = POINTS.ladder.pos;
    expect(Math.hypot(lx - LAYOUT.lander[0], lz - LAYOUT.lander[1])).toBeLessThan(3);
  });

  it('cannot be walked through from any side, but can be walked round', () => {
    for (const s of OUTSIDE.solids) {
      const cx = s.bx === undefined ? s.x : (s.x + s.bx) / 2;
      const cz = s.bz === undefined ? s.z : (s.z + s.bz!) / 2;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        let p = { x: cx + Math.cos(a) * 7, z: cz + Math.sin(a) * 7 };
        let least = Infinity;
        for (let i = 0; i < 600; i++) {
          p = walkStep(p, (-Math.cos(a) * 2) / 60, (-Math.sin(a) * 2) / 60, OUTSIDE);
          least = Math.min(least, clearance(s, p.x, p.z));
          for (const o of OUTSIDE.solids) expect(clearance(o, p.x, p.z), `${s.name} from ${k}: inside ${o.name}`).toBeGreaterThanOrEqual(-1e-6);
        }
        expect(least, `${s.name} from ${k}`).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });

  it('can be crossed on foot between every pair of standing points', () => {
    // Head straight for the next point; sliding round whatever is in the way must get there. (Starting a hand's
    // width off the point: nobody walks at the dead centre of a round thing, where there is no side to slide to.)
    for (const a of MARKERS)
      for (const b of MARKERS) {
        if (a === b) continue;
        let p = { x: POINTS[a].pos[0] + 0.07, z: POINTS[a].pos[2] + 0.03 };
        const goal = { x: POINTS[b].pos[0], z: POINTS[b].pos[2] };
        for (let i = 0; i < 60 * 60 && Math.hypot(goal.x - p.x, goal.z - p.z) > 0.3; i++) {
          const d = Math.hypot(goal.x - p.x, goal.z - p.z);
          p = walkStep(p, ((goal.x - p.x) / d) * (2 / 60), ((goal.z - p.z) / d) * (2 / 60), OUTSIDE);
        }
        expect(Math.hypot(goal.x - p.x, goal.z - p.z), `${a} → ${b}`).toBeLessThan(0.35);
      }
  });

  it('keeps you on the playable ground outside, and on the floor inside the habitat', () => {
    let p = { x: 0, z: 30 };
    for (let i = 0; i < 60 * 40; i++) p = walkStep(p, 0.01, 2 / 60, OUTSIDE);
    expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(EDGE - BODY + 1e-9);
    let q: { x: number; z: number } = { x: LAYOUT.habitat[0], z: LAYOUT.habitat[1] };
    for (let i = 0; i < 600; i++) q = walkStep(q, 2 / 60, 0.5 / 60, INSIDE);
    expect(Math.hypot(q.x - LAYOUT.habitat[0], q.z - LAYOUT.habitat[1])).toBeLessThanOrEqual(ROOM - BODY + 1e-9);
    // (The rig calls that "inside" while the eye is within 1.6 m of the habitat's middle.)
    expect(ROOM - BODY).toBeLessThan(1.6);
  });
});

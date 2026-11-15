import { describe, expect, it, vi } from 'vitest';

// The ASTRA base's expectations (the HDU complex is tested with the flag passed in, makeOutside(true) etc.): run with
// features.hduHabitat off, as they were written — it is on by default since 15 Nov ~15:40 (`?nohdu` shows ASTRA).
vi.mock('../config/features', async (load) => {
  const real = await load<typeof import('../config/features')>();
  return { ...real, features: { ...real.features, hduHabitat: false } };
});
import { LAYOUT, RADIUS } from '../scene/layout';
import { MARKERS, POINTS } from '../scene/points';
import { BODY, clearance, fits, walkStep } from './collide';
import { EDGE, INSIDE, OUTSIDE, ROOM, ROVER_AREA } from './world';
import { NEAR_R } from '../look/terrain.js';
import { ICE_CRATER } from '../scene/ground';
import { footGround, wheelGround } from './rocks';
import { STEP, createBody, stepBody } from '../character/body';
import { ROVER, stepRover, type Rover } from '../scene/roverDrive';

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
    // The plan point stands close behind the hub (within reach: the player acts there without walking, integrator
    // 15 Nov) with room to stand; the ladder point within reach of the lander.
    const hub = OUTSIDE.solids.find((s) => s.name === 'hub')!;
    const [hx, , hz] = POINTS.hub.pos;
    expect(clearance(hub, hx, hz)).toBeGreaterThan(0.5);
    expect(Math.hypot(hx - LAYOUT.hub[0], hz - LAYOUT.hub[1]) - RADIUS.hub).toBeLessThan(1.8);
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
        // (a rock on the far edge: nobody comes at it from beyond the edge, where the bounds would pin you into it)
        if (Math.hypot(p.x, p.z) > EDGE - BODY) continue;
        let least = Infinity;
        for (let i = 0; i < 600; i++) {
          p = walkStep(p, (-Math.cos(a) * 2) / 60, (-Math.sin(a) * 2) / 60, OUTSIDE);
          least = Math.min(least, clearance(s, p.x, p.z));
          // (expect only on a miss: with the rocks there are ~N² × 7 200 checks, too slow as expect calls on CI)
          for (const o of OUTSIDE.solids) {
            const c = clearance(o, p.x, p.z);
            if (c < -1e-6) expect(c, `${s.name} from ${k}: inside ${o.name}`).toBeGreaterThanOrEqual(-1e-6);
          }
        }
        expect(least, `${s.name} from ${k}`).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  }, 30_000);

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
    for (let i = 0; i < 60 * 60; i++) p = walkStep(p, 0.01, 2 / 60, OUTSIDE);
    expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(EDGE - BODY + 1e-9);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThan(EDGE - BODY - 0.5); // (it got there)
    let q: { x: number; z: number } = { x: LAYOUT.habitat[0], z: LAYOUT.habitat[1] };
    for (let i = 0; i < 600; i++) q = walkStep(q, 2 / 60, 0.5 / 60, INSIDE);
    expect(Math.hypot(q.x - LAYOUT.habitat[0], q.z - LAYOUT.habitat[1])).toBeLessThanOrEqual(ROOM - BODY + 1e-9);
    // (The rig calls that "inside" while the eye is within 1.6 m of the habitat's middle.)
    expect(ROOM - BODY).toBeLessThan(1.6);
  });
});

describe('the play area (120 m, the team on 15 Nov: "4× bigger with the car")', () => {
  it('is the same 120 m for the astronaut and the rover, on the detailed ground', () => {
    expect(EDGE).toBe(120);
    expect(ROVER_AREA.bounds).toBe(OUTSIDE.bounds); // (it can get out wherever the rover can go)
    expect(EDGE + 5).toBeLessThan(NEAR_R);
    // the whole ice crater (26 m round its middle) is inside it now
    expect(Math.hypot(ICE_CRATER.x, ICE_CRATER.z) + 26).toBeLessThan(EDGE - ROVER.r);
  });

  it('the astronaut walks down into the ice crater (5 m deep) and up out of it, on the ground all the way', () => {
    const d = Math.hypot(ICE_CRATER.x, ICE_CRATER.z);
    const ux = ICE_CRATER.x / d, uz = ICE_CRATER.z / d; // from the base towards the crater
    const b = createBody(ICE_CRATER.x - ux * 30, ICE_CRATER.z - uz * 30, footGround);
    let low = Infinity, lift = 0;
    for (let t = 0; t < 70; t += STEP) {
      const s = t < 35 ? 1 : -1; // in, then back out
      stepBody(b, { x: ux * s, z: uz * s, run: true, jump: false }, OUTSIDE, footGround);
      low = Math.min(low, b.y);
      lift = Math.max(lift, b.y - footGround(b.x, b.z));
    }
    expect(low).toBeLessThan(footGround(ICE_CRATER.x - ux * 30, ICE_CRATER.z - uz * 30) - 3); // it went down in
    expect(lift).toBeLessThan(0.3); // (never flung off the slope)
    expect(Math.hypot(b.x - ICE_CRATER.x, b.z - ICE_CRATER.z)).toBeGreaterThan(26); // and came back out
  });

  it('the rover drives across the ice crater, on its wheels, tilting but never flipping', () => {
    const d = Math.hypot(ICE_CRATER.x, ICE_CRATER.z);
    const px = -ICE_CRATER.z / d, pz = ICE_CRATER.x / d; // across, square to the way from the base
    const yaw = Math.atan2(px, pz);
    const r: Rover = { x: ICE_CRATER.x - px * 32, z: ICE_CRATER.z - pz * 32, yaw, speed: 0, y: 0, pitch: 0, roll: 0 };
    let tilt = 0;
    for (let i = 0; i < 60 * 30; i++) {
      stepRover(r, { throttle: 1, steer: 0, brake: false }, ROVER_AREA, wheelGround, 1 / 60);
      tilt = Math.max(tilt, Math.abs(r.pitch), Math.abs(r.roll));
    }
    expect((r.x - ICE_CRATER.x) * px + (r.z - ICE_CRATER.z) * pz).toBeGreaterThan(26); // over the far rim
    expect(tilt).toBeLessThan(0.6);
  });
});

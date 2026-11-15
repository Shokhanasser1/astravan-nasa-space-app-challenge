import { describe, expect, it } from 'vitest';
import { ASTRA_PLAN, HDU_PLAN, type BasePlan } from './layout';
import { ICE_CRATER } from './ground';
import { CRASH, REACH_M, WRECK, WRECK_ROVER, crashStart, doorSpot, reachedBase, wreckSolids } from './crash';
import { BODY, clearance, fits, walkStep, type Area } from '../walk/collide';
import { EDGE, makeOutside } from '../walk/world';

/** A plan's outside with the crash site's hitboxes in it (whatever the flag says today). */
function outsideWithWreck(hdu: boolean): Area {
  const base = makeOutside(hdu);
  return { solids: [...base.solids.filter((s) => !s.name?.startsWith('wreck')), ...wreckSolids()], bounds: base.bounds };
}

const PLANS: [string, BasePlan, boolean][] = [
  ['ASTRA', ASTRA_PLAN, false],
  ['HDU', HDU_PLAN, true],
];

describe('the crash site (home story T2)', () => {
  it("is the document's spot: ~55 m from the habitat door, on the ice crater's side, inside the walk edge", () => {
    for (const [name, plan] of PLANS) {
      const [dx, dz] = doorSpot(plan);
      const d = Math.hypot(CRASH[0] - dx, CRASH[1] - dz);
      expect(d, name).toBeGreaterThan(50);
      expect(d, name).toBeLessThan(60);
    }
    // nearer the ice crater than the base is, and still outside its bowl (r 26)
    const toIce = Math.hypot(CRASH[0] - ICE_CRATER.x, CRASH[1] - ICE_CRATER.z);
    expect(toIce).toBeLessThan(Math.hypot(ICE_CRATER.x, ICE_CRATER.z));
    expect(toIce).toBeGreaterThan(26);
    for (const s of wreckSolids()) {
      const far = Math.max(Math.hypot(s.x, s.z), Math.hypot(s.bx ?? s.x, s.bz ?? s.z)) + s.r;
      expect(far, s.name).toBeLessThan(EDGE - 5);
    }
  });

  it('starts the astronaut on clear ground, facing the door, on both plans', () => {
    for (const [name, plan, hdu] of PLANS) {
      const area = outsideWithWreck(hdu);
      const s = crashStart(plan);
      expect(fits(s.x, s.z, area), name).toBe(true);
      // a step all round is clear too (the touch stick can push any way first)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        expect(fits(s.x + Math.sin(a), s.z + Math.cos(a), area), `${name} ${k}`).toBe(true);
      }
      const [dx, dz] = doorSpot(plan);
      expect(Math.abs(Math.atan2(dx - s.x, dz - s.z) - s.facing), name).toBeLessThan(1e-9);
    }
  });

  it("puts the wreck and the rover clear of every other hitbox (no notch to wedge in), on both plans", () => {
    for (const [name, , hdu] of PLANS) {
      const others = makeOutside(hdu).solids.filter((s) => !s.name?.startsWith('wreck'));
      for (const w of wreckSolids()) {
        for (const o of others) {
          // the two shapes' surfaces are at least a body's width apart, or they would trap a walker between them
          let gap = Infinity;
          for (let t = 0; t <= 1; t += 0.1) {
            const x = w.x + ((w.bx ?? w.x) - w.x) * t;
            const z = w.z + ((w.bz ?? w.z) - w.z) * t;
            gap = Math.min(gap, clearance(o, x, z, 0) - w.r);
          }
          expect(gap, `${name}: ${w.name} vs ${o.name}`).toBeGreaterThan(2 * BODY);
        }
      }
    }
    // and the wreck and the rover leave a walkway between them
    const [a, b] = wreckSolids();
    expect(clearance(a, b.x, b.z, 0) - b.r).toBeGreaterThan(2 * BODY);
  });

  it('leaves a straight, clear walk from the wreck to the base light (ASTRA, the game plan)', () => {
    const area = outsideWithWreck(false);
    const s = crashStart(ASTRA_PLAN);
    const [dx, dz] = doorSpot(ASTRA_PLAN);
    const len = Math.hypot(dx - s.x, dz - s.z);
    for (let d = 0; d < len; d += 0.25) {
      const x = s.x + ((dx - s.x) / len) * d;
      const z = s.z + ((dz - s.z) / len) * d;
      if (reachedBase(x, z, ASTRA_PLAN)) break;
      expect(fits(x, z, area), `at ${d.toFixed(2)} m`).toBe(true);
    }
  });

  it('gets a child who just holds the stick toward the light to the base, on both plans', () => {
    // (HDU, `?hdu`: its battery bank stands across the straight line; the walker slides round it)
    for (const [name, plan, hdu] of PLANS) {
      const area = outsideWithWreck(hdu);
      const s = crashStart(plan);
      const [dx, dz] = doorSpot(plan);
      let p = { x: s.x, z: s.z };
      let t = 0;
      for (; t < 90 && !reachedBase(p.x, p.z, plan); t += 1 / 60) {
        const l = Math.hypot(dx - p.x, dz - p.z);
        p = walkStep(p, (dx - p.x) / l / 60, (dz - p.z) / l / 60, area); // walking pace, 1 m/s
      }
      expect(reachedBase(p.x, p.z, plan), name).toBe(true);
      expect(t, name).toBeLessThan(60);
    }
  });

  it('counts the base reached within 6 m of the habitat door, not before', () => {
    for (const [name, plan] of PLANS) {
      const [dx, dz] = doorSpot(plan);
      const s = crashStart(plan);
      expect(reachedBase(s.x, s.z, plan), name).toBe(false);
      expect(reachedBase(dx, dz, plan), name).toBe(true);
      const ux = (s.x - dx) / Math.hypot(s.x - dx, s.z - dz);
      const uz = (s.z - dz) / Math.hypot(s.x - dx, s.z - dz);
      expect(reachedBase(dx + ux * (REACH_M - 0.1), dz + uz * (REACH_M - 0.1), plan), name).toBe(true);
      expect(reachedBase(dx + ux * (REACH_M + 0.1), dz + uz * (REACH_M + 0.1), plan), name).toBe(false);
    }
  });

  it('tips the lander about 35° and keeps its parts apart', () => {
    expect((WRECK.tilt * 180) / Math.PI).toBeCloseTo(35, 5);
    expect(Math.hypot(WRECK.x - WRECK_ROVER.x, WRECK.z - WRECK_ROVER.z)).toBeGreaterThan(WRECK.r + WRECK_ROVER.r);
  });
});

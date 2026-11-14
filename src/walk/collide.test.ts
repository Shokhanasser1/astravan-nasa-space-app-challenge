import { describe, expect, it } from 'vitest';
import { BODY, clearance, fits, walkStep, type Area, type XZ } from './collide';

const pillar = { name: 'pillar', x: 0, z: 0, r: 1 };
const wall = { name: 'wall', x: -4, z: 3, bx: 4, bz: 3, r: 0.2 };
const area: Area = { solids: [pillar, wall], bounds: { x: 0, z: 0, r: 20 } };

/** Walk for `seconds` at `speed` towards (dx, dz), a frame at a time. */
function stroll(from: XZ, dx: number, dz: number, speed = 2, seconds = 6, hz = 60, where = area): XZ {
  const len = Math.hypot(dx, dz) || 1;
  let p = from;
  for (let i = 0; i < seconds * hz; i++) p = walkStep(p, ((dx / len) * speed) / hz, ((dz / len) * speed) / hz, where);
  return p;
}

describe('walking into solid things', () => {
  it('stops at a round solid and at a bar, a body away from their surface', () => {
    const atPillar = stroll({ x: -6, z: 0 }, 1, 0);
    expect(atPillar.x).toBeCloseTo(-(pillar.r + BODY), 6);
    const atWall = stroll({ x: 2.5, z: 8 }, 0, -1);
    expect(atWall.z).toBeCloseTo(wall.z + wall.r + BODY, 6);
    expect(clearance(wall, atWall.x, atWall.z)).toBeGreaterThanOrEqual(-1e-9);
  });

  it('does not shake while it is held against a wall', () => {
    let p = stroll({ x: 2.5, z: 8 }, 0, -1);
    const rest = { ...p };
    for (let i = 0; i < 120; i++) {
      p = walkStep(p, 0, -2 / 60, area);
      expect(Math.hypot(p.x - rest.x, p.z - rest.z)).toBeLessThan(1e-9);
    }
  });

  it('slides along a wall and round a pillar when it meets them at an angle', () => {
    // Diagonally into the bar: no progress through it, steady progress along it.
    const along = stroll({ x: -2, z: 6 }, 1, -1, 2, 2);
    expect(along.z).toBeCloseTo(wall.z + wall.r + BODY, 6);
    expect(along.x).toBeGreaterThan(-2 + 1.5);
    // Just off-centre into the pillar: round it and out the far side.
    const round = stroll({ x: -6, z: 0.05 }, 1, 0, 2, 8);
    expect(round.x).toBeGreaterThan(pillar.r + BODY);
  });

  it('never gets stuck in the corner between two solids, and never passes through', () => {
    // The inside corner where the bar's end meets a second bar at right angles.
    const corner: Area = { solids: [wall, { x: 4, z: 3, bx: 4, bz: 9, r: 0.2 }], bounds: area.bounds };
    const into = stroll({ x: 0, z: 7 }, 1, -1, 2, 5, 60, corner);
    for (const s of corner.solids) expect(clearance(s, into.x, into.z)).toBeGreaterThanOrEqual(-1e-6);
    // Still free to walk back out.
    const out = stroll(into, -1, 1, 2, 2, 60, corner);
    expect(Math.hypot(out.x - into.x, out.z - into.z)).toBeGreaterThan(3);
  });

  it('cannot tunnel through a thin bar however long a frame is, or however slow the frame rate', () => {
    const thin: Area = { solids: [{ x: -5, z: 0, bx: 5, bz: 0, r: 0.05 }], bounds: area.bounds };
    // One huge step (a stalled tab), then five frames a second.
    expect(walkStep({ x: 0, z: 3 }, 0, -12, thin).z).toBeGreaterThanOrEqual(0.05 + BODY - 1e-9);
    expect(stroll({ x: 0, z: 3 }, 0, -1, 2.5, 4, 5, thin).z).toBeGreaterThanOrEqual(0.05 + BODY - 1e-9);
  });

  it('stays inside the edge of the playable ground, sliding along it', () => {
    const p = stroll({ x: 15, z: 0 }, 1, 0.3, 2, 10);
    expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(20 - BODY + 1e-9);
    expect(p.z).toBeGreaterThan(1);
  });

  it('is pushed out when it starts inside a solid, even dead on its centre', () => {
    const p = walkStep({ x: 0, z: 0 }, 0, 0, area);
    expect(fits(p.x, p.z, area)).toBe(true);
    const q = walkStep({ x: 0.2, z: 0.1 }, 0.01, 0, area);
    expect(fits(q.x, q.z, area)).toBe(true);
  });

  it('writes into the object it is given, so a frame loop allocates nothing', () => {
    const out = { x: 0, z: 0 };
    expect(walkStep({ x: 5, z: 5 }, 0.1, 0, area, BODY, out)).toBe(out);
    expect(out.x).toBeCloseTo(5.1, 9);
  });
});

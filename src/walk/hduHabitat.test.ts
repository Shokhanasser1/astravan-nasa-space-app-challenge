import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeRooms, ROOM_BODY } from './rooms';
import { fits, walkStep } from './collide';
import { OUTSIDE } from './world';
import { climbDuration, climbPose, type ClimbPose, type LadderClimb } from './ladder';
import { HDU, LAYOUT } from '../scene/layout';

/**
 * The HDU habitat (`?hdu`, layout.ts HDU_HABITAT): its two floors, built from the same specs the game uses with the
 * flag on (rooms.ts makeRooms(true)), and its interior GLB's contract (blender/interiors/SPEC.md).
 */
const R = makeRooms(true);
const hab = R.habitat, up = R.habitat_up;

describe('HDU habitat rooms', () => {
  it('are real size: the astronaut is not shrunk inside, with headroom for the suit', () => {
    for (const r of [hab, up]) {
      expect(r.s).toBe(1);
      expect(r.ceilY - r.floorY).toBeGreaterThan(2.5);
    }
    expect(hab.floorY).toBeCloseTo(HDU.floor, 3);
    expect(up.floorY).toBeCloseTo(HDU.deck, 3);
  });

  it('lets you in at the door and out again from where you come in', () => {
    const b = ROOM_BODY * hab.s;
    expect(fits(hab.spawn.x, hab.spawn.z, hab.area, b)).toBe(true);
    expect(hab.exit(hab.spawn.x, hab.spawn.z)).toBe(true);
    // the outside spot is clear ground, in front of the door, beyond the habitat's hitbox
    expect(fits(hab.out.x, hab.out.z, OUTSIDE, 0.35)).toBe(true);
    expect(Math.hypot(hab.out.x - LAYOUT.habitat[0], hab.out.z - LAYOUT.habitat[1])).toBeGreaterThan(HDU.shell + 1);
  });

  it('walks from the door to the ladder through the open middle', () => {
    const b = ROOM_BODY * hab.s;
    const L = hab.ladder!;
    let p = { x: hab.spawn.x, z: hab.spawn.z };
    for (let i = 0; i < 200 && Math.hypot(p.x - L.foot.x, p.z - L.foot.z) > 0.05; i++) {
      const dx = L.foot.x - p.x, dz = L.foot.z - p.z, d = Math.hypot(dx, dz);
      const st = Math.min(0.05, d);
      p = walkStep(p, (dx / d) * st, (dz / d) * st, hab.area, b);
    }
    expect(Math.hypot(p.x - L.foot.x, p.z - L.foot.z)).toBeLessThan(0.1);
    expect(L.near(L.foot.x, L.foot.z)).toBe(true);
  });

  it('climbs up and down the ladder to free floor on each side, in a few seconds', () => {
    for (const [a, b] of [[hab, up], [up, hab]] as const) {
      const L = a.ladder!;
      expect(L.to).toBe(b.id);
      expect(fits(L.arrive.x, L.arrive.z, b.area, ROOM_BODY * b.s), `${a.id} → ${b.id} arrival`).toBe(true);
      expect(b.ladder!.to).toBe(a.id);
      const c: LadderClimb = { from: { ...L.foot }, y0: a.floorY, foot: L.foot, rungs: L.rungs, to: L.arrive, y1: b.floorY };
      const T = climbDuration(c);
      expect(T, `${a.id} climb`).toBeGreaterThan(3);
      expect(T, `${a.id} climb`).toBeLessThan(10);
      const end = climbPose(c, T, {} as ClimbPose);
      expect(end.y).toBeCloseTo(b.floorY, 2);
    }
  });

  it('keeps every hitbox inside the lining', () => {
    for (const r of [hab, up]) {
      for (const s of r.area.solids) {
        for (const [x, z] of [[s.x, s.z], [s.bx ?? s.x, s.bz ?? s.z]]) {
          expect(Math.hypot(x - LAYOUT.habitat[0], z - LAYOUT.habitat[1]), `${r.id} ${s.name}`).toBeLessThan(HDU.lining);
        }
      }
    }
  });
});

describe('HDU habitat models', () => {
  const nodes = (f: string) => {
    const b = readFileSync(f);
    const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
    return { names: new Set<string>(j.nodes.map((n: { name?: string }) => n.name)), anims: (j.animations ?? []).map((a: { name: string }) => a.name), mats: j.materials.map((m: { name: string }) => m.name) };
  };

  it('has the interior contract: root, two door pivots, furniture, glow, the three door clips', () => {
    const g = nodes('public/models/interiors/hdu_habitat.glb');
    for (const n of ['habitat_interior', 'habitat_door', 'habitat_door_inner', 'habitat_furniture', 'habitat_glow']) expect(g.names.has(n), n).toBe(true);
    expect(g.anims).toEqual(expect.arrayContaining(['DoorOpen', 'DoorOpenOuter', 'DoorOpenInner']));
    expect(g.mats.length).toBeLessThanOrEqual(14);
    for (const m of g.mats) expect(m).toMatch(/^(int|glow)_/);
  });

  it('has the shell', () => {
    expect(nodes('public/models/nasa-outpost/hdu_habitat.glb').names.size).toBeGreaterThan(0);
  });
});

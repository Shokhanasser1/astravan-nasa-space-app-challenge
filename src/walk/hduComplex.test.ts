// The HDU complex (`?hdu`, layout.ts HDU_HABITAT): every module's two floors, built from the same specs the game
// uses with the flag on (rooms.ts makeRooms(true); in vitest the flag is off, so nothing here reads the module-level
// LAYOUT or ROOMS). Real size, in at the door and out again, through the open middle to the ladder, up and down it,
// every hitbox inside the lining; the outside camera keeps out of the domes and tunnels. (The interior GLBs'
// contract is tested with the scene.)
import { describe, expect, it } from 'vitest';
import { DOOR_REACH, ROOMS, ROOM_BODY, buildingOf, doorAt, inHduComplex, makeRooms, type Room, type RoomId } from './rooms';
import { fits, walkStep } from './collide';
import { makeOutside } from './world';
import { HAB_ROOM, makeHabRoom } from './habitatRoom';
import { climbDuration, climbPose, type ClimbPose, type LadderClimb } from './ladder';
import { HDU, HDU_COMPLEX, HDU_MODULES, HDU_PLAN, moduleToGame, type HduModule } from '../scene/layout';
import { GRAVITY, jumpSpeed } from '../character/physics.js';
import ROOM_BOXES_HDU from './rooms_hdu.json';

const R = makeRooms(true);
const LIST: readonly Room[] = Object.values(R);
const UP = { habitat: 'habitat_up', greenhouse: 'greenhouse_up', lab: 'lab_up' } as const satisfies Record<HduModule, RoomId>;
const SITE = { habitat: 'habitat', greenhouse: 'garden', lab: 'workshop' } as const;
/** A suited astronaut standing (m) and the top of a standing Moon jump above that. */
const SUIT = 1.86;
const JUMP = jumpSpeed(0) ** 2 / (2 * GRAVITY.moon);

/** Game (x, z) → the module's frame (its centre, door at +z). */
function toModule(m: HduModule, x: number, z: number): [number, number] {
  const [cx, cz] = moduleToGame(m, 0, 0);
  const c = Math.cos(HDU_COMPLEX.turn), s = Math.sin(HDU_COMPLEX.turn);
  const dx = x - cx, dz = z - cz;
  return [dx * c - dz * s, dx * s + dz * c];
}

describe('HDU complex rooms', () => {
  it('has the three modules, two floors each, and ASTRA lander; ASTRA keeps its five', () => {
    expect(Object.keys(R).sort()).toEqual(['greenhouse', 'greenhouse_up', 'habitat', 'habitat_up', 'lab', 'lab_up', 'lander']);
    expect(Object.keys(makeRooms(false)).sort()).toEqual(['greenhouse', 'habitat', 'habitat_up', 'lab', 'lander']);
    expect(Object.keys(ROOMS).sort()).toEqual(Object.keys(makeRooms(false)).sort()); // (the flag is off in tests)
    for (const m of HDU_MODULES) {
      expect(buildingOf(m)).toBe(m);
      expect(buildingOf(UP[m])).toBe(m);
    }
    expect(buildingOf('lander')).toBe('lander');
  });

  for (const m of HDU_MODULES) {
    const g = R[m], up = R[UP[m]];
    const [cx, cz] = moduleToGame(m, 0, 0);

    describe(m, () => {
      it('is real size, at its module, with headroom for a suit and a jump on both floors', () => {
        expect(HDU_PLAN.LAYOUT[SITE[m]][0]).toBeCloseTo(cx, 9);
        expect(HDU_PLAN.LAYOUT[SITE[m]][1]).toBeCloseTo(cz, 9);
        for (const r of [g, up]) {
          expect(r.s).toBe(1);
          expect(r.jump).toBe(true);
          expect(r.area.bounds.x).toBeCloseTo(cx, 9);
          expect(r.area.bounds.z).toBeCloseTo(cz, 9);
          expect(r.area.bounds.r).toBeCloseTo(HDU.lining - 0.05, 9);
          expect(r.ceilY - r.floorY, r.id).toBeGreaterThanOrEqual(SUIT + JUMP);
        }
        expect(g.floorY).toBeCloseTo(HDU.floor, 9);
        expect(g.ceilY).toBeLessThan(HDU.deck); // under the deck
        expect(up.floorY).toBeCloseTo(HDU.deck, 9);
        expect(up.ceilY).toBeLessThan(HDU.top); // under the dome
        expect(g.noDoor).toBe(false);
        expect(up.noDoor).toBe(true);
      });

      it('lets you in just inside the door, facing in, and out by E there', () => {
        const b = ROOM_BODY * g.s;
        expect(fits(g.spawn.x, g.spawn.z, g.area, b)).toBe(true);
        expect(g.exit(g.spawn.x, g.spawn.z)).toBe(true);
        const [sx, sz] = toModule(m, g.spawn.x, g.spawn.z);
        expect(sz).toBeGreaterThan(1.2); // in the entry section, by the door
        expect(Math.sin(g.spawn.facing) * (cx - g.spawn.x) + Math.cos(g.spawn.facing) * (cz - g.spawn.z)).toBeGreaterThan(0);
        expect(Math.abs(sx)).toBeLessThan(0.05);
        // not out from the middle, the ladder or the loft
        expect(g.exit(cx, cz)).toBe(false);
        expect(g.exit(g.ladder!.foot.x, g.ladder!.foot.z)).toBe(false);
        expect(up.exit(up.spawn.x, up.spawn.z)).toBe(false);
      });

      it('has its door spot outside, in front of the door, on free ground, and E there finds this module', () => {
        const [ox, oz] = toModule(m, g.out.x, g.out.z);
        expect(ox).toBeCloseTo(0, 9);
        expect(oz).toBeCloseTo(4.0, 9);
        expect(Math.hypot(g.out.x - cx, g.out.z - cz)).toBeGreaterThan(HDU.front + 1);
        expect(Math.sin(g.out.facing) * (g.out.x - cx) + Math.cos(g.out.facing) * (g.out.z - cz)).toBeGreaterThan(0); // facing out
        expect(fits(g.out.x, g.out.z, makeOutside(true), 0.35)).toBe(true);
        expect(doorAt(g.out, LIST)).toBe(m);
        expect(doorAt({ x: g.out.x, z: g.out.z + DOOR_REACH + 0.1 }, LIST)).toBe(null);
        // a phase change on the loft puts you out at the same door
        expect(up.out).toEqual(g.out);
      });

      it('walks from the door to the ladder through the open middle', () => {
        const b = ROOM_BODY * g.s;
        const L = g.ladder!;
        let p = { x: g.spawn.x, z: g.spawn.z };
        for (let i = 0; i < 200 && Math.hypot(p.x - L.foot.x, p.z - L.foot.z) > 0.01; i++) {
          const dx = L.foot.x - p.x, dz = L.foot.z - p.z, d = Math.hypot(dx, dz);
          const st = Math.min(0.05, d);
          p = walkStep(p, (dx / d) * st, (dz / d) * st, g.area, b);
        }
        expect(Math.hypot(p.x - L.foot.x, p.z - L.foot.z)).toBeLessThan(0.05);
        expect(L.near(L.foot.x, L.foot.z)).toBe(true);
        expect(L.near(g.spawn.x, g.spawn.z)).toBe(false); // (at the door E goes out)
        // the climbing spot: 0.42 m in front of the rungs (z 0), facing them (−z)
        const [fx, fz] = toModule(m, L.foot.x, L.foot.z);
        const [rx, rz] = toModule(m, L.rungs.x, L.rungs.z);
        expect([fx, fz, rx, rz].map((v) => +v.toFixed(6))).toEqual([0, 0.42, 0, 0]);
        expect(Math.cos(L.foot.facing - (Math.PI + HDU_COMPLEX.turn))).toBeCloseTo(1, 9);
      });

      it('climbs up and down the ladder in a few seconds, onto free floor right by the ladder back', () => {
        for (const [a, b] of [[g, up], [up, g]] as const) {
          const L = a.ladder!;
          expect(L.to).toBe(b.id);
          expect(b.ladder!.to).toBe(a.id);
          expect(fits(L.arrive.x, L.arrive.z, b.area, ROOM_BODY * b.s), `${a.id} → ${b.id} arrival`).toBe(true);
          expect(b.ladder!.near(L.arrive.x, L.arrive.z), `${b.id}: E at the arrival climbs back`).toBe(true);
          // the same climbing spot on both floors
          expect(Math.hypot(L.foot.x - b.ladder!.foot.x, L.foot.z - b.ladder!.foot.z)).toBeLessThan(1e-9);
          const c: LadderClimb = { from: { ...L.foot }, y0: a.floorY, foot: L.foot, rungs: L.rungs, to: L.arrive, y1: b.floorY };
          const T = climbDuration(c);
          expect(T, `${a.id} climb`).toBeGreaterThan(2);
          expect(T, `${a.id} climb`).toBeLessThan(10);
          const end = climbPose(c, T, {} as ClimbPose);
          expect(end.stage).toBe('done');
          expect(end.y).toBeCloseTo(b.floorY, 6);
          expect(end.x).toBeCloseTo(L.arrive.x, 6);
          expect(end.z).toBeCloseTo(L.arrive.z, 6);
        }
      });

      it('keeps every hitbox inside the lining, all of its Blender boxes', () => {
        for (const r of [g, up]) {
          expect(r.area.solids.length).toBe((ROOM_BOXES_HDU as Record<string, unknown[]>)[r.id].length);
          for (const s of r.area.solids) {
            for (const [x, z] of [[s.x, s.z], [s.bx ?? s.x, s.bz ?? s.z]]) {
              // each bar's ends inside the lining; its round ends at most 5 cm past it (straight cabinets against the
              // curved wall: the hygiene corner and the lab's sample rack poke 2–4 cm out, where nobody walks)
              expect(Math.hypot(x - cx, z - cz), `${r.id} ${s.name}`).toBeLessThan(HDU.lining);
              expect(Math.hypot(x - cx, z - cz) + s.r, `${r.id} ${s.name}`).toBeLessThan(HDU.lining + 0.05);
            }
          }
        }
      });
    });
  }

  it('has the lander too, its door spot on free ground of the HDU base', () => {
    const L = R.lander;
    expect(L.noDoor).toBe(false);
    expect(Math.hypot(L.area.bounds.x - HDU_PLAN.LAYOUT.lander[0], L.area.bounds.z - HDU_PLAN.LAYOUT.lander[1])).toBeLessThan(1e-9);
    expect(fits(L.out.x, L.out.z, makeOutside(true), 0.35)).toBe(true);
    expect(doorAt(L.out, LIST)).toBe('lander');
  });
});

describe('HDU habitat walk (first person, habitatRoom.ts)', () => {
  it('is the habitat module ground floor at real size', () => {
    const a = makeHabRoom(true), b = R.habitat.area;
    expect(a.bounds.x).toBeCloseTo(HDU_PLAN.LAYOUT.habitat[0], 9);
    expect(a.bounds.z).toBeCloseTo(HDU_PLAN.LAYOUT.habitat[1], 9);
    expect(a.bounds.r).toBeCloseTo(HDU.lining - 0.05, 9);
    expect(a.solids.length).toBe(ROOM_BOXES_HDU.habitat.length);
    a.solids.forEach((s, i) => {
      const t = b.solids[i];
      expect(s.name).toBe(t.name);
      for (const k of ['x', 'z', 'bx', 'bz', 'r'] as const) expect(s[k]).toBeCloseTo(t[k]!, 9);
    });
  });

  it('keeps ASTRA as it was', () => {
    expect(makeHabRoom(false)).toEqual(HAB_ROOM);
  });
});

describe('the outside camera and the HDU complex (Rig.tsx)', () => {
  const tunnelMid = (a: HduModule, b: HduModule) => {
    const [ax, az] = moduleToGame(a, 0, 0), [bx, bz] = moduleToGame(b, 0, 0);
    return [(ax + bx) / 2, (az + bz) / 2] as const;
  };

  it('keeps out of every module, below its dome top', () => {
    for (const m of HDU_MODULES) {
      const [x, z] = moduleToGame(m, 0, 0);
      expect(inHduComplex(x, 1.6, z, 0.3), m).toBe(true);
      expect(inHduComplex(x + HDU.shell + 0.2, 5, z, 0.3), `${m} by its wall`).toBe(true);
      expect(inHduComplex(x, HDU.top + 0.5, z, 0.3), `${m} over its dome`).toBe(false);
      // the astronaut at the door, with the camera behind it: clear
      const g = R[m];
      expect(inHduComplex(g.out.x, 1.6, g.out.z, 0.3), `${m} door spot`).toBe(false);
    }
  });

  it('keeps out of the tunnels between neighbouring modules, not beside or over them', () => {
    for (const [a, b] of [['greenhouse', 'habitat'], ['habitat', 'lab']] as const) {
      const [x, z] = tunnelMid(a, b);
      expect(inHduComplex(x, HDU.tunnelY, z, 0.3)).toBe(true);
      expect(inHduComplex(x, HDU.tunnelY + HDU.tunnelR + 0.2, z, 0.3)).toBe(true);
      expect(inHduComplex(x, HDU.tunnelY + HDU.tunnelR + 0.5, z, 0.3)).toBe(false);
      const [nx, nz] = moduleToGame(a, 0, HDU.tunnelR + 0.5); // (beside it, toward the doors)
      expect(inHduComplex(x + (nx - moduleToGame(a, 0, 0)[0]), HDU.tunnelY, nz, 0.3)).toBe(false);
    }
    // no tunnel past the end modules
    const [ex, ez] = moduleToGame('greenhouse', -(HDU.shell + 1), 0);
    expect(inHduComplex(ex, HDU.tunnelY, ez, 0.3)).toBe(false);
  });
});

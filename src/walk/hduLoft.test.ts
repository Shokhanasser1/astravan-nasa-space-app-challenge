// The HDU complex's lofts (`?hdu`, rooms.ts makeRooms(true), rooms_hdu.json `*_up`): off the ladder you can walk all
// the way round the well rail and up to every piece of furniture, with the game's own walker (collide.ts walkStep)
// and its own hitboxes (each box a capsule along its long side). The walkway is at least 0.65 m clear: a body that
// wide gets round too. Built in oy-karvonsaroyi-3d/hb7/hdu_base/build_game_complex.py (the loft, its well and rail).
import { describe, expect, it } from 'vitest';
import { ROOM_BODY, makeRooms, type Room, type RoomId } from './rooms';
import { clearance, fits, walkStep, type Solid, type XZ } from './collide';
import { HDU_COMPLEX, HDU_MODULES, type HduModule } from '../scene/layout';
import { climbDuration, climbPose, type ClimbPose, type LadderClimb } from './ladder';

const R = makeRooms(true);
const UP = { habitat: 'habitat_up', greenhouse: 'greenhouse_up', lab: 'lab_up' } as const satisfies Record<HduModule, RoomId>;
/** What each loft holds besides its lockers (recognisable: sleep berths and pods, grow racks, workstations). */
const KIND = { habitat: /^(bunk|pod)_/, greenhouse: /^rack_/, lab: /^desk_/ } as const;

/** Module frame (its centre, door at +z) ↔ game, as rooms.ts builds it (k 1). */
function frame(room: Room) {
  const { x: cx, z: cz } = room.area.bounds;
  const c = Math.cos(HDU_COMPLEX.turn), s = Math.sin(HDU_COMPLEX.turn);
  return {
    toModule: (p: XZ): XZ => ({ x: (p.x - cx) * c - (p.z - cz) * s, z: (p.x - cx) * s + (p.z - cz) * c }),
    toGame: (x: number, z: number): XZ => ({ x: cx + x * c + z * s, z: cz - x * s + z * c }),
  };
}

/** The well rail's hitbox and the middle of its segment (module frame). */
function well(room: Room) {
  const w = room.area.solids.find((s) => s.name === 'well_guard')!;
  const f = frame(room);
  return { solid: w, mid: f.toModule({ x: (w.x + (w.bx ?? w.x)) / 2, z: (w.z + (w.bz ?? w.z)) / 2 }) };
}

/**
 * Walk round the well from the ladder arrival, hugging the rail (a small pull toward the well, the rest along it,
 * 5 cm steps): the angle swept round the well's middle, where it ended, and the spots it passed.
 */
function round(room: Room, body: number, dir: 1 | -1) {
  const f = frame(room);
  const W = well(room).mid;
  let p: XZ = { x: room.spawn.x, z: room.spawn.z };
  const angle = (q: XZ) => {
    const m = f.toModule(q);
    return Math.atan2(m.x - W.x, m.z - W.z);
  };
  let swept = 0;
  let last = angle(p);
  const path: XZ[] = [];
  for (let i = 0; i < 600 && Math.abs(swept) < 2 * Math.PI; i++) {
    const m = f.toModule(p);
    const rx = m.x - W.x, rz = m.z - W.z, d = Math.hypot(rx, rz);
    // along the rail (turning dir) and a little toward it, in the module frame, then into the game frame
    const tx = (dir * rz) / d, tz = (-dir * rx) / d;
    const mx = 0.05 * tx - 0.02 * (rx / d), mz = 0.05 * tz - 0.02 * (rz / d);
    const g = f.toGame(m.x + mx, m.z + mz);
    p = walkStep(p, g.x - p.x, g.z - p.z, room.area, body, { x: 0, z: 0 });
    const a = angle(p);
    swept += Math.atan2(Math.sin(a - last), Math.cos(a - last));
    last = a;
    path.push({ ...p });
  }
  return { deg: (Math.abs(swept) * 180) / Math.PI, end: p, path };
}

/** From the ring, walk straight at a solid (5 cm steps, sliding as the game does): how close the body gets. */
function approach(room: Room, s: Solid, from: XZ, body: number): number {
  const target = { x: (s.x + (s.bx ?? s.x)) / 2, z: (s.z + (s.bz ?? s.z)) / 2 };
  let p = { ...from };
  for (let i = 0; i < 80 && clearance(s, p.x, p.z, body) > 0.01; i++) {
    const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
    p = walkStep(p, (dx / d) * 0.05, (dz / d) * 0.05, room.area, body, { x: 0, z: 0 });
  }
  return clearance(s, p.x, p.z, body);
}

describe('HDU lofts: a walkway round the well', () => {
  for (const m of HDU_MODULES) {
    const up = R[UP[m]];
    const body = ROOM_BODY * up.s;

    describe(m, () => {
      it('arrives off the ladder on free floor, the rail round the well no bigger than the ladder needs', () => {
        expect(fits(up.spawn.x, up.spawn.z, up.area, body)).toBe(true);
        const { solid: w, mid } = well(up);
        // the ladder (rails at x ±0.25, rungs at z 0) and the climber in front of it (z 0.42) inside the rail
        const f = frame(up);
        for (const [x, z] of [[-0.25, 0], [0.25, 0], [0, 0.42]]) {
          const g = f.toGame(x, z);
          expect(clearance(w, g.x, g.z, 0), `${x}, ${z}`).toBeLessThan(0);
        }
        // and no bigger: about 1 m across, 0.75 m deep, its middle toward the step-off
        const half = Math.hypot((w.bx ?? w.x) - w.x, (w.bz ?? w.z) - w.z) / 2;
        expect(2 * (half + w.r)).toBeLessThanOrEqual(1.05);
        expect(2 * w.r).toBeLessThanOrEqual(0.75);
        expect(mid.z).toBeGreaterThan(0);
      });

      it('walks all the way round the well rail, both ways, back to the ladder', () => {
        for (const dir of [1, -1] as const) {
          const r = round(up, body, dir);
          expect(r.deg, `${m} dir ${dir}`).toBeGreaterThanOrEqual(360);
          expect(Math.hypot(r.end.x - up.spawn.x, r.end.z - up.spawn.z), `${m} dir ${dir}`).toBeLessThan(0.3);
        }
      });

      it('has a walkway at least 0.65 m clear: a body that wide gets round as well', () => {
        for (const dir of [1, -1] as const) expect(round(up, 0.325, dir).deg, `${m} dir ${dir}`).toBeGreaterThanOrEqual(360);
      });

      it('reaches the front of every piece of furniture from the walkway', () => {
        const solids = up.area.solids.filter((s) => s.name !== 'well_guard');
        expect(solids.filter((s) => KIND[m].test(s.name!)).length).toBe(4);
        expect(solids.filter((s) => /^locker_/.test(s.name!)).length).toBe(3);
        const { path } = round(up, body, 1);
        const f = frame(up);
        const W = well(up).mid;
        const az = (q: XZ) => {
          const p = f.toModule(q);
          return Math.atan2(p.x - W.x, p.z - W.z);
        };
        for (const s of solids) {
          const mid = { x: (s.x + (s.bx ?? s.x)) / 2, z: (s.z + (s.bz ?? s.z)) / 2 };
          // the ring spot most nearly in line with it
          const a = az(mid);
          const from = path.reduce((b, q) => (Math.abs(Math.sin((az(q) - a) / 2)) < Math.abs(Math.sin((az(b) - a) / 2)) ? q : b));
          expect(approach(up, s, from, body), `${m} ${s.name}`).toBeLessThan(0.02);
        }
      });

      it('keeps the furniture against the lining', () => {
        const { x: cx, z: cz } = up.area.bounds;
        for (const s of up.area.solids.filter((q) => q.name !== 'well_guard')) {
          // the far side of each piece's capsule within 15 cm of the lining (r 1.95)
          for (const [x, z] of [[s.x, s.z], [s.bx ?? s.x, s.bz ?? s.z]]) {
            const far = Math.hypot(x - cx, z - cz) + s.r;
            expect(far, `${m} ${s.name}`).toBeGreaterThan(1.75);
            expect(far, `${m} ${s.name}`).toBeLessThan(2.0);
          }
        }
      });
    });
  }
});

describe('stepping onto the ladder from an HDU loft (finding #15)', () => {
  /** The loft rail's front posts (module frame), either side of its opening. */
  const POSTS: [number, number][] = [[0.3685, 0.4605], [-0.3685, 0.4605]];
  for (const m of HDU_MODULES) {
    it(`${m}: goes through the rail opening, ≥ 0.25 m from its front posts, from every spot E works`, () => {
      const up = R[UP[m]]!;
      const g = R[m]!;
      const L = up.ladder!;
      const f = frame(up);
      // (the stop: module (0, 0.85), then in to the foot spot (0, 0.42))
      expect(L.foot.via).toBeDefined();
      const v = f.toModule(L.foot.via!);
      expect(v.x).toBeCloseTo(0, 9);
      expect(v.z).toBeCloseTo(0.85, 9);
      // (going up from the ground floor: no stop, straight to the foot spot)
      expect(g.ladder!.foot.via).toBeUndefined();
      const pose = {} as ClimbPose;
      let n = 0;
      for (let mx = -1.0; mx <= 1.0; mx += 0.04)
        for (let mz = -0.2; mz <= 1.7; mz += 0.04) {
          const p = f.toGame(mx, mz);
          if (!L.near(p.x, p.z) || !fits(p.x, p.z, up.area, ROOM_BODY * up.s)) continue;
          n++;
          const c: LadderClimb = { from: { x: p.x, z: p.z, facing: 0 }, y0: up.floorY, foot: L.foot, rungs: L.rungs, to: L.arrive, y1: g.floorY };
          const T = climbDuration(c);
          let least = Infinity;
          for (let t = 0; t <= T; t += 0.02) {
            climbPose(c, t, pose);
            if (pose.stage !== 'on') break;
            const q = f.toModule(pose);
            for (const [px, pz] of POSTS) least = Math.min(least, Math.hypot(q.x - px, q.z - pz));
          }
          expect(least, `${m} from module (${mx.toFixed(2)}, ${mz.toFixed(2)})`).toBeGreaterThanOrEqual(0.25);
          // and it ends on the foot spot
          climbPose(c, T - 1e-6, pose);
          expect(Math.hypot(pose.x - L.arrive.x, pose.z - L.arrive.z)).toBeLessThan(0.01);
        }
      expect(n).toBeGreaterThan(20);
    });
  }
});

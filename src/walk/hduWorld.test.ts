// The HDU base outside (`?hdu`, layout.ts HDU_PLAN): the complex's hitboxes, the props in front of it, the standing
// points — built for the HDU plan whatever the flag (makeOutside(true), makePoints(true)), so it is tested with the
// flag off too.
import { describe, expect, it, vi } from 'vitest';
import { HDU, HDU_MODULES, HDU_PLAN, moduleToGame } from '../scene/layout';
import { MARKERS, makePoints } from '../scene/points';
import { BODY, clearance, fits, walkStep, type Area, type Solid } from './collide';
import { EDGE, HDU_BUILDING, OUTSIDE, ROVER_DISC, makeOutside } from './world';

const W = makeOutside(true);
const { POINTS } = makePoints(true);
const { LAYOUT, RADIUS } = HDU_PLAN;
const BUILDINGS = ['habitat', 'garden', 'workshop'];
/** A part of the complex: a module's part (`habitat`, `habitat back`, …) or a tunnel. */
const ofComplex = (s: Solid) => BUILDINGS.some((b) => s.name === b || s.name!.startsWith(b + ' ')) || s.name!.startsWith('tunnel');
/** On the flat pad (r 22, src/scene/ground.ts): everything but the rocks and the things on the ice crater's rim. */
const FAR = new Set(['rock', 'ice drill', 'rassor']);
const onPad = W.solids.filter((s) => !FAR.has(s.name!));
const complex = onPad.filter(ofComplex);
const props = onPad.filter((s) => !ofComplex(s));

/** The walkway between two hitboxes: the closest distance between their middle lines (a point or a segment) minus
 * both radii. (Two segments that do not cross are closest at an end of one of them.) */
function gap(a: Solid, b: Solid): number {
  const core = (s: Solid, x: number, z: number) => clearance(s, x, z, 0) + s.r;
  const d = Math.min(core(b, a.x, a.z), core(b, a.bx ?? a.x, a.bz ?? a.z), core(a, b.x, b.z), core(a, b.bx ?? b.x, b.bz ?? b.z));
  return d - a.r - b.r;
}

/** Head straight for the goal, sliding round whatever is in the way (as world.test.ts). */
function walkTo(from: { x: number; z: number }, goal: { x: number; z: number }, area: Area) {
  let p = { x: from.x + 0.07, z: from.z + 0.03 };
  for (let i = 0; i < 60 * 60 && Math.hypot(goal.x - p.x, goal.z - p.z) > 0.3; i++) {
    const d = Math.hypot(goal.x - p.x, goal.z - p.z);
    p = walkStep(p, ((goal.x - p.x) / d) * (2 / 60), ((goal.z - p.z) / d) * (2 / 60), area);
  }
  return p;
}

describe('the HDU base outside (makeOutside(true))', () => {
  it('has the three modules, their parts and the two tunnels, and every prop of the plan', () => {
    const names = W.solids.map((s) => s.name);
    for (const b of BUILDINGS) for (const part of ['', ' back', ' side', ' porch', ' leg', ' apron', ' fins left', ' fins right'])
      expect(names).toContain(b + part);
    for (const t of ['tunnel garden-habitat', 'tunnel habitat-workshop']) {
      expect(names).toContain(t);
      expect(names).toContain(t + ' back');
    }
    for (const k of ['lander', 'scout', 'hub', 'dish', 'wing', 'rover', 'tanks', 'battery']) expect(names).toContain(k);
    // nothing of the ASTRA base and nothing of the outpost 50 m north (the same complex is the base now)
    expect(names.some((n) => n!.startsWith('outpost'))).toBe(false);
    for (const s of W.solids) expect(s.r * 2, s.name).toBeGreaterThanOrEqual(0.4);
  });

  it('puts the modules where the plan has them and the props where the HDU plan has them', () => {
    for (const b of BUILDINGS) {
      const s = W.solids.find((o) => o.name === b)!;
      const at = LAYOUT[b as 'habitat'];
      expect(Math.hypot(s.x - at[0], s.z - at[1] + 0.3), b).toBeLessThan(1e-9);
    }
    for (const k of ['lander', 'scout', 'hub', 'dish'] as const) {
      const s = W.solids.find((o) => o.name === k)!;
      expect([s.x, s.z], k).toEqual([...LAYOUT[k]]);
    }
    const wing = W.solids.find((o) => o.name === 'wing')!;
    expect((wing.x + wing.bx!) / 2).toBeCloseTo(LAYOUT.wing[0], 9);
    expect((wing.z + wing.bz!) / 2).toBeCloseTo(LAYOUT.wing[1], 9);
    const tanks = W.solids.find((o) => o.name === 'tanks')!;
    expect([tanks.x, tanks.z]).toEqual([HDU_PLAN.TANKS.x, HDU_PLAN.TANKS.z]);
    const battery = W.solids.find((o) => o.name === 'battery')!;
    expect([battery.x, battery.z]).toEqual([...HDU_PLAN.BATTERY_BANK]);
    // a test-built HDU outside has its own rover, parked where the HDU plan parks it (the game's is ROVER_DISC)
    const rover = W.solids.find((o) => o.name === 'rover')!;
    expect([rover.x, rover.z, rover.r]).toEqual([HDU_PLAN.PARKED_ROVER.x, HDU_PLAN.PARKED_ROVER.z, HDU_PLAN.PARKED_ROVER.r]);
    expect(rover).not.toBe(ROVER_DISC);
    expect(OUTSIDE.solids).toContain(ROVER_DISC);
  });

  it('keeps everything on the flat pad (r 22) with half a metre to spare', () => {
    for (const s of onPad)
      for (const [x, z] of [[s.x, s.z], [s.bx ?? s.x, s.bz ?? s.z]]) expect(Math.hypot(x, z) + s.r, s.name).toBeLessThanOrEqual(21.5);
  });

  it('keeps 2 m of walkway between the props, and between the complex and every prop', () => {
    for (let i = 0; i < props.length; i++)
      for (let j = i + 1; j < props.length; j++)
        expect(gap(props[i], props[j]), `${props[i].name} vs ${props[j].name}`).toBeGreaterThanOrEqual(2);
    for (const c of complex) for (const p of props) expect(gap(c, p), `${c.name} vs ${p.name}`).toBeGreaterThanOrEqual(2);
  });

  it('lets you stand at every module door, where you come out of it (module (0, 4.0))', () => {
    for (const id of HDU_MODULES) {
      const [x, z] = moduleToGame(id, 0, 4.0);
      expect(fits(x, z, W, BODY), HDU_BUILDING[id]).toBe(true);
      // and walk from there to every standing point
      for (const m of MARKERS) {
        const goal = { x: POINTS[m].pos[0], z: POINTS[m].pos[2] };
        const p = walkTo({ x, z }, goal, W);
        expect(Math.hypot(goal.x - p.x, goal.z - p.z), `${HDU_BUILDING[id]} door → ${m}`).toBeLessThan(0.35);
      }
    }
  });

  it('cannot be walked through from any side, but can be walked round', () => {
    for (const s of W.solids) {
      const cx = s.bx === undefined ? s.x : (s.x + s.bx) / 2;
      const cz = s.bz === undefined ? s.z : (s.z + s.bz!) / 2;
      let tried = 0;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        let p = { x: cx + Math.cos(a) * 7, z: cz + Math.sin(a) * 7 };
        // (not from beyond the edge, nor from inside another hitbox: the complex's parts stand close together)
        if (Math.hypot(p.x, p.z) > EDGE - BODY) continue;
        if (!fits(p.x, p.z, W)) continue;
        tried++;
        let least = Infinity;
        for (let i = 0; i < 600; i++) {
          p = walkStep(p, (-Math.cos(a) * 2) / 60, (-Math.sin(a) * 2) / 60, W);
          least = Math.min(least, clearance(s, p.x, p.z));
          for (const o of W.solids) {
            const c = clearance(o, p.x, p.z);
            if (c < -1e-6) expect(c, `${s.name} from ${k}: inside ${o.name}`).toBeGreaterThanOrEqual(-1e-6);
          }
        }
        expect(least, `${s.name} from ${k}`).toBeGreaterThanOrEqual(-1e-6);
      }
      // (every part of the base is come at from several sides)
      if (s.name !== 'rock') expect(tried, s.name).toBeGreaterThanOrEqual(4);
    }
  }, 30_000);
});

describe('the HDU standing points (makePoints(true))', () => {
  it('leaves every standing point free, inside the play area', () => {
    for (const id of MARKERS) {
      const [x, , z] = POINTS[id].pos;
      expect(fits(x, z, W), id).toBe(true);
      expect(Math.hypot(x, z), id).toBeLessThan(EDGE - 5);
    }
  });

  it('can be crossed on foot between every pair of standing points', () => {
    for (const a of MARKERS)
      for (const b of MARKERS) {
        if (a === b) continue;
        const goal = { x: POINTS[b].pos[0], z: POINTS[b].pos[2] };
        const p = walkTo({ x: POINTS[a].pos[0], z: POINTS[a].pos[2] }, goal, W);
        expect(Math.hypot(goal.x - p.x, goal.z - p.z), `${a} → ${b}`).toBeLessThan(0.35);
      }
  });

  it('stands at the airlock, the garden and the workshop in front of their module doors, looking at them', () => {
    const front = (id: 'habitat' | 'greenhouse' | 'lab', p: { pos: number[] }) => {
      const [dx, dz] = moduleToGame(id, 0, HDU.front);
      return Math.hypot(p.pos[0] - dx, p.pos[2] - dz);
    };
    expect(front('habitat', POINTS.airlock)).toBeLessThan(3.5);
    expect(front('greenhouse', POINTS.garden)).toBeLessThan(3.5);
    expect(front('lab', POINTS.workshop)).toBeLessThan(3.5);
    for (const [id, m] of [['greenhouse', 'garden'], ['lab', 'workshop']] as const) {
      const [dx, dz] = moduleToGame(id, 0, HDU.front);
      expect(POINTS[m].look[0]).toBeCloseTo(dx, 9);
      expect(POINTS[m].look[2]).toBeCloseTo(dz, 9);
    }
    // the airlock looks out at the hub, nothing tall between
    expect(POINTS.airlock.look[0]).toBe(LAYOUT.hub[0]);
  });

  it('stands close beside the hub (within reach) with room to stand, and W walks straight to Life Support', () => {
    const hub = W.solids.find((s) => s.name === 'hub')!;
    const [hx, , hz] = POINTS.hub.pos;
    expect(clearance(hub, hx, hz)).toBeGreaterThan(0.5);
    expect(Math.hypot(hx - LAYOUT.hub[0], hz - LAYOUT.hub[1]) - RADIUS.hub).toBeLessThan(1.8);
    // walking where the plan point looks ends at the habitat module, not stuck on anything on the way
    const [lx, , lz] = POINTS.hub.look;
    const d = Math.hypot(lx - hx, lz - hz);
    let p = { x: hx, z: hz };
    for (let i = 0; i < 60 * 8; i++) p = walkStep(p, ((lx - hx) / d) * (1 / 60), ((lz - hz) / d) * (1 / 60), W);
    const hab = W.solids.filter((s) => s.name === 'habitat' || s.name!.startsWith('habitat '));
    expect(Math.min(...hab.map((s) => clearance(s, p.x, p.z)))).toBeLessThan(0.05);
  });

  it('stands at the lander ladder within reach, and inside the habitat module by its door', () => {
    const [lx, , lz] = POINTS.ladder.pos;
    expect(Math.hypot(lx - LAYOUT.lander[0], lz - LAYOUT.lander[1])).toBeCloseTo(2.7, 9);
    const [ix, iy, iz] = POINTS.inside.pos;
    const [cx, cz] = LAYOUT.habitat;
    expect(Math.hypot(ix - cx, iz - cz)).toBeLessThan(HDU.lining - 0.35);
    expect(iy).toBeCloseTo(HDU.floor + 1.6, 9);
    // looking from the door side (+z) inward
    expect(POINTS.inside.look[2]).toBeLessThan(iz);
  });
});

describe('the game with the flag on (`?hdu`, here with `?outpost` too)', () => {
  it('walks the HDU outside with the shared rover hitbox, the HDU points, and no outpost 50 m north', async () => {
    vi.resetModules();
    vi.stubGlobal('location', { search: '?hdu&outpost' });
    try {
      const layout = await import('../scene/layout');
      const world = await import('./world');
      const points = await import('../scene/points');
      const site = await import('../scene/outpostSite');
      expect(layout.HDU_HABITAT).toBe(true);
      expect(site.OUTPOST_ON).toBe(false);
      expect(world.OUTSIDE.solids.map((s) => s.name)).toEqual(W.solids.map((s) => s.name));
      // THE rover hitbox the rig moves, parked where the HDU plan parks it, out of the rover's own areas
      expect(world.OUTSIDE.solids).toContain(world.ROVER_DISC);
      expect([world.ROVER_DISC.x, world.ROVER_DISC.z]).toEqual([HDU_PLAN.PARKED_ROVER.x, HDU_PLAN.PARKED_ROVER.z]);
      expect(world.ROVER_AREA.solids).not.toContain(world.ROVER_DISC);
      expect(world.BESIDE_ROVER.solids).not.toContain(world.ROVER_DISC);
      expect(world.ROVER_AREA.solids.some((s) => s.name === 'habitat back')).toBe(true);
      expect(points.POINTS).toEqual(POINTS);
      expect(points.FOCUS).toEqual(makePoints(true).FOCUS);
      expect(world.INSIDE.bounds.x).toBe(LAYOUT.habitat[0]);
      // the game's rooms are the complex's (real size: the Rig's eye height and walker scale rely on ROOM_K = 1)
      const rooms = await import('./rooms');
      const hab = await import('./habitatRoom');
      expect(hab.ROOM_K).toBe(1);
      expect(rooms.ROOM_IDS).toEqual(expect.arrayContaining(['greenhouse_up', 'lab_up']));
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});

describe('the arrival preview (`?arrive`) on the HDU base', () => {
  it('stands its camera on free ground beside the parked rover', async () => {
    const { arrivalCameraSpot } = await import('../scene/arrival');
    const p = arrivalCameraSpot({ x: 0, z: 0 }, HDU_PLAN.PARKED_ROVER);
    expect(fits(p.x, p.z, W, 0.5)).toBe(true);
  });
});

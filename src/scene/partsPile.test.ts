import { describe, expect, it } from 'vitest';
import { ASTRA_PLAN, HDU_PLAN } from './layout';
import { makePoints, MARKERS } from './points';
import { BAGS, PALLET, PIECES, bagsFor, partsHitbox, partsSpot, popScale } from './partsPile';
import { clearance, fits, type Solid } from '../walk/collide';
import { makeOutside } from '../walk/world';
import { makeRooms } from '../walk/rooms';

describe('the parts pile: one bag per sixth of Ship %', () => {
  it('shows 0 bags below a sixth and all six at 100 %', () => {
    const table: [number, number][] = [
      [0, 0], [16, 0], [17, 1], [33, 1], [34, 2], [43, 2], [50, 3], [66, 3], [67, 4], [83, 4], [84, 5], [86, 5], [99, 5], [100, 6],
    ];
    for (const [ship, bags] of table) expect(bagsFor(ship), `${ship} %`).toBe(bags);
  });

  it('never shows fewer bags for more ship, never more than six, and nothing for a broken number', () => {
    let last = 0;
    for (let s = 0; s <= 100; s++) {
      expect(bagsFor(s)).toBeGreaterThanOrEqual(last);
      last = bagsFor(s);
    }
    expect(bagsFor(140)).toBe(BAGS);
    expect(bagsFor(-5)).toBe(0);
    expect(bagsFor(Number.NaN)).toBe(0);
  });

  it('has a pallet and six bags, every bag on the pallet', () => {
    expect(PIECES).toHaveLength(1 + BAGS);
    expect(PIECES[0].finish).toBe('pallet');
    for (const p of PIECES.slice(1)) {
      expect(Math.abs(p.at[0]) + p.size[0] / 2, 'across').toBeLessThanOrEqual(PALLET.w / 2);
      expect(Math.abs(p.at[2]) + p.size[2] / 2, 'deep').toBeLessThanOrEqual(PALLET.d / 2);
      expect(p.at[1] - p.size[1] / 2, 'on the pallet or a bag').toBeGreaterThanOrEqual(PALLET.h - 1e-9);
    }
    // white, grey and gold, like the base
    expect(new Set(PIECES.slice(1).map((p) => p.finish))).toEqual(new Set(['white', 'grey', 'gold']));
  });

  it('pops a new bag in softly: from nothing to its size, a small overshoot, no flash (scale only)', () => {
    expect(popScale(0)).toBe(0);
    expect(popScale(1)).toBe(1);
    let peak = 0;
    for (let t = 0; t <= 1; t += 0.01) peak = Math.max(peak, popScale(t));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.08);
  });
});

/** Closest distance between two hitboxes' middle lines minus both radii (as hduWorld.test.ts). */
function gap(a: Solid, b: Solid): number {
  const core = (s: Solid, x: number, z: number) => clearance(s, x, z, 0) + s.r;
  const d = Math.min(core(b, a.x, a.z), core(b, a.bx ?? a.x, a.bz ?? a.z), core(a, b.x, b.z), core(a, b.bx ?? b.x, b.bz ?? b.z));
  return d - a.r - b.r;
}

describe('the parts pile stands beside the lander, clear of the walk', () => {
  for (const plan of [ASTRA_PLAN, HDU_PLAN]) {
    const name = plan.hdu ? 'HDU plan' : 'ASTRA plan';
    const out = makeOutside(plan.hdu);
    const pile = out.solids.find((s) => s.name === 'parts')!;
    const { POINTS } = makePoints(plan.hdu);
    const lander = makeRooms(plan.hdu).lander;

    it(`${name}: is a hitbox of the base, the pallet inside it`, () => {
      expect(pile).toEqual(partsHitbox(plan));
      const { x, z, yaw } = partsSpot(plan);
      // the pallet's four corners are inside the hitbox
      for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const lx = (cx * PALLET.w) / 2, lz = (cz * PALLET.d) / 2;
        const px = x + lx * Math.cos(yaw) + lz * Math.sin(yaw);
        const pz = z - lx * Math.sin(yaw) + lz * Math.cos(yaw);
        expect(clearance(pile, px, pz, 0)).toBeLessThan(0);
      }
    });

    it(`${name}: beside the lander, 2 m of walkway to it and to everything else on the pad`, () => {
      const [lx, lz] = plan.LAYOUT.lander;
      expect(Math.hypot(pile.x - lx, pile.z - lz)).toBeLessThan(7);
      for (const s of out.solids) {
        if (s === pile || s.name === 'rock' || s.name === 'ice drill' || s.name === 'rassor') continue;
        expect(gap(pile, s), `parts vs ${s.name}`).toBeGreaterThanOrEqual(2);
      }
      // on the flat pad (r 22) with half a metre to spare
      for (const [x, z] of [[pile.x, pile.z], [pile.bx!, pile.bz!]]) expect(Math.hypot(x, z) + pile.r).toBeLessThanOrEqual(21.5);
    });

    it(`${name}: off the ladder, the lander's hatch and every standing point`, () => {
      const [ladx, , ladz] = POINTS.ladder.pos;
      expect(clearance(pile, ladx, ladz, 0)).toBeGreaterThan(2);
      expect(clearance(pile, lander.out.x, lander.out.z, 0)).toBeGreaterThan(2);
      for (const id of MARKERS) {
        const [x, , z] = POINTS[id].pos;
        expect(fits(x, z, out), id).toBe(true);
        expect(clearance(pile, x, z, 0), id).toBeGreaterThan(1);
      }
    });
  }
});

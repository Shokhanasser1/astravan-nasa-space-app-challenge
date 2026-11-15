/**
 * The ship's parts pile (home story, Shoxjahon aka's document 15 Nov, p. 12: "beside the ship a pile of the parts
 * brought grows, one cargo bag per 1/6"). Pure numbers for src/scene/ShipParts.tsx and its hitbox
 * (src/walk/world.ts): how many bags a Ship % shows, where the pile stands on either base plan, and its pieces.
 * Ship % itself comes from the View (View.res.ship, the engine's science under a new name); nothing here is a game
 * number.
 */
import type { BasePlan } from './layout';

/** Bags in a full pile: one per sixth of the ship's repair. */
export const BAGS = 6;

/** Bags shown for a Ship % (0–100): one per whole sixth, 0…6. */
export function bagsFor(ship: number): number {
  if (!Number.isFinite(ship)) return 0;
  return Math.max(0, Math.min(BAGS, Math.floor((Math.min(100, ship) * BAGS) / 100 + 1e-9)));
}

/**
 * Where the pile stands round the lander: `ang` degrees round from the lander's side that faces the base (its ladder
 * and its hatch; negative = to the left seen from the base) at `d` metres from its middle. ASTRA: the open ground
 * toward the hill. HDU (`?hdu`): clear of the parked crew rover and the dish, inside the flat pad.
 */
const SPOT = { astra: { ang: -75, d: 5.8 }, hdu: { ang: -60, d: 5.8 } } as const;

/** The pallet under the bags (m): long side across, short side toward the base. */
export const PALLET = { w: 2.1, h: 0.14, d: 1.35 } as const;

/** The pile's place on a plan: its middle on the ground, and its turn (three.js rotation-y: its front faces the habitat). */
export function partsSpot(plan: BasePlan): { x: number; z: number; yaw: number } {
  const { LAYOUT } = plan;
  const [lx, lz] = LAYOUT.lander;
  const s = plan.hdu ? SPOT.hdu : SPOT.astra;
  const toBase = Math.atan2(LAYOUT.habitat[0] - lx, LAYOUT.habitat[1] - lz);
  const a = toBase + (s.ang * Math.PI) / 180;
  const x = lx + Math.sin(a) * s.d;
  const z = lz + Math.cos(a) * s.d;
  return { x, z, yaw: Math.atan2(LAYOUT.habitat[0] - x, LAYOUT.habitat[1] - z) };
}

/**
 * The pile's hitbox: a bar along the pallet's long side, round enough to cover the pallet and the bags on it (they
 * never reach past it), + 0.1 m like every hitbox. Standing next to it, nobody walks through the bags.
 */
export function partsHitbox(plan: BasePlan): { name: string; x: number; z: number; bx: number; bz: number; r: number } {
  const { x, z, yaw } = partsSpot(plan);
  // a capsule through the pallet's four corners: radius a little over half its depth, the bar as long as that allows
  const core = PALLET.d / 2 + 0.075;
  const half = PALLET.w / 2 - Math.sqrt(core * core - (PALLET.d / 2) ** 2);
  // the long side runs across the front: local x, turned by yaw (three.js: local x → (cos yaw, −sin yaw))
  const ax = Math.cos(yaw) * half, az = -Math.sin(yaw) * half;
  return { name: 'parts', x: x - ax, z: z - az, bx: x + ax, bz: z + az, r: core + 0.1 };
}

export type Finish = 'white' | 'grey' | 'gold';

/**
 * The pieces in the pile's own frame (x across, y up from the ground, z toward the base), in the order the bags
 * arrive: the pallet first (always there), then a row of three at the back, two on them, one on top. Soft cargo
 * bags like the station's (white and light grey Nomex), the odd one wrapped in gold foil. Sizes w × h × d, m.
 */
export const PIECES: readonly { at: readonly [number, number, number]; size: readonly [number, number, number]; turn: number; finish: Finish | 'pallet' }[] = [
  { at: [0, PALLET.h / 2, 0], size: [PALLET.w, PALLET.h, PALLET.d], turn: 0, finish: 'pallet' },
  { at: [-0.64, PALLET.h + 0.21, -0.22], size: [0.6, 0.42, 0.5], turn: 0.06, finish: 'white' },
  { at: [0.02, PALLET.h + 0.23, -0.2], size: [0.62, 0.46, 0.52], turn: -0.04, finish: 'grey' },
  { at: [0.66, PALLET.h + 0.2, -0.24], size: [0.56, 0.4, 0.48], turn: 0.1, finish: 'white' },
  { at: [-0.3, PALLET.h + 0.44 + 0.19, -0.2], size: [0.58, 0.38, 0.46], turn: -0.12, finish: 'gold' },
  { at: [0.36, PALLET.h + 0.44 + 0.18, -0.18], size: [0.54, 0.36, 0.46], turn: 0.08, finish: 'white' },
  { at: [0.04, PALLET.h + 0.82 + 0.16, -0.16], size: [0.5, 0.32, 0.42], turn: 0.18, finish: 'grey' },
];

/** The pop of a new bag, 0…1 over POP_S seconds → its scale: a soft overshoot (~5 %), no flash. */
export const POP_S = 0.55;
export function popScale(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c = 1.2; // easeOutBack with a small back: peaks ~1.05 at t ≈ 0.64
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

/**
 * The rocks on the ground as the walk and the rover feel them (15 Nov): the same rocks the terrain draws
 * (src/look/rocks.js planRocks, same options as src/scene/Terrain.tsx for this device's tier). A rock low enough to
 * go over becomes part of the ground — a dome as high as the rock — so the astronaut steps up onto it and the rover's
 * wheels climb it and tilt the rover; a taller rock is a hitbox that stops you (you slide along it).
 * The astronaut steps over 0.35 m (physics.js MOVE.stepUp); the rover's wheels climb 0.6 m.
 */
import { GROUND, groundHeight } from '../scene/ground';
import { initialTier } from '../scene/quality';
import { planRocks } from '../look/rocks.js';
import type { Solid } from './collide';

/** The terrain's rock options (src/scene/Terrain.tsx); keep the two in step. */
export function rockOptions(pc: boolean) {
  return { big: pc ? 40 : 24, boulders: pc ? 180 : 100, pebbles: pc ? 500 : 250, bigMin: 30 };
}

export const STEP_FOOT = 0.35;
export const STEP_WHEEL = 0.6;

interface Rock {
  x: number;
  z: number;
  /** Radius at the ground and height above it (m). */
  r: number;
  h: number;
}

const plan = planRocks(GROUND, rockOptions(initialTier() === 'pc'));
const ROCKS: Rock[] = [...plan.big, ...plan.mid].map((k: { x: number; z: number; sx: number; sz: number; top: number }) => ({
  x: k.x,
  z: k.z,
  // a squashed ball cut by the ground: about 0.9 of its half-width at ground level
  r: 0.9 * Math.max(k.sx, k.sz),
  h: k.top,
}));

/** Rocks in 4 m cells, so a height query looks at a handful, not all of them. */
const CELL = 4;
const grid = new Map<number, Rock[]>();
const key = (i: number, j: number) => (i + 512) * 1024 + (j + 512);
for (const k of ROCKS) {
  const i0 = Math.floor((k.x - k.r) / CELL), i1 = Math.floor((k.x + k.r) / CELL);
  const j0 = Math.floor((k.z - k.r) / CELL), j1 = Math.floor((k.z + k.r) / CELL);
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      const c = grid.get(key(i, j));
      if (c) c.push(k);
      else grid.set(key(i, j), [k]);
    }
}

/** How high the rocks lower than `step` lift the ground at (x, z) (0 off them). */
function bump(x: number, z: number, step: number): number {
  const c = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
  if (!c) return 0;
  let top = 0;
  for (const k of c) {
    if (k.h > step) continue;
    const d2 = ((x - k.x) ** 2 + (z - k.z) ** 2) / (k.r * k.r);
    if (d2 < 1) top = Math.max(top, k.h * Math.sqrt(1 - d2));
  }
  return top;
}

/** The ground the astronaut walks on: the terrain and the rocks it can step onto. */
export const footGround = (x: number, z: number) => groundHeight(x, z) + bump(x, z, STEP_FOOT);
/** The ground under the rover's wheels: the terrain and the rocks it can climb. */
export const wheelGround = (x: number, z: number) => groundHeight(x, z) + bump(x, z, STEP_WHEEL);

/** Hitboxes of the rocks taller than `step` (a disc a little inside the rock: you brush its side). */
export function rockSolids(step: number, within: number): Solid[] {
  return ROCKS.filter((k) => k.h > step && Math.hypot(k.x, k.z) < within + k.r).map((k) => ({ name: 'rock', x: k.x, z: k.z, r: 0.85 * k.r }));
}

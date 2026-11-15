/**
 * Ground height (developer guide §04, now on the real ground): NASA LRO LOLA heights of the Shackleton–de Gerlache
 * ridge (public/data/terrain/site.json, scripts/data/moon_terrain.py) + small craters (src/look/terrain.js) + the
 * team's own relief on top: the hill with a view over the base (standing point 5) and the dark crater of the Ice
 * card. Flat for 22 m around the base. Pure function: the rig uses it to put the eye 1.7 m above the ground.
 */
import site from '../../public/data/terrain/site.json';
import { Heights } from '../look/terrain.js';

// 22 m: the whole base is flat (spread on 15 Nov when the buildings grew to real size), the solar arrays (~21 m out),
// the parked rover and the lander's legs included.
const FLAT_R = 22;
const FLAT_BLEND = 10;

export const ICE_CRATER = { x: -34, z: -84 } as const;
// (beyond the pad's blend, FLAT_R + FLAT_BLEND, or the pad would flatten it)
export const HILL = { x: 22, z: 28, r: 8, h: 3.2 } as const;
const ICE = { r: 26, d: 5 };

/** The team's relief (metres) added on top of the real ground. */
function teamRelief(x: number, z: number): number {
  const d = Math.hypot(x - ICE_CRATER.x, z - ICE_CRATER.z) / ICE.r;
  let h = d < 1 ? -ICE.d * (1 - d * d) : 0;
  h += 0.3 * ICE.d * Math.exp(-(((d - 1) / 0.3) ** 2));
  h += HILL.h * Math.exp(-((x - HILL.x) ** 2 + (z - HILL.z) ** 2) / (HILL.r * HILL.r));
  return h;
}

/**
 * The game's frame: Sun azimuth a (src/engine/sky.json, measured from lunar longitude 0, the way to Earth) points
 * to (sin a, cos a) in x, z — the polar map's own axes (x = ρ sin λ, y = ρ cos λ). site.json is stored turned for
 * the 3D demo's sky (frame.rotation_deg), so a game point (x, z) = map (x, y) is turned the same way to look it up.
 */
const phi = (site.frame.rotation_deg * Math.PI) / 180;
const FRAME: [number, number, number, number] = [Math.cos(phi), -Math.sin(phi), -Math.sin(phi), -Math.cos(phi)];

export const GROUND = new Heights(site, 2026, {
  pad: { x: 0, z: 0, rx: FLAT_R, rz: FLAT_R, blend: FLAT_BLEND },
  extra: teamRelief,
  frame: FRAME,
  color: '#a3a5ad',
});

export function groundHeight(x: number, z: number): number {
  return GROUND.height(x, z);
}

/**
 * The HDU outpost (15 Nov, Samandar's proposal, behind `features.outpost` / `?outpost`): three NASA Habitat
 * Demonstration Unit modules joined by pressurised tunnels, 50 m north of the base — somewhere to drive the crew
 * rover to (public/models/nasa-outpost, made in Blender: blender sources in the team's oy-karvonsaroyi-3d/hb7/hdu_base).
 * Exterior only for now; the furnished interiors are in the Blender file.
 *
 * Pure: positions, each module's ground height and the hitboxes, from the same numbers the scene draws with.
 * Model frame (glTF): the modules stand along local z (B lab at −13, A habitat at 0, C greenhouse at +13).
 */
import { features } from '../config/features';
import { groundHeight } from './ground';
import type { Solid } from '../walk/collide';

const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const OUTPOST_ON = features.outpost || q.has('outpost');

/** Where it stands: 50 m out, where the ground under every module is nearly level (≤ 0.17 m across each; a probe over
 * radii 45–85 m and 12 headings, clear of the hill and the ice crater), the modules along the game's z. */
export const OUTPOST = { x: -8.7, z: 49.2, yaw: 0 } as const;

/** Node name prefix in the GLB → the module's place along local z. */
export const MODULES = { A_habitat: 0, B_lab: -13, C_greenhouse: 13 } as const;
export type ModuleName = keyof typeof MODULES;
/** Tunnel node in the GLB → the two modules it joins (it sits halfway between their heights). */
export const TUNNELS: Record<string, [ModuleName, ModuleName]> = {
  tunnel_A_B: ['A_habitat', 'B_lab'],
  tunnel_C_A: ['C_greenhouse', 'A_habitat'],
};

/** Local (x, z) of the model → the game's (x, z), as three.js turns a group by rotation-y = yaw. */
export function toWorld(lx: number, lz: number): [number, number] {
  const c = Math.cos(OUTPOST.yaw), s = Math.sin(OUTPOST.yaw);
  return [OUTPOST.x + lx * c + lz * s, OUTPOST.z - lx * s + lz * c];
}

/** Each module on the ground under its own centre (the ground is not quite level over 40 m). */
export function moduleY(name: ModuleName): number {
  const [x, z] = toWorld(0, MODULES[name]);
  return groundHeight(x, z);
}

/** Shell 2.1 m + the eight fins (to ~3.4 m) and the airlock: one disc each. */
const MODULE_R = 3.6;
/** The side module along local +x to 6.0 m, radius 1.1 m. */
const SIDE = { to: 6.0, r: 1.2 };
/** Tunnels between the module centres, radius 1.1 m. */
const TUNNEL_R = 1.25;

/** Hitboxes for the walk and the rover (src/walk/world.ts adds them while the outpost is on). */
export function outpostSolids(): Solid[] {
  const out: Solid[] = [];
  for (const [name, lz] of Object.entries(MODULES)) {
    const [x, z] = toWorld(0, lz);
    const [bx, bz] = toWorld(SIDE.to, lz);
    out.push({ name: `outpost ${name}`, x, z, r: MODULE_R });
    out.push({ name: `outpost ${name} side`, x, z, bx, bz, r: SIDE.r });
  }
  for (const [a, b] of [[MODULES.A_habitat, MODULES.B_lab], [MODULES.C_greenhouse, MODULES.A_habitat]] as const) {
    const [x, z] = toWorld(0, a);
    const [bx, bz] = toWorld(0, b);
    out.push({ name: 'outpost tunnel', x, z, bx, bz, r: TUNNEL_R });
  }
  return out;
}

/**
 * Walking inside the habitat's furnished interior (src/scene/Interiors.tsx). The room is drawn at the ASTRA shell's
 * scale (ASTRA_SCALE.habitat), so the walker walks at that scale too: its body and pace are scaled by ROOM_K, and the room looks and
 * feels full size. Hitboxes: the ground-floor footprints the Blender build wrote (blender/interiors/habitat/walk.json:
 * [name, x, z, hx, hz, yaw], model frame, native metres) — each box becomes a bar along its long side — and the
 * lining as the bounds.
 */
import { ASTRA_SCALE, DOOR_AZ, HDU, HDU_HABITAT, LAYOUT } from '../scene/layout';
import type { Area, Solid } from './collide';
import astraBoxes from './habitatRoom.json';
import hduBoxes from './rooms_hdu.json';
import { shown } from './rooms';

/** The habitat's ASTRA scale (layout.ts ASTRA_SCALE.habitat): the room, the walker's body and pace. */
export const ROOM_K: number = ASTRA_SCALE.habitat;
/** The lining's radius (4.92 m; the HDU habitat's 2.925 m) less a little: where the walker can stand. */
const LINING = HDU_HABITAT ? HDU.lining - 0.05 : 4.85;
/** The ground floor's hitboxes (the HDU habitat's from its own Blender build). */
const boxes = HDU_HABITAT ? hduBoxes.habitat : astraBoxes;

const c = Math.cos(DOOR_AZ);
const s = Math.sin(DOOR_AZ);
/** Model frame (front +z = the door) → the game (three.js rotation-y = DOOR_AZ, then scale, then the habitat's place). */
const toGame = (x: number, z: number): [number, number] => [
  LAYOUT.habitat[0] + (x * c + z * s) * ROOM_K,
  LAYOUT.habitat[1] + (-x * s + z * c) * ROOM_K,
];

function bar([name, x, z, hx, hz, yaw]: (string | number)[]): Solid {
  const [X, Z, HX, HZ, Y] = [x, z, hx, hz, yaw] as number[];
  // the box's long side, in the model frame (three.js: local x → (cos yaw, −sin yaw), local z → (sin yaw, cos yaw))
  const alongX = HX >= HZ;
  const r = Math.min(HX, HZ);
  const half = Math.max(HX, HZ) - r;
  const dx = alongX ? Math.cos(Y) : Math.sin(Y);
  const dz = alongX ? -Math.sin(Y) : Math.cos(Y);
  const [ax, az] = toGame(X - dx * half, Z - dz * half);
  const [bx, bz] = toGame(X + dx * half, Z + dz * half);
  return { name: String(name), x: ax, z: az, bx, bz, r: r * ROOM_K };
}

/** The habitat's ground floor, in game metres. */
export const HAB_ROOM: Area = {
  solids: (boxes as (string | number)[][]).filter(shown).map(bar),
  bounds: { name: 'lining', x: LAYOUT.habitat[0], z: LAYOUT.habitat[1], r: LINING * ROOM_K },
};

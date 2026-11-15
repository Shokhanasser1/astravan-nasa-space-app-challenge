/**
 * Walking inside the habitat's furnished interior (src/scene/Interiors.tsx). The room is drawn at the ASTRA shell's
 * scale (ASTRA_SCALE.habitat), so the walker walks at that scale too: its body and pace are scaled by ROOM_K, and the room looks and
 * feels full size. Hitboxes: the ground-floor footprints the Blender build wrote (blender/interiors/habitat/walk.json:
 * [name, x, z, hx, hz, yaw], model frame, native metres) — each box becomes a bar along its long side — and the
 * lining as the bounds.
 */
import { ASTRA_SCALE, HDU, HDU_HABITAT, basePlan } from '../scene/layout';
import type { Area, Solid } from './collide';
import astraBoxes from './habitatRoom.json';
import hduBoxes from './rooms_hdu.json';
import { shown } from './rooms';

/** The habitat's ASTRA scale (layout.ts ASTRA_SCALE.habitat; 1 for the HDU habitat): the room, the walker's body and pace. */
export const ROOM_K: number = ASTRA_SCALE.habitat;

/**
 * The habitat's ground floor, in game metres: ASTRA's (lining 4.92 m less a little, at its scale) or (hdu) the HDU
 * complex's habitat module at real size (k 1, HDU.lining less a little, its own Blender build's `habitat` boxes),
 * on that base's plan (layout.ts basePlan). Exported for the tests of both.
 */
export function makeHabRoom(hdu: boolean): Area {
  const { LAYOUT, DOOR_AZ } = basePlan(hdu);
  const k = hdu ? 1 : ROOM_K;
  const lining = hdu ? HDU.lining - 0.05 : 4.85;
  const boxes = hdu ? hduBoxes.habitat : astraBoxes;
  const c = Math.cos(DOOR_AZ);
  const s = Math.sin(DOOR_AZ);
  /** Model frame (front +z = the door) → the game (three.js rotation-y = DOOR_AZ, then scale, then the habitat's place). */
  const toGame = (x: number, z: number): [number, number] => [
    LAYOUT.habitat[0] + (x * c + z * s) * k,
    LAYOUT.habitat[1] + (-x * s + z * c) * k,
  ];
  const bar = ([name, x, z, hx, hz, yaw]: (string | number)[]): Solid => {
    const [X, Z, HX, HZ, Y] = [x, z, hx, hz, yaw] as number[];
    // the box's long side, in the model frame (three.js: local x → (cos yaw, −sin yaw), local z → (sin yaw, cos yaw))
    const alongX = HX >= HZ;
    const r = Math.min(HX, HZ);
    const half = Math.max(HX, HZ) - r;
    const dx = alongX ? Math.cos(Y) : Math.sin(Y);
    const dz = alongX ? -Math.sin(Y) : Math.cos(Y);
    const [ax, az] = toGame(X - dx * half, Z - dz * half);
    const [bx, bz] = toGame(X + dx * half, Z + dz * half);
    return { name: String(name), x: ax, z: az, bx, bz, r: r * k };
  };
  return {
    solids: (boxes as (string | number)[][]).filter(shown).map(bar),
    bounds: { name: 'lining', x: LAYOUT.habitat[0], z: LAYOUT.habitat[1], r: lining * k },
  };
}

/** The habitat's ground floor the game walks (the flag's: layout.ts HDU_HABITAT). */
export const HAB_ROOM: Area = makeHabRoom(HDU_HABITAT);

/**
 * Walking and running inside the buildings with the astronaut (third person). Each building's furnished interior
 * (src/scene/Interiors.tsx) is drawn at its ASTRA shell's scale `k`, so inside it the astronaut, its pace, its
 * jump, its gravity and the follow camera are scaled by `s` = k × fit too: a picture is the same at any scale, so
 * the room looks full size. `fit` shrinks the astronaut where a room is lower than a suited adult (the greenhouse
 * arch is 1.46 m, the workshop 1.6 m: a child-sized astronaut, the game is for 7–12 year olds).
 *
 * Numbers in each building's model frame, native metres (hb7/interiors/<b>/HANDOFF.md, walk.json): the floor, the
 * headroom, where E outside goes in (`out`, also where the astronaut comes back out), where it stands inside
 * (`spawn`), and where E inside goes out (`exit`). Facing: 0 = model +z.
 */
import { DOOR_AZ, LAYOUT, ASTRA_SCALE } from '../scene/layout';
import type { Area, Solid, XZ } from './collide';
import ROOM_BOXES from './rooms.json';

export type RoomId = 'habitat' | 'habitat_up' | 'greenhouse' | 'lab' | 'lander';

type Box = (string | number)[];
interface Spec {
  at: readonly [number, number];
  turn: number;
  k: number;
  floor: number;
  headroom: number;
  bounds: number;
  extra?: Box[];
  spawn: [number, number, number];
  out: [number, number, number];
  exit: (x: number, z: number) => boolean;
  jump: boolean;
  /** No door of its own (an upper floor): reached by the ladder; a phase change takes you out by the main door. */
  noDoor?: boolean;
  /** The ladder to another floor: E within `reach` of `at` (model x, z) climbs, arriving at `arrive` there. */
  ladder?: { to: RoomId; at: [number, number]; reach: number; arrive: [number, number, number] };
}

/** A model's front (+z) faces the middle of the base (AstraBase.tsx faceCentre). */
const faceCentre = (p: readonly [number, number]) => Math.atan2(-p[0], -p[1]);
const ADULT = 1.8;

const SPECS: Record<RoomId, Spec> = {
  // ground floor (deck 0.5, ceiling 3.1); the door is the airlock at +z; jumps allowed (2.6 m of headroom)
  habitat: {
    at: LAYOUT.habitat, turn: DOOR_AZ, k: ASTRA_SCALE.habitat, floor: 0.5, headroom: 2.6, bounds: 4.85,
    spawn: [0, 2.45, Math.PI], out: [0, 8.0, 0], exit: (x, z) => z > 2.25 && Math.abs(x) < 0.7, jump: true,
    // the ladder in the storm shelter, up through the deck opening into the command room
    ladder: { to: 'habitat_up', at: [0, 0.4], reach: 0.9, arrive: [1.15, 0.45, 0] },
  },
  // upper floor (deck 3.35, ceiling 5.95): command room, crew quarters, medical corner, stowage
  habitat_up: {
    at: LAYOUT.habitat, turn: DOOR_AZ, k: ASTRA_SCALE.habitat, floor: 3.35, headroom: 2.6, bounds: 4.85,
    spawn: [1.15, 0.45, 0], out: [0, 8.0, 0], exit: () => false, jump: true, noDoor: true,
    ladder: { to: 'habitat', at: [0, 0.62], reach: 1.6, arrive: [0, 0.75, 0] },
  },
  // the walkway between the two grow racks; the door at the east end (+x), closed behind
  greenhouse: {
    at: LAYOUT.garden, turn: faceCentre(LAYOUT.garden), k: ASTRA_SCALE.greenhouse, floor: 0.232, headroom: 1.46, bounds: 2.3,
    extra: [['door', 2.25, 0, 0.03, 0.5, 0]],
    spawn: [1.7, 0, -Math.PI / 2], out: [4.2, 0, Math.PI / 2], exit: (x) => x > 1.45, jump: false,
  },
  // the aisle between the benches; the round hatch at the west end (−x)
  lab: {
    at: LAYOUT.workshop, turn: faceCentre(LAYOUT.workshop), k: ASTRA_SCALE.lab, floor: 0.6, headroom: 1.6, bounds: 1.75,
    spawn: [-1.3, 0, Math.PI / 2], out: [-3.4, 0, -Math.PI / 2], exit: (x) => x < -0.95, jump: false,
  },
  // the ascent cabin (floor 3.0 m up, by the ladder); the forward hatch at +z, closed behind
  lander: {
    at: LAYOUT.lander, turn: faceCentre(LAYOUT.lander), k: ASTRA_SCALE.lander, floor: 3.0, headroom: 1.78, bounds: 1.25,
    extra: [['hatch', 0, 1.2, 0.38, 0.03, 0]],
    spawn: [0, 0.55, Math.PI], out: [0, 4.9, 0], exit: (_x, z) => z > 0.5, jump: false,
  },
};

export interface Room {
  id: RoomId;
  /** The astronaut's scale inside (body, pace, jump, gravity, camera). */
  s: number;
  area: Area;
  /** Floor and ceiling heights in the game (m). */
  floorY: number;
  ceilY: number;
  jump: boolean;
  spawn: { x: number; z: number; facing: number };
  out: { x: number; z: number; facing: number };
  /** True where E inside goes out (game x, z). */
  exit: (x: number, z: number) => boolean;
  noDoor: boolean;
  /** The ladder: where it leads, whether (x, z) is close enough to climb, where you arrive. */
  ladder: { to: RoomId; near: (x: number, z: number) => boolean; arrive: { x: number; z: number; facing: number } } | null;
}

function build(id: RoomId): Room {
  const p = SPECS[id];
  const c = Math.cos(p.turn), sn = Math.sin(p.turn);
  // model (x, z) → game: three.js rotation-y = turn, then scale k, then the building's place
  const toGame = (x: number, z: number): [number, number] => [p.at[0] + (x * c + z * sn) * p.k, p.at[1] + (-x * sn + z * c) * p.k];
  const toModel = (x: number, z: number): [number, number] => {
    const dx = (x - p.at[0]) / p.k, dz = (z - p.at[1]) / p.k;
    return [dx * c - dz * sn, dx * sn + dz * c];
  };
  const bar = ([name, X, Z, HX, HZ, Y]: Box): Solid => {
    const [x, z, hx, hz, yaw] = [X, Z, HX, HZ, Y] as number[];
    const alongX = hx >= hz;
    const r = Math.min(hx, hz);
    const half = Math.max(hx, hz) - r;
    // three.js: local x → (cos yaw, −sin yaw), local z → (sin yaw, cos yaw)
    const dx = alongX ? Math.cos(yaw) : Math.sin(yaw);
    const dz = alongX ? -Math.sin(yaw) : Math.cos(yaw);
    const [ax, az] = toGame(x - dx * half, z - dz * half);
    const [bx, bz] = toGame(x + dx * half, z + dz * half);
    return { name: String(name), x: ax, z: az, bx, bz, r: r * p.k };
  };
  const boxes = [...(ROOM_BOXES as Record<RoomId, Box[]>)[id], ...(p.extra ?? [])];
  const fit = Math.min(1, (p.headroom - 0.1) / ADULT);
  const at = (m: [number, number, number]) => {
    const [x, z] = toGame(m[0], m[1]);
    return { x, z, facing: m[2] + p.turn };
  };
  return {
    id,
    s: p.k * fit,
    area: { solids: boxes.map(bar), bounds: { name: id, x: p.at[0], z: p.at[1], r: p.bounds * p.k } },
    floorY: p.floor * p.k,
    ceilY: (p.floor + p.headroom) * p.k,
    jump: p.jump,
    spawn: at(p.spawn),
    out: at(p.out),
    exit: (x, z) => {
      const [mx, mz] = toModel(x, z);
      return p.exit(mx, mz);
    },
    noDoor: Boolean(p.noDoor),
    ladder: p.ladder
      ? {
          to: p.ladder.to,
          near: (x, z) => {
            const [mx, mz] = toModel(x, z);
            return Math.hypot(mx - p.ladder!.at[0], mz - p.ladder!.at[1]) < p.ladder!.reach;
          },
          arrive: at(p.ladder.arrive),
        }
      : null,
  };
}

export const ROOMS: Record<RoomId, Room> = {
  habitat: build('habitat'),
  habitat_up: build('habitat_up'),
  greenhouse: build('greenhouse'),
  lab: build('lab'),
  lander: build('lander'),
};
export const ROOM_IDS = Object.keys(ROOMS) as RoomId[];

/** The building a room belongs to (its interior model and its door). */
export const buildingOf = (id: RoomId): Exclude<RoomId, 'habitat_up'> => (id === 'habitat_up' ? 'habitat' : id);

/** The room the astronaut walks in now (null: outside). Written by the Rig, read by Interiors and Astronaut. */
export const roomState = { id: null as RoomId | null };

/** The body's radius indoors (native m): a person's shoulders, so the rooms' doorways and the ladder's rail let it by. */
export const ROOM_BODY = 0.25;

/** E reaches a door from this far (m, in the game) from its `out` spot. */
export const DOOR_REACH = 1.3;

/** The room whose door the astronaut stands at, outside (null: none). */
export function doorAt(p: XZ): RoomId | null {
  for (const id of ROOM_IDS) {
    if (ROOMS[id].noDoor) continue;
    const o = ROOMS[id].out;
    if (Math.hypot(p.x - o.x, p.z - o.z) < DOOR_REACH) return id;
  }
  return null;
}

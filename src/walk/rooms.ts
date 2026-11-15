/**
 * Walking and running inside the buildings with the astronaut (third person). Each building's furnished interior
 * (src/scene/Interiors.tsx) is drawn at its ASTRA shell's scale `k`, so inside it the astronaut, its pace, its
 * jump, its gravity and the follow camera are scaled by `s` = k × fit too: a picture is the same at any scale, so
 * the room looks full size. `fit` shrinks the astronaut where a room is lower than a suited adult (the greenhouse
 * arch is 1.46 m, the workshop 1.6 m: a child-sized astronaut, the game is for 7–12 year olds).
 *
 * Numbers in each building's model frame, native metres (blender/interiors/<b>/HANDOFF.md, walk.json): the floor, the
 * headroom, where E outside goes in (`out`, also where the astronaut comes back out), where it stands inside
 * (`spawn`), and where E inside goes out (`exit`). Facing: 0 = model +z.
 *
 * `?hdu` (layout.ts HDU_HABITAT): the base core is NASA's HDU complex instead, three walk-in modules at real size
 * (k 1), two floors each with a ladder between (hduSpecs below); ASTRA's lander stays.
 */
import {
  ASTRA_SCALE,
  HDU,
  HDU_COMPLEX,
  HDU_HABITAT,
  HDU_MODULES,
  HDU_MODULE_X,
  basePlan,
  moduleToGame,
  type BasePlan,
  type HduModule,
} from '../scene/layout';
import type { Area, Solid, XZ } from './collide';
import ROOM_BOXES from './rooms.json';
import ROOM_BOXES_HDU from './rooms_hdu.json';

/** The rooms both bases have (ASTRA: the habitat's two floors, the greenhouse, the lab, the lander cabin). */
type CoreRoomId = 'habitat' | 'habitat_up' | 'greenhouse' | 'lab' | 'lander';
/** The rooms only the HDU complex (`?hdu`) has: the greenhouse module's and the lab module's lofts. */
type HduRoomId = 'greenhouse_up' | 'lab_up';
export type RoomId = CoreRoomId | HduRoomId;
/** The building a room belongs to: its interior model and its door (an upper floor belongs to its module). */
export type BuildingId = Exclude<RoomId, `${string}_up`>;

type Box = (string | number)[];

/**
 * Hitboxes of interior parts the game no longer draws: the habitat's storm-shelter ring of water and cargo bags round
 * the ladder (hidden in src/scene/Interiors.tsx HIDDEN_PARTS, Samandar 15 Nov ~09:00). Its bench stays.
 */
const HIDDEN_BOX = /^shelter_wall\./;
export const shown = (b: Box): boolean => !HIDDEN_BOX.test(String(b[0]));
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
  /**
   * The ladder to another floor: E within `reach` of `at` (model x, z) climbs, arriving at `arrive` there.
   */
  ladder?: {
    to: RoomId;
    at: [number, number];
    reach: number;
    arrive: [number, number, number];
    /** A stop (model x, z) on the step from where E was pressed to the foot spot (ladder.ts Spot.via). */
    via?: [number, number];
  };
  /** The ladder's rungs plane (model z; default the ASTRA habitat's 0.212). */
  rungsZ?: number;
}

/** A model's front (+z) faces the middle of the base (AstraBase.tsx faceCentre). */
const faceCentre = (p: readonly [number, number]) => Math.atan2(-p[0], -p[1]);
const ADULT = 1.8;
/**
 * The habitat's ladder (blender/interiors/habitat/build_habitat.py): vertical rails at x ±0.24, rungs every 0.30 m
 * in the plane z = 0.212 (three), up through the deck well (z 0.11–1.13), the same on both floors. On it the
 * Climb clip's origin is on the rungs' plane and the body hangs 0.42 m behind it (clips/climb.py meta
 * body_behind_root): the body steps to `foot` (in the well, facing the rungs, −z), then its origin moves onto
 * `rungs` as the clip fades in, so the body itself stays put.
 */
const RUNGS_Z = 0.212;
/** The body hangs this far behind the rungs on the Climb clip (clips/climb.py meta body_behind_root). */
const BODY_BEHIND = 0.42;

/** ASTRA's rooms on a plan (the ASTRA plan for the ASTRA base; the HDU base keeps only its lander). */
const astraSpecs = ({ LAYOUT, DOOR_AZ }: BasePlan): Record<CoreRoomId, Spec> => ({
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
});

/**
 * The HDU complex (`?hdu`, layout.ts HDU): three modules at real NASA size (r 2.1 m), each walk-in, built alike
 * (oy-karvonsaroyi-3d/hb7/hdu_base/build_game_complex.py, rooms_hdu.json): game metres (k 1), in each module's frame
 * (its centre, the door at +z through the shell, front face HDU.front). Ground floor HDU.floor up: eight sections
 * round an open middle, the entry section with the two EVA suits (±0.62, 1.62) at the door; the loft deck HDU.deck
 * up, its wall to HDU.loftTop, the dome to HDU.top. The ladder at the centre: rungs along x in the plane z = 0 (first
 * rung 0.2825 above the floor, then every 0.30), climbed from the door side (the climber at z 0.42 facing −z); on
 * the loft a rail round its well (well_guard, well_front) opens toward +z, where you step on and off.
 */
const HDU_SITE = { habitat: 'habitat', greenhouse: 'garden', lab: 'workshop' } as const satisfies Record<HduModule, keyof BasePlan['LAYOUT']>;
const HDU_UP = { habitat: 'habitat_up', greenhouse: 'greenhouse_up', lab: 'lab_up' } as const satisfies Record<HduModule, RoomId>;
/**
 * Headroom on both floors: the ground floor's ceiling is the deck's underside (its top less an 8 cm slab), 2.32 m
 * up; the loft's the same 2.32 m, where the dome (5.82 in the middle, 4.75 at the lining) still stands over the
 * farthest the body reaches (r 1.65). A suit (1.86 m) plus a standing Moon jump (1.2²/(2·1.62) = 0.44 m) fit.
 */
const HDU_HEADROOM = HDU.deck - 0.08 - HDU.floor;
/** Inside the lining, less a little. */
const HDU_BOUNDS = HDU.lining - 0.05;
/** E outside: in front of the door, clear of the module's hitbox (disc r 3.3 round (0, −0.3), src/walk/world.ts). */
export const HDU_OUT: [number, number, number] = [0, 4.0, 0];
/** Where you stand on the ground floor at its ladder (arriving down, facing the door) and on the loft (facing +z). */
const HDU_GROUND_ARRIVE: [number, number, number] = [0, 0.75, 0];
const HDU_LOFT_ARRIVE: [number, number, number] = [0, 0.85, 0];

function hduSpecs(plan: BasePlan): Partial<Record<RoomId, Spec>> {
  const out: Partial<Record<RoomId, Spec>> = {};
  for (const m of HDU_MODULES) {
    const at = plan.LAYOUT[HDU_SITE[m]];
    const up = HDU_UP[m];
    // ground floor: in at the door (just inside it, facing in), out by E in the entry section; the ladder from its
    // door side (E within 0.6 m of the climbing spot, not from behind the rungs)
    out[m] = {
      at, turn: HDU_COMPLEX.turn, k: 1, floor: HDU.floor, headroom: HDU_HEADROOM, bounds: HDU_BOUNDS,
      spawn: [0, 1.4, Math.PI], out: HDU_OUT, exit: (x, z) => z > 1.3 && Math.abs(x) < 0.45, jump: true,
      rungsZ: 0, ladder: { to: up, at: [0, 0.42], reach: 0.6, arrive: HDU_LOFT_ARRIVE },
    };
    // the loft: no door of its own; E at the open side of the well climbs back down
    out[up] = {
      at, turn: HDU_COMPLEX.turn, k: 1, floor: HDU.deck, headroom: HDU_HEADROOM, bounds: HDU_BOUNDS,
      // (no jumping on the lofts, D9: like ASTRA's low rooms; a jump by the rail opening would clear the rail)
      spawn: HDU_LOFT_ARRIVE, out: HDU_OUT, exit: () => false, jump: false, noDoor: true,
      // (the step onto the ladder goes through the rail's opening: to (0, 0.85) first, then in to the foot spot, so
      // the body keeps clear of the rail's front posts at (±0.3685, 0.4605); finding #15)
      rungsZ: 0, ladder: { to: m, at: [0, 0.85], reach: 0.7, arrive: HDU_GROUND_ARRIVE, via: [0, 0.85] },
    };
  }
  return out;
}

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
  /**
   * The ladder: where it leads, whether (x, z) is close enough to climb, where you arrive; where the body stands to
   * climb (`foot`, facing the rungs) and the rungs' plane in front of it (`rungs`, the Climb clip's origin).
   */
  ladder: {
    to: RoomId;
    near: (x: number, z: number) => boolean;
    arrive: { x: number; z: number; facing: number };
    foot: { x: number; z: number; facing: number; via?: { x: number; z: number } };
    rungs: { x: number; z: number; facing: number };
  } | null;
}

function build(id: RoomId, p: Spec, roomBoxes: Box[]): Room {
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
  const boxes = [...roomBoxes, ...(p.extra ?? [])].filter(shown);
  const rz = p.rungsZ ?? RUNGS_Z;
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
          foot: {
            ...at([0, rz + BODY_BEHIND, Math.PI]),
            ...(p.ladder.via ? { via: at([p.ladder.via[0], p.ladder.via[1], 0]) } : {}),
          },
          rungs: at([0, rz, Math.PI]),
        }
      : null,
  };
}

/** A base's rooms: ASTRA's five, or the HDU complex's seven (its three modules' two floors and the lander). */
export type Rooms = Readonly<Record<CoreRoomId, Room>> & Readonly<Partial<Record<HduRoomId, Room>>>;
const ASTRA_IDS: readonly CoreRoomId[] = ['habitat', 'habitat_up', 'greenhouse', 'lab', 'lander'];
const HDU_IDS: readonly RoomId[] = ['habitat', 'habitat_up', 'greenhouse', 'greenhouse_up', 'lab', 'lab_up', 'lander'];

/**
 * Every room of the ASTRA base, or (hdu) of the HDU complex: its three modules (two floors each, ladders between)
 * and ASTRA's lander, all on that base's plan (layout.ts basePlan). Exported for the tests of both.
 */
export function makeRooms(hdu: true): Readonly<Record<RoomId, Room>>;
export function makeRooms(hdu: boolean): Rooms;
export function makeRooms(hdu: boolean): Rooms {
  const plan = basePlan(hdu);
  const specs: Partial<Record<RoomId, Spec>> = hdu ? { ...hduSpecs(plan), lander: astraSpecs(plan).lander } : astraSpecs(plan);
  const boxes = (hdu ? { lander: ROOM_BOXES.lander, ...ROOM_BOXES_HDU } : ROOM_BOXES) as Partial<Record<RoomId, Box[]>>;
  const ids = hdu ? HDU_IDS : ASTRA_IDS;
  return Object.fromEntries(ids.map((id) => [id, build(id, specs[id]!, boxes[id]!)])) as unknown as Rooms;
}

/** The rooms of the base the game is played on (the flag's: layout.ts HDU_HABITAT). */
export const ROOMS: Rooms = makeRooms(HDU_HABITAT);
/** Its rooms' ids (ASTRA has no greenhouse_up or lab_up). */
export const ROOM_IDS = Object.keys(ROOMS) as RoomId[];
const ROOM_LIST: readonly Room[] = ROOM_IDS.map((id) => ROOMS[id]!);

/**
 * A room of the game's base, by id. The ids the game passes come from its rooms (a door, a ladder, the room the
 * astronaut is in), so it is always there; asking for a room this base has not (greenhouse_up on ASTRA) is a bug.
 */
export function getRoom(id: RoomId): Room {
  const r = ROOMS[id];
  if (!r) throw new Error(`no room ${id} on this base`);
  return r;
}

const BUILDING: Readonly<Record<RoomId, BuildingId>> = {
  habitat: 'habitat',
  habitat_up: 'habitat',
  greenhouse: 'greenhouse',
  greenhouse_up: 'greenhouse',
  lab: 'lab',
  lab_up: 'lab',
  lander: 'lander',
};
/** The building a room belongs to (its interior model and its door): an upper floor's is its module's. */
export const buildingOf = (id: RoomId): BuildingId => BUILDING[id];

/** The room the astronaut walks in now (null: outside). Written by the Rig, read by Interiors and Astronaut. */
export const roomState = { id: null as RoomId | null };

/** The body's radius indoors (native m): a person's shoulders, so the rooms' doorways and the ladder's rail let it by. */
export const ROOM_BODY = 0.25;

/** E reaches a door from this far (m, in the game) from its `out` spot. */
export const DOOR_REACH = 1.3;

/** The room whose door the astronaut stands at, outside (null: none); of the game's rooms, or of `rooms` (tests). */
export function doorAt(p: XZ, rooms: readonly Room[] = ROOM_LIST): RoomId | null {
  for (const r of rooms) {
    if (r.noDoor) continue;
    if (Math.hypot(p.x - r.out.x, p.z - r.out.z) < DOOR_REACH) return r.id;
  }
  return null;
}

/** The HDU complex's module centres along its length (game x, z), for inHduComplex. */
const HDU_CENTRES: readonly (readonly [number, number])[] = [...HDU_MODULES]
  .sort((a, b) => HDU_MODULE_X[a] - HDU_MODULE_X[b])
  .map((m) => moduleToGame(m, 0, 0));

/**
 * (x, y, z) in the game is within `m` of the HDU complex's solid outside (`?hdu`): a module's shell (radius
 * HDU.shell up to its dome top HDU.top) or a pressurised tunnel between neighbouring modules (a level cylinder of
 * radius HDU.tunnelR, its axis HDU.tunnelY up). For the outside follow camera (src/scene/Rig.tsx), so it never
 * swings into a dome or a tunnel. No allocation.
 */
export function inHduComplex(x: number, y: number, z: number, m = 0): boolean {
  for (let i = 0; i < HDU_CENTRES.length; i++) {
    const c = HDU_CENTRES[i];
    if (y < HDU.top + m && Math.hypot(x - c[0], z - c[1]) < HDU.shell + m) return true;
    if (i === 0) continue;
    const a = HDU_CENTRES[i - 1];
    const dx = c[0] - a[0], dz = c[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    const side = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
    if (Math.hypot(side, y - HDU.tunnelY) < HDU.tunnelR + m) return true;
  }
  return false;
}

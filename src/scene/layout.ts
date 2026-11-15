/**
 * Base layout in metres (docs/layout.md, developer guide §03). Y is up. Scene-only constants: positions and sizes
 * of the buildings, never game numbers.
 *
 * 15 Nov ~05:00 (Shoxjahon aka: "the base models are small"): ASTRA's buildings now stand at about their real size
 * next to the 1.85 m astronaut (src/scene/AstraBase.tsx ASTRA_SCALE), so the base is spread ~1.5× from the
 * developer guide's plan, same arrangement around the habitat, with ≥ 2 m of walkway between hitboxes
 * (src/walk/world.ts, its tests).
 *
 * 15 Nov ~13:00 (Samandar, variant A; `features.hduHabitat` / `?hdu`, off by default): the base core is NASA's
 * Habitat Demonstration Unit as a complex of three modules at real size joined by pressurised tunnels — C greenhouse
 * (the garden), A habitat (Life Support), B lab (the workshop) — every module walk-in. Its own plan (HDU_PLAN): the
 * complex across the back of the flat pad with its doors to the north, everything else in front of it.
 */
import { features } from '../config/features';

const query = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
/**
 * The base core as NASA's HDU complex (`features.hduHabitat` / `?hdu`): three modules at real size (r 2.1 m, 5.8 m
 * tall), interiors in game metres (scale 1). Built by oy-karvonsaroyi-3d/hb7/hdu_base/build_game_complex.py.
 */
export const HDU_HABITAT = features.hduHabitat || query.has('hdu');

/**
 * One HDU module in game metres, real NASA size (build_game_complex.py hdu_complex_numbers.json): shell radius,
 * the lining (inner wall), ground floor, loft deck, loft wall top, dome top, the shell's front face at the door
 * (model +z), the door, the tunnel radius and axis height.
 */
export const HDU = {
  shell: 2.1,
  lining: 1.95,
  floor: 0.45,
  deck: 2.85,
  loftTop: 4.75,
  top: 5.82,
  front: 2.26,
  door: { w: 1.0, h: 2.0 },
  tunnelR: 1.05,
  tunnelY: 1.5,
} as const;

/** Module → its place along the complex's local x (the exterior GLB's frame: C −13, A 0, B +13; doors at local +z). */
export const HDU_MODULE_X = { greenhouse: -13, habitat: 0, lab: 13 } as const;
export type HduModule = keyof typeof HDU_MODULE_X;
export const HDU_MODULES = Object.keys(HDU_MODULE_X) as HduModule[];

/**
 * Where the complex stands: the habitat module's centre and the turn (three.js rotation-y) of the whole complex.
 * turn 0 = the modules along the game's x, the doors to +z (north, toward the hub and the hill). Its frame (fins,
 * legs, side modules, rear masts) spans local x −17.9…16.4, z −9.1…3.7: all inside the flat pad (r 22, ground.ts).
 */
export const HDU_COMPLEX = { x: 0.75, z: -4.0, turn: 0 } as const;

/** Complex frame (local x along the modules, z to the doors) → the game's (x, z). */
export function complexToGame(lx: number, lz: number): [number, number] {
  const c = Math.cos(HDU_COMPLEX.turn), s = Math.sin(HDU_COMPLEX.turn);
  return [HDU_COMPLEX.x + lx * c + lz * s, HDU_COMPLEX.z - lx * s + lz * c];
}

/** A module's frame (its centre, door at +z; the interior GLBs' frame) → the game's (x, z). */
export function moduleToGame(id: HduModule, mx: number, mz: number): [number, number] {
  return complexToGame(HDU_MODULE_X[id] + mx, mz);
}

export type XZ = readonly [number, number];
type Site = 'habitat' | 'garden' | 'workshop' | 'lander' | 'wing' | 'hub' | 'scout' | 'dish';
type Building = 'habitat' | 'garden' | 'workshop' | 'scout' | 'lander' | 'hub';

/** Everything that differs between the ASTRA base and the HDU base: built for either, so tests can check both. */
export interface BasePlan {
  hdu: boolean;
  LAYOUT: Readonly<Record<Site, XZ>>;
  /** Footprint radius of each tappable building (cable ends, sockets, target rings; ASTRA: hitboxes too). */
  RADIUS: Readonly<Record<Building, number>>;
  BATTERY_BANK: XZ;
  PARKED_ROVER: { readonly x: number; readonly z: number; readonly yaw: number; readonly r: number };
  /** The habitat door and the open side of the interior face this way (the power hub). */
  DOOR_AZ: number;
  /** Distance of the habitat's door (its outer face) from the habitat centre: where the door marker belongs. */
  DOOR_R: number;
  TANKS: { readonly x: number; readonly z: number; readonly yaw: number; readonly r: number };
  /** Point at distance r from the habitat centre in the door direction. */
  fromDoor(r: number): [number, number];
  /** Point at distance r from (x, z), towards the middle of the base (the habitat). */
  towardBase(at: XZ, r: number): [number, number];
}

const ASTRA_LAYOUT = {
  habitat: [0.2, 0.8],
  garden: [-9.0, -3.2],
  workshop: [8.9, 5.9],
  lander: [7.6, -12.4],
  wing: [-11.5, -12.0],
  hub: [-5.5, 6.5],
  scout: [-5.2, 15.5],
  dish: [15.7, -4.2],
} as const satisfies Record<Site, XZ>;

/**
 * The HDU base (`?hdu`): the three module centres are the habitat, the garden (greenhouse) and the workshop (lab);
 * everything else stands in front of the complex, on the side of its doors, with ≥ 2 m of walkway between hitboxes
 * (src/walk/world.ts makeOutside(true), src/walk/hduWorld.test.ts), all inside the flat pad.
 */
const HDU_LAYOUT = {
  habitat: complexToGame(HDU_MODULE_X.habitat, 0),
  garden: complexToGame(HDU_MODULE_X.greenhouse, 0),
  workshop: complexToGame(HDU_MODULE_X.lab, 0),
  lander: [9.5, 11.5],
  wing: [-13.5, 11.0],
  hub: [-1.5, 4.5],
  // (west of the old spot: the arrival camera, arrival.ts arrivalCameraSpot, stands 7.5 m left of the parked rover)
  scout: [-7.0, 16.0],
  dish: [17.0, 8.0],
} as const satisfies Record<Site, XZ>;

/**
 * ASTRA: footprint radius from the ASTRA models at ASTRA_SCALE: habitat shell 5.23 m × 0.6; greenhouse 4.9 × 3.3 m deck
 * × 0.9; lab 3.6 × 2.4 m skid × 0.85 (+ its side racks); lander descent stage (its thin legs reach ~4 m and can be
 * walked between); scout rover.
 * HDU: each module's fins reach 3.4 m, so its cable end, battery rack and target ring sit just outside them (3.5),
 * where the astronaut can stand (the module's hitbox: src/walk/world.ts).
 */
const ASTRA_RADIUS = { habitat: 3.2, garden: 2.6, workshop: 2.2, scout: 1.2, lander: 1.9, hub: 0.6 } as const;
const HDU_RADIUS = { habitat: 3.5, garden: 3.5, workshop: 3.5, scout: 1.2, lander: 1.9, hub: 0.6 } as const;

function makePlan(hdu: boolean): BasePlan {
  const LAYOUT = hdu ? HDU_LAYOUT : ASTRA_LAYOUT;
  const RADIUS = hdu ? HDU_RADIUS : ASTRA_RADIUS;
  // HDU: the doors face the way the complex is turned (north); ASTRA: the habitat door faces the power hub.
  const DOOR_AZ = hdu ? HDU_COMPLEX.turn : Math.atan2(LAYOUT.hub[0] - LAYOUT.habitat[0], LAYOUT.hub[1] - LAYOUT.habitat[1]);
  const DOOR_R = hdu ? HDU.front + 0.05 : RADIUS.habitat + 0.05;
  const fromDoor = (r: number): [number, number] => [
    LAYOUT.habitat[0] + Math.sin(DOOR_AZ) * r,
    LAYOUT.habitat[1] + Math.cos(DOOR_AZ) * r,
  ];
  const towardBase = (at: XZ, r: number): [number, number] => {
    const dx = LAYOUT.habitat[0] - at[0];
    const dz = LAYOUT.habitat[1] - at[1];
    const d = Math.hypot(dx, dz) || 1;
    return [at[0] + (dx / d) * r, at[1] + (dz / d) * r];
  };
  /**
   * Life-support tanks (src/scene/parts/Tanks.tsx): a free-standing row, r = their hitbox (the row is 2.3 m long),
   * their bands facing the hub. ASTRA: 45° round from the door, across a 2 m walkway from the habitat's hitbox
   * (touching it, the two would make a notch a walker gets stuck in). HDU: in front of the habitat module, right of
   * its door, between it and the lab, clear of the porch and the tunnel.
   */
  const TANKS_R = 1.25;
  let tanksX: number, tanksZ: number;
  if (hdu) {
    [tanksX, tanksZ] = complexToGame(HDU_MODULE_X.habitat + 6.3, 5.4);
  } else {
    const TANKS_AZ = DOOR_AZ + Math.PI / 4;
    const TANKS_D = RADIUS.habitat + 0.4 + 2.0 + TANKS_R + 0.1;
    tanksX = LAYOUT.habitat[0] + Math.sin(TANKS_AZ) * TANKS_D;
    tanksZ = LAYOUT.habitat[1] + Math.cos(TANKS_AZ) * TANKS_D;
  }
  const TANKS = { x: tanksX, z: tanksZ, yaw: Math.atan2(LAYOUT.hub[0] - tanksX, LAYOUT.hub[1] - tanksZ), r: TANKS_R };
  /** Battery bank (ASTRA model, src/scene/AstraProps.tsx) in the power yard by the solar arrays: out of the walk
   * between the hub and the habitat (walk tests) and out of the way of the camera behind the astronaut at the hub. */
  const BATTERY_BANK: XZ = hdu ? [-18.5, 3.5] : [-15.5, -5.5];
  /** The crew rover (NASA SEV, decor, src/scene/Decor.tsx) parked on the flat pad, nose to the base; r = its hitbox. */
  const PARKED_ROVER = hdu
    ? { x: 3.5, z: 16.0, yaw: Math.atan2(-3.5, -16.0), r: 2.4 }
    : { x: 14.5, z: 12.0, yaw: -2.3, r: 2.4 };
  return { hdu, LAYOUT, RADIUS, BATTERY_BANK, PARKED_ROVER, DOOR_AZ, DOOR_R, TANKS, fromDoor, towardBase };
}

/** Both plans, for tests (the game uses the one the flag picks, below). */
export const ASTRA_PLAN = makePlan(false);
export const HDU_PLAN = makePlan(true);
export const basePlan = (hdu: boolean): BasePlan => (hdu ? HDU_PLAN : ASTRA_PLAN);
/** The plan the game is drawn and walked on. */
export const PLAN: BasePlan = basePlan(HDU_HABITAT);

export const LAYOUT = PLAN.LAYOUT;
export const RADIUS = PLAN.RADIUS;
export const BATTERY_BANK = PLAN.BATTERY_BANK;
export const BATTERY_R = 1.7;
export const PARKED_ROVER = PLAN.PARKED_ROVER;
export const DOOR_AZ = PLAN.DOOR_AZ;
export const DOOR_R = PLAN.DOOR_R;
export const TANKS = PLAN.TANKS;
export const fromDoor = PLAN.fromDoor;
export const towardBase = PLAN.towardBase;

/**
 * The robot arm (Curiosity's, src/scene/RobotArm.tsx) on the east edge of the flat pad, between the dish and the
 * parked rover, reaching north along the edge: out of every walk between standing points and every standing point's
 * view of its building. r = its pedestal's hitbox; near = how close the astronaut must be for the scanner's button.
 */
export const ROBOT_ARM = { x: 12.8, z: 0.5, yaw: 0, r: 0.7, near: 8 } as const;

/**
 * Real-ish size next to the 1.85 m astronaut (15 Nov ~05:00, Shoxjahon aka: "the base models are small"; it was
 * 0.34 / 0.45 / 0.6 / 0.45 to fit the old small plan): habitat 5.8 m tall, 6.3 m across; greenhouse 4.4 m long,
 * 1.6 m high; lab 3.4 m tall; lander 4.3 m tall. The plan grew with them (LAYOUT, RADIUS, PAD). Here, not in
 * src/scene/AstraBase.tsx, because the walk uses them too (the building interiors, src/walk/rooms.ts).
 * (The HDU complex, `?hdu`, is in game metres: its modules' scale is 1.)
 */
export const ASTRA_SCALE = {
  habitat: HDU_HABITAT ? 1 : 0.6,
  greenhouse: HDU_HABITAT ? 1 : 0.9,
  lab: HDU_HABITAT ? 1 : 0.85,
  lander: 0.7,
  scout: 0.9,
  battery: 1.0,
} as const;

/** ASTRA's hexagonal pad under each outer building: width in metres (src/scene/AstraBase.tsx AstraPads). */
export const PAD = { garden: 5.6, workshop: 4.8, lander: 8.6, scout: 3.8 } as const;

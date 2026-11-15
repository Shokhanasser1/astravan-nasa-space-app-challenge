/**
 * The hitboxes of this base (handoff "first-person walk", section 6): one simple shape for every solid thing, placed
 * from the same layout the scene draws from (src/scene/layout.ts), a little bigger than what you see. Never the
 * render meshes. Scene-only numbers.
 *
 * Built for either base plan (makeOutside): ASTRA's (the habitat, garden and workshop as round buildings) or the HDU
 * complex (`?hdu`: three NASA HDU modules joined by tunnels across the back of the pad, everything else in front).
 */
import {
  BATTERY_R,
  HDU_HABITAT,
  HDU_MODULES,
  HDU_MODULE_X,
  LAYOUT,
  PARKED_ROVER,
  basePlan,
  complexToGame,
  moduleToGame,
  type BasePlan,
  type HduModule,
  type XZ as Pair,
} from '../scene/layout';
import type { Area, Solid } from './collide';
import { rich } from '../scene/rich';
import { STEP_FOOT, STEP_WHEEL, rockSolids } from './rocks';
import { ICE_CRATER } from '../scene/ground';
import { initialTier } from '../scene/quality';
import { OUTPOST_ON, outpostSolids } from '../scene/outpostSite';

/** Every hitbox is its visual footprint plus this much (metres). */
const MARGIN = 0.1;
const disc = (name: string, at: Pair, r: number): Solid => ({ name, x: at[0], z: at[1], r: r + MARGIN });

/** The solar wing: a bar along its two panels (SolarWing.tsx turns it 0.5 rad); on the ASTRA look the bar joins the
 * two sun-tracking arrays (AstraProps.tsx), whose masts and feet it covers (0.9 m round the bar). */
const WING_TURN = 0.5;
const wingBar = (at: Pair): Solid => ({
  name: 'wing',
  x: at[0] - Math.sin(WING_TURN) * 2.65,
  z: at[1] - Math.cos(WING_TURN) * 2.65,
  bx: at[0] + Math.sin(WING_TURN) * 2.65,
  bz: at[1] + Math.cos(WING_TURN) * 2.65,
  r: 0.9,
});

const roverDisc = (p: BasePlan): Solid => ({ name: 'rover', x: p.PARKED_ROVER.x, z: p.PARKED_ROVER.z, r: p.PARKED_ROVER.r });
/** The crew rover's hitbox: it moves to wherever the player parks the rover (`?drive`, src/scene/Rig.tsx). */
export const ROVER_DISC: Solid = { name: 'rover', x: PARKED_ROVER.x, z: PARKED_ROVER.z, r: PARKED_ROVER.r };

/**
 * How far from the middle of the base you can walk and drive (15 Nov, the team: "make the area with the car 4×
 * bigger", 60 → 120 m): past the hill (27 m out) and all round the ice crater (90 m out, 26 m across), inside the
 * detailed ground (src/look/terrain.js NEAR_R, 150 m). The astronaut can get out of the rover anywhere it can go.
 */
export const EDGE = 120;

/** Things on the ice crater's rim, reachable since the edge moved out to 120 m (keep in step with where they are
 * drawn: the ASTRA ice drill, src/scene/AstraProps.tsx DRILL; RASSOR, src/scene/Decor.tsx, on computers only). */
const toCrater = Math.atan2(ICE_CRATER.x, ICE_CRATER.z);
const ICE_DRILL: Pair = [ICE_CRATER.x - Math.sin(toCrater) * 24 + 4, ICE_CRATER.z - Math.cos(toCrater) * 24];
const RASSOR: Pair = [ICE_CRATER.x - Math.sin(toCrater) * 27, ICE_CRATER.z - Math.cos(toCrater) * 27];
/** Inside the habitat: the floor you can stand on (the interior room is 1.7 m in radius, inside the bigger shell;
 * lockers line its wall; the rig calls it "inside" within 1.6 m of the middle). */
export const ROOM = 1.25;

/** The HDU module → the base's building it is (the greenhouse is the garden, the lab the workshop). */
export const HDU_BUILDING: Record<HduModule, 'habitat' | 'garden' | 'workshop'> = {
  greenhouse: 'garden',
  habitat: 'habitat',
  lab: 'workshop',
};

/**
 * One HDU module's outside, in the module's frame (x along the complex, +z = its door): measured from the triangles
 * of public/models/nasa-outpost/hdu_complex.glb between 0.36 m (the step-over height) and 2.2 m (over the head),
 * every one of them inside these shapes (to 0.08 m). The porch deck in front (≤ 0.34 m) is walkable ground.
 * Final radii (they hold their own margin): a bar is (x, z) → (bx, bz).
 */
export const HDU_MODULE_HITBOXES: readonly { part: string; x: number; z: number; bx?: number; bz?: number; r: number }[] = [
  // the shell (r 2.1) and its fins, the airlock door at (0, 2.26) with nothing tall in front of it
  { part: '', x: 0, z: -0.3, r: 3.3 },
  // the side fins (their tips at x ±3.4, z ±1.4) and the legs under them
  { part: ' fins left', x: -3.3, z: -1.6, bx: -3.3, bz: 1.6, r: 0.45 },
  { part: ' fins right', x: 3.3, z: -1.6, bx: 3.3, bz: 1.6, r: 0.45 },
  // the dark radiator / battery box, fins and legs behind
  { part: ' back', x: -3.8, z: -3.6, bx: 2.8, bz: -3.6, r: 1.7 },
  // the side module behind (x ±1.0, z −2 … −6) and the rear masts and legs (to z −9.05)
  { part: ' side', x: 0, z: -2.5, bx: 0, bz: -8.9, r: 1.15 },
  // front left of the door: the porch posts and rail (to 2.2 m) and its low fence
  { part: ' porch', x: -3.0, z: 1.7, bx: -3.0, bz: 2.9, r: 0.6 },
  // front right of the door: a leg and the low posts
  { part: ' leg', x: 2.9, z: 1.9, bx: 3.0, bz: 3.0, r: 0.5 },
  // the door frame and rails either side of the door, joining the porch and the leg to the shell: a straight front
  // (the shell's round front would leave a sharp notch by the porch and the leg where a walker wedges in)
  { part: ' apron', x: -2.3, z: 2.2, bx: 2.3, bz: 2.2, r: 0.6 },
];
/** The pressurised tunnels between the module centres: radius 1.05 m, its frame to 1.21 m. */
export const HDU_TUNNEL_R = 1.25;
/** Behind each tunnel, between the two modules' back parts: a dead-end pocket narrower than the body at its mouth,
 * closed (the back parts' bar carried across), so nobody wedges in behind the base. */
const BACK = HDU_MODULE_HITBOXES.find((h) => h.part === ' back')!;

/** The HDU complex's hitboxes in the game: every module's parts (named `habitat`, `habitat back`, …), the tunnels and
 * the pockets behind them (`tunnel garden-habitat`, `tunnel garden-habitat back`, …). */
export function hduComplexSolids(): Solid[] {
  const out: Solid[] = [];
  for (const id of HDU_MODULES) {
    for (const h of HDU_MODULE_HITBOXES) {
      const [x, z] = moduleToGame(id, h.x, h.z);
      const s: Solid = { name: HDU_BUILDING[id] + h.part, x, z, r: h.r };
      if (h.bx !== undefined && h.bz !== undefined) [s.bx, s.bz] = moduleToGame(id, h.bx, h.bz);
      out.push(s);
    }
  }
  for (const [a, b] of [['greenhouse', 'habitat'], ['habitat', 'lab']] as const) {
    const [x, z] = complexToGame(HDU_MODULE_X[a], 0);
    const [bx, bz] = complexToGame(HDU_MODULE_X[b], 0);
    out.push({ name: `tunnel ${HDU_BUILDING[a]}-${HDU_BUILDING[b]}`, x, z, bx, bz, r: HDU_TUNNEL_R });
    const [fx, fz] = complexToGame(HDU_MODULE_X[a] + BACK.bx!, BACK.bz!);
    const [fbx, fbz] = complexToGame(HDU_MODULE_X[b] + BACK.x, BACK.z);
    out.push({ name: `tunnel ${HDU_BUILDING[a]}-${HDU_BUILDING[b]} back`, x: fx, z: fz, bx: fbx, bz: fbz, r: BACK.r });
  }
  return out;
}

/**
 * Outside: the buildings, the lander, the rover, the hub, the wing and the dish; the edge of the playable ground —
 * for the ASTRA plan or the HDU plan. `rover` is the crew rover's hitbox: the game's is ROVER_DISC (the rig moves
 * it); a plan the game is not on (a test) gets its own, parked where that plan parks it.
 */
export function makeOutside(hdu: boolean, rover: Solid = hdu === HDU_HABITAT ? ROVER_DISC : roverDisc(basePlan(hdu))): Area {
  const { LAYOUT, RADIUS, TANKS, BATTERY_BANK } = basePlan(hdu);
  return {
    solids: [
      ...(hdu
        ? // the HDU complex: three modules and two tunnels across the back of the pad
          hduComplexSolids()
        : [
            // (+0.3 m: the regolith shield round it, ASTRA's or our sandbags, src/scene/parts/Sandbags.tsx)
            disc('habitat', LAYOUT.habitat, RADIUS.habitat + 0.3),
            disc('garden', LAYOUT.garden, RADIUS.garden),
            disc('workshop', LAYOUT.workshop, RADIUS.workshop),
          ]),
      disc('lander', LAYOUT.lander, RADIUS.lander),
      disc('scout', LAYOUT.scout, RADIUS.scout),
      disc('hub', LAYOUT.hub, RADIUS.hub),
      // (Its mast is thin, but the dish hangs at head height. 1.1: the NASA dish model's reflector reaches 1.17 m.)
      disc('dish', LAYOUT.dish, 1.1),
      wingBar(LAYOUT.wing),
      rover,
      // the HDU outpost's modules, side modules and tunnels, while it is on (src/scene/outpostSite.ts; never with the
      // HDU base, which is the same complex at home)
      ...(!hdu && OUTPOST_ON ? outpostSolids() : []),
      { name: 'tanks', x: TANKS.x, z: TANKS.z, r: TANKS.r },
      // (the battery bank is drawn with the ASTRA look only: src/scene/rich.ts)
      ...(rich ? [{ name: 'battery', x: BATTERY_BANK[0], z: BATTERY_BANK[1], r: BATTERY_R }] : []),
      // (the robot arm rides on the crew rover now: the rover's own hitbox covers it)
      // (the drill's three outrigger feet reach 2.0 m from its mast; RASSOR is ~1.9 m long)
      ...(rich ? [disc('ice drill', ICE_DRILL, 2.0)] : []),
      ...(initialTier() === 'pc' ? [disc('rassor', RASSOR, 1.1)] : []),
      // the rocks too tall to step over (the lower ones are ground: src/walk/rocks.ts)
      ...rockSolids(STEP_FOOT, EDGE),
    ],
    bounds: { name: 'edge', x: 0, z: 0, r: EDGE },
  };
}

/** Outside on the plan the game is on (`?hdu` or not), with the game's rover hitbox. */
export const OUTSIDE: Area = makeOutside(HDU_HABITAT);

/** Where the crew rover drives (src/scene/roverDrive.ts): outside, everything but its own hitbox. */
// (its wheels climb rocks up to 0.6 m: only the taller ones stop it)
export const ROVER_AREA: Area = {
  solids: [...OUTSIDE.solids.filter((s) => s !== ROVER_DISC && s.name !== 'rock'), ...rockSolids(STEP_WHEEL, EDGE)],
  bounds: OUTSIDE.bounds,
};

/**
 * Where the hop out of the rover may land: outside, everything but the rover's own hitbox. (The hop lands 2.58 m
 * from the rover's middle, always inside its 2.4 m disc + the body: the push out of it is a few centimetres.)
 */
export const BESIDE_ROVER: Area = { solids: OUTSIDE.solids.filter((s) => s !== ROVER_DISC), bounds: OUTSIDE.bounds };

/** Inside the habitat: nothing in the way, and its wall all round. */
export const INSIDE: Area = { solids: [], bounds: { name: 'room', x: LAYOUT.habitat[0], z: LAYOUT.habitat[1], r: ROOM } };

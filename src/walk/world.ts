/**
 * The hitboxes of this base (handoff "first-person walk", section 6): one simple shape for every solid thing, placed
 * from the same layout the scene draws from (src/scene/layout.ts), a little bigger than what you see. Never the
 * render meshes. Scene-only numbers.
 */
import { BATTERY_BANK, BATTERY_R, LAYOUT, PARKED_ROVER, RADIUS, ROBOT_ARM, TANKS, type XZ as Pair } from '../scene/layout';
import type { Area, Solid } from './collide';
import { rich } from '../scene/rich';
import { features } from '../config/features';
import { STEP_FOOT, STEP_WHEEL, rockSolids } from './rocks';
import { ICE_CRATER } from '../scene/ground';
import { initialTier } from '../scene/quality';

/** Every hitbox is its visual footprint plus this much (metres). */
const MARGIN = 0.1;
const disc = (name: string, at: Pair, r: number): Solid => ({ name, x: at[0], z: at[1], r: r + MARGIN });

/** The solar wing: a bar along its two panels (SolarWing.tsx turns it 0.5 rad); on the ASTRA look the bar joins the
 * two sun-tracking arrays (AstraProps.tsx), whose masts and feet it covers (0.9 m round the bar). */
const WING_TURN = 0.5;
const wing: Solid = {
  name: 'wing',
  x: LAYOUT.wing[0] - Math.sin(WING_TURN) * 2.65,
  z: LAYOUT.wing[1] - Math.cos(WING_TURN) * 2.65,
  bx: LAYOUT.wing[0] + Math.sin(WING_TURN) * 2.65,
  bz: LAYOUT.wing[1] + Math.cos(WING_TURN) * 2.65,
  r: 0.9,
};

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

/** Outside: the buildings, the lander, the rover, the hub, the wing and the dish; the edge of the playable ground. */
export const OUTSIDE: Area = {
  solids: [
    // (+0.3 m: the regolith shield round it, ASTRA's or our sandbags, src/scene/parts/Sandbags.tsx)
    disc('habitat', LAYOUT.habitat, RADIUS.habitat + 0.3),
    disc('garden', LAYOUT.garden, RADIUS.garden),
    disc('workshop', LAYOUT.workshop, RADIUS.workshop),
    disc('lander', LAYOUT.lander, RADIUS.lander),
    disc('scout', LAYOUT.scout, RADIUS.scout),
    disc('hub', LAYOUT.hub, RADIUS.hub),
    // (Its mast is thin, but the dish hangs at head height. 1.1: the NASA dish model's reflector reaches 1.17 m.)
    disc('dish', LAYOUT.dish, 1.1),
    wing,
    ROVER_DISC,
    { name: 'tanks', x: TANKS.x, z: TANKS.z, r: TANKS.r },
    // (the battery bank is drawn with the ASTRA look only: src/scene/rich.ts)
    ...(rich ? [{ name: 'battery', x: BATTERY_BANK[0], z: BATTERY_BANK[1], r: BATTERY_R }] : []),
    // (the robot arm's pedestal; the arm itself moves above head height or stops at the ground: src/arm/kin.ts)
    ...(features.robotArm && features.character ? [disc('robot arm', [ROBOT_ARM.x, ROBOT_ARM.z], ROBOT_ARM.r)] : []),
    // (the drill's three outrigger feet reach 2.0 m from its mast; RASSOR is ~1.9 m long)
    ...(rich ? [disc('ice drill', ICE_DRILL, 2.0)] : []),
    ...(initialTier() === 'pc' ? [disc('rassor', RASSOR, 1.1)] : []),
    // the rocks too tall to step over (the lower ones are ground: src/walk/rocks.ts)
    ...rockSolids(STEP_FOOT, EDGE),
  ],
  bounds: { name: 'edge', x: 0, z: 0, r: EDGE },
};

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

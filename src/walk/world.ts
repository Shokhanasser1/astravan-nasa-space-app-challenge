/**
 * The hitboxes of this base (handoff "first-person walk", section 6): one simple shape for every solid thing, placed
 * from the same layout the scene draws from (src/scene/layout.ts), a little bigger than what you see. Never the
 * render meshes. Scene-only numbers.
 */
import { BATTERY_BANK, LAYOUT, PARKED_ROVER, RADIUS, ROBOT_ARM, type XZ as Pair } from '../scene/layout';
import type { Area, Solid } from './collide';
import { rich } from '../scene/rich';
import { features } from '../config/features';

/** Every hitbox is its visual footprint plus this much (metres). */
const MARGIN = 0.1;
const disc = (name: string, at: Pair, r: number): Solid => ({ name, x: at[0], z: at[1], r: r + MARGIN });

/** The solar wing is long and thin: a bar along its two panels (SolarWing.tsx turns it 0.5 rad), 0.5 m thick. */
const WING_TURN = 0.5;
const wing: Solid = {
  name: 'wing',
  x: LAYOUT.wing[0] - Math.sin(WING_TURN) * 2.65,
  z: LAYOUT.wing[1] - Math.cos(WING_TURN) * 2.65,
  bx: LAYOUT.wing[0] + Math.sin(WING_TURN) * 2.65,
  bz: LAYOUT.wing[1] + Math.cos(WING_TURN) * 2.65,
  r: 0.25,
};

/** The crew rover's hitbox: it moves to wherever the player parks the rover (`?drive`, src/scene/Rig.tsx). */
export const ROVER_DISC: Solid = { name: 'rover', x: PARKED_ROVER.x, z: PARKED_ROVER.z, r: PARKED_ROVER.r };

/** How far from the middle of the base you can walk: past the hill (27 m out), short of the far craters. */
export const EDGE = 60;
/** Inside the habitat: the floor you can stand on (the shell is 1.7 m in radius; lockers line its wall). */
export const ROOM = 1.25;

/** Outside: the buildings, the lander, the rover, the hub, the wing and the dish; the edge of the playable ground. */
export const OUTSIDE: Area = {
  solids: [
    // (+0.45 m: the regolith sandbag wall around it, src/scene/parts/Sandbags.tsx)
    disc('habitat', LAYOUT.habitat, RADIUS.habitat + 0.45),
    disc('garden', LAYOUT.garden, RADIUS.garden),
    disc('workshop', LAYOUT.workshop, RADIUS.workshop),
    disc('lander', LAYOUT.lander, RADIUS.lander),
    disc('scout', LAYOUT.scout, RADIUS.scout),
    disc('hub', LAYOUT.hub, RADIUS.hub),
    // (Its mast is thin, but the dish hangs at head height. 1.1: the NASA dish model's reflector reaches 1.17 m.)
    disc('dish', LAYOUT.dish, 1.1),
    wing,
    ROVER_DISC,
    // (the battery bank is drawn on computers only: src/scene/rich.ts)
    ...(rich ? [{ name: 'battery', x: BATTERY_BANK[0], z: BATTERY_BANK[1], r: 0.9 }] : []),
    // (the robot arm's pedestal; the arm itself moves above head height or stops at the ground: src/arm/kin.ts)
    ...(features.robotArm && features.character ? [disc('robot arm', [ROBOT_ARM.x, ROBOT_ARM.z], ROBOT_ARM.r)] : []),
  ],
  bounds: { name: 'edge', x: 0, z: 0, r: EDGE },
};

/** Where the crew rover drives (src/scene/roverDrive.ts): outside, everything but its own hitbox. */
export const ROVER_AREA: Area = { solids: OUTSIDE.solids.filter((s) => s !== ROVER_DISC), bounds: OUTSIDE.bounds };

/** Inside the habitat: nothing in the way, and its wall all round. */
export const INSIDE: Area = { solids: [], bounds: { name: 'room', x: LAYOUT.habitat[0], z: LAYOUT.habitat[1], r: ROOM } };

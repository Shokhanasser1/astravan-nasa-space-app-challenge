/**
 * The hitboxes of this base (handoff "first-person walk", section 6): one simple shape for every solid thing, placed
 * from the same layout the scene draws from (src/scene/layout.ts), a little bigger than what you see. Never the
 * render meshes. Scene-only numbers.
 */
import { LAYOUT, RADIUS, type XZ as Pair } from '../scene/layout';
import type { Area, Solid } from './collide';

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

/** How far from the middle of the base you can walk: past the hill (27 m out), short of the far craters. */
export const EDGE = 60;
/** Inside the habitat: the floor you can stand on (the shell is 1.7 m in radius; lockers line its wall). */
export const ROOM = 1.25;

/** Outside: the buildings, the lander, the rover, the hub, the wing and the dish; the edge of the playable ground. */
export const OUTSIDE: Area = {
  solids: [
    disc('habitat', LAYOUT.habitat, RADIUS.habitat),
    disc('garden', LAYOUT.garden, RADIUS.garden),
    disc('workshop', LAYOUT.workshop, RADIUS.workshop),
    disc('lander', LAYOUT.lander, RADIUS.lander),
    disc('scout', LAYOUT.scout, RADIUS.scout),
    disc('hub', LAYOUT.hub, RADIUS.hub),
    // (Its mast is thin, but the dish hangs at head height.)
    disc('dish', LAYOUT.dish, 0.9),
    wing,
  ],
  bounds: { name: 'edge', x: 0, z: 0, r: EDGE },
};

/** Inside the habitat: nothing in the way, and its wall all round. */
export const INSIDE: Area = { solids: [], bounds: { name: 'room', x: LAYOUT.habitat[0], z: LAYOUT.habitat[1], r: ROOM } };

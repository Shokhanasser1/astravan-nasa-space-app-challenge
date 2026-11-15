/**
 * First-person standing points (final version, Dizayn 2.0): eye 1.7 m above the ground.
 * 1 airlock · 2 power hub (main place) · 3 garden window · 4 workshop · 5 hill · 6 lander ladder · inside the habitat.
 * `orbit` is the truth-screen pull-back, not a marker.
 */
import { ASTRA_SCALE, DOOR_AZ, LAYOUT, RADIUS, fromDoor, towardBase } from './layout';
import { HILL, ICE_CRATER, groundHeight } from './ground';

export type PointId = 'airlock' | 'hub' | 'garden' | 'workshop' | 'hill' | 'ladder' | 'inside' | 'orbit';
export type Vec3 = [number, number, number];

export const EYE = 1.7;
const HAB_FLOOR = 0.2;

const at = (x: number, z: number): Vec3 => [x, groundHeight(x, z) + EYE, z];

/**
 * Inside the habitat in the ASTRA look (src/scene/Interiors.tsx): its furnished interior is drawn at the shell's scale
 * (ASTRA_SCALE.habitat), so the eye stands in it at that scale too — a picture is the same at any scale, and the
 * room looks full size. Model frame (native metres, front +z = the door): just in from the inner airlock hatch, eye
 * 1.6 m above the deck (0.5), looking at the wardroom table and the galley.
 */
const HAB_S = ASTRA_SCALE.habitat;
const lite = typeof location !== 'undefined' && new URLSearchParams(location.search).has('lite');
const hab = (mx: number, my: number, mz: number): Vec3 => {
  const c = Math.cos(DOOR_AZ), s = Math.sin(DOOR_AZ);
  return [LAYOUT.habitat[0] + (mx * c + mz * s) * HAB_S, my * HAB_S, LAYOUT.habitat[1] + (-mx * s + mz * c) * HAB_S];
};

// (all from the layout: the base was spread on 15 Nov when its buildings grew to real size)
const airlock = fromDoor(RADIUS.habitat + 1.4);
const HUB_D = Math.hypot(LAYOUT.hub[0] - LAYOUT.habitat[0], LAYOUT.hub[1] - LAYOUT.habitat[1]);
// Plan point: beside the hub and a step toward the base (1.1 m from its edge: the hub's proximity prompt is on),
// facing the habitat with nothing in the way — W walks straight to Life Support (15 Nov playtest: from behind the
// hub, W walked into the cabinet and stuck).
const HUB_U = [(LAYOUT.hub[0] - LAYOUT.habitat[0]) / HUB_D, (LAYOUT.hub[1] - LAYOUT.habitat[1]) / HUB_D] as const;
const HUB_SIDE = RADIUS.hub + 0.9;
const hubSpot = [LAYOUT.hub[0] - HUB_U[0] * 0.8 - HUB_U[1] * HUB_SIDE, LAYOUT.hub[1] - HUB_U[1] * 0.8 + HUB_U[0] * HUB_SIDE] as const;
const hubLook = fromDoor(HUB_D * 0.42);
const gardenSpot = towardBase(LAYOUT.garden, RADIUS.garden + 1.8); // the long glass side, all the troughs in view
const workshopSpot = towardBase(LAYOUT.workshop, RADIUS.workshop + 1.6);
const ladderSpot = towardBase(LAYOUT.lander, 2.7); // the ladder leg faces the base

export const POINTS: Record<PointId, { pos: Vec3; look: Vec3 }> = {
  airlock: { pos: at(airlock[0], airlock[1]), look: [LAYOUT.garden[0] + 1, 1, LAYOUT.garden[1] - 1] },
  hub: { pos: at(hubSpot[0], hubSpot[1]), look: [hubLook[0], 1.6, hubLook[1]] },
  garden: { pos: at(gardenSpot[0], gardenSpot[1]), look: [LAYOUT.garden[0], 0.9, LAYOUT.garden[1]] },
  workshop: { pos: at(workshopSpot[0], workshopSpot[1]), look: [LAYOUT.workshop[0], 1.4, LAYOUT.workshop[1]] },
  hill: { pos: at(HILL.x, HILL.z), look: [0, 0.5, 0] },
  ladder: { pos: at(ladderSpot[0], ladderSpot[1]), look: [LAYOUT.lander[0], 2.8, LAYOUT.lander[1]] },
  inside: lite
    ? { pos: [LAYOUT.habitat[0], HAB_FLOOR + 1.5, LAYOUT.habitat[1]], look: [LAYOUT.hub[0], 1.2, LAYOUT.hub[1]] }
    : { pos: hab(0.3, 2.1, 2.45), look: hab(-3.4, 1.1, 1.6) },
  orbit: { pos: [40, 130, 170], look: [0, 0, 0] },
};

/** Points reachable by tapping a glowing ground marker (inside = tap the habitat door). */
export const MARKERS: PointId[] = ['airlock', 'hub', 'garden', 'workshop', 'hill', 'ladder'];

/** Default point by phase; null = stay where the child is. */
export function phasePoint(phase: string): PointId | null {
  switch (phase) {
    case 'morning':
      return 'airlock';
    case 'plan':
      return 'hub';
    case 'night':
      return 'inside';
    case 'launch':
      return 'hill'; // watch the lander lift off over the whole base (developer guide §03: the camera follows it)
    case 'truth':
      return 'orbit';
    default:
      return null;
  }
}

/** Where the camera turns for view.focus (the event's place). */
export const FOCUS: Record<string, Vec3> = {
  garden: [LAYOUT.garden[0], 0.8, LAYOUT.garden[1]],
  wing: [LAYOUT.wing[0], 2.0, LAYOUT.wing[1]],
  crater: [ICE_CRATER.x, -2, ICE_CRATER.z],
};

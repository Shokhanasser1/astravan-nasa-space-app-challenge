/**
 * First-person standing points (final version, Dizayn 2.0): eye 1.7 m above the ground.
 * 1 airlock · 2 power hub (main place) · 3 garden window · 4 workshop · 5 hill · 6 lander ladder · inside the habitat.
 * `orbit` is the truth-screen pull-back, not a marker.
 */
import { LAYOUT, fromDoor } from './layout';
import { HILL, ICE_CRATER, groundHeight } from './ground';

export type PointId = 'airlock' | 'hub' | 'garden' | 'workshop' | 'hill' | 'ladder' | 'inside' | 'orbit';
export type Vec3 = [number, number, number];

export const EYE = 1.7;
const HAB_FLOOR = 0.2;

const at = (x: number, z: number): Vec3 => [x, groundHeight(x, z) + EYE, z];

const airlock = fromDoor(3.2);
const hubSpot = fromDoor(9.2); // behind the hub, looking back at hub → habitat → lander

export const POINTS: Record<PointId, { pos: Vec3; look: Vec3 }> = {
  airlock: { pos: at(airlock[0], airlock[1]), look: [-6, 1, -4] },
  hub: { pos: at(hubSpot[0], hubSpot[1]), look: [-1.4, 1.2, 2.4] },
  garden: { pos: at(LAYOUT.garden[0], LAYOUT.garden[1] + 3.0), look: [LAYOUT.garden[0], 0.7, LAYOUT.garden[1]] },
  workshop: { pos: at(3.2, 6.8), look: [LAYOUT.workshop[0], 1.0, LAYOUT.workshop[1]] },
  hill: { pos: at(HILL.x, HILL.z), look: [0, 0.5, 0] },
  ladder: { pos: at(LAYOUT.lander[0], LAYOUT.lander[1] + 2.6), look: [LAYOUT.lander[0], 2.2, LAYOUT.lander[1]] },
  inside: { pos: [LAYOUT.habitat[0], HAB_FLOOR + 1.5, LAYOUT.habitat[1]], look: [LAYOUT.hub[0], 1.2, LAYOUT.hub[1]] },
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

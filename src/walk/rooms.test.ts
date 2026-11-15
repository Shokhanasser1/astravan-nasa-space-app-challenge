// Walking in the buildings with the astronaut (src/walk/rooms.ts): every room's door spot outside is free ground and
// finds its room, the astronaut stands clear where it comes in, E inside offers the way out there, and it can walk
// into the room and never through its walls.
import { describe, expect, it } from 'vitest';
import { fits, walkStep } from './collide';
import { OUTSIDE } from './world';
import { ROOMS, ROOM_BODY, ROOM_IDS, doorAt, getRoom } from './rooms';
import { ASTRA_SCALE } from '../scene/layout';

describe('building rooms', () => {
  for (const id of ROOM_IDS) {
    const R = getRoom(id);
    const body = ROOM_BODY * R.s;

    it(`${id}: door outside, spawn inside, exit by the door (or the ladder)`, () => {
      expect(fits(R.out.x, R.out.z, OUTSIDE)).toBe(true);
      expect(fits(R.spawn.x, R.spawn.z, R.area, body)).toBe(true);
      if (!R.noDoor) {
        expect(doorAt(R.out)).toBe(id);
        expect(R.exit(R.spawn.x, R.spawn.z)).toBe(true);
      }
      if (R.ladder) {
        // you arrive clear on the other floor, and right where its ladder takes you back
        const T = getRoom(R.ladder.to);
        expect(fits(R.ladder.arrive.x, R.ladder.arrive.z, T.area, ROOM_BODY * T.s)).toBe(true);
        expect(T.ladder?.to).toBe(id);
        expect(T.ladder!.near(R.ladder.arrive.x, R.ladder.arrive.z)).toBe(true);
      }
      expect(R.ceilY - R.floorY).toBeGreaterThan(1.75 * R.s); // a suited astronaut stands up (at the room's scale)
    });

    it(`${id}: walks in from the door, stays inside the walls`, () => {
      // straight ahead (its facing) for a while, then straight back out through the door side
      const at = { x: R.spawn.x, z: R.spawn.z };
      const out = { x: 0, z: 0 };
      const step = 0.02 * R.s;
      for (let i = 0; i < 400; i++) {
        walkStep(at, Math.sin(R.spawn.facing) * step, Math.cos(R.spawn.facing) * step, R.area, body, out);
        at.x = out.x;
        at.z = out.z;
      }
      expect(Math.hypot(at.x - R.spawn.x, at.z - R.spawn.z) / R.s).toBeGreaterThan(0.35); // into the room
      expect(fits(at.x, at.z, R.area, body)).toBe(true);
      for (let i = 0; i < 800; i++) {
        walkStep(at, -Math.sin(R.spawn.facing) * step, -Math.cos(R.spawn.facing) * step, R.area, body, out);
        at.x = out.x;
        at.z = out.z;
      }
      expect(Math.hypot(at.x - R.area.bounds.x, at.z - R.area.bounds.z)).toBeLessThanOrEqual(R.area.bounds.r - body + 1e-6);
      expect(fits(at.x, at.z, R.area, body)).toBe(true);
    });
  }

  it('upper floor: from the ladder out of the command room into the ring hall', () => {
    const R = ROOMS.habitat_up;
    const body = ROOM_BODY * R.s;
    // model frame → game (the habitat's turn and scale), as rooms.ts does
    const toGame = (x: number, z: number) => {
      const t = ROOMS.habitat.spawn.facing - Math.PI; // the habitat's turn (its spawn faces model −z)
      return { x: R.area.bounds.x + (x * Math.cos(t) + z * Math.sin(t)) * ASTRA_SCALE.habitat, z: R.area.bounds.z + (-x * Math.sin(t) + z * Math.cos(t)) * ASTRA_SCALE.habitat };
    };
    let at = toGame(1.25, 0.45);
    const out = { x: 0, z: 0 };
    for (const [mx, mz] of [[0.8, 1.15], [0, 1.45], [0, 2.7]]) {
      const goal = toGame(mx, mz);
      for (let i = 0; i < 2000 && Math.hypot(goal.x - at.x, goal.z - at.z) > 0.01; i++) {
        const d = Math.hypot(goal.x - at.x, goal.z - at.z);
        walkStep(at, ((goal.x - at.x) / d) * Math.min(d, 0.003), ((goal.z - at.z) / d) * Math.min(d, 0.003), R.area, body, out);
        at = { x: out.x, z: out.z };
      }
      expect(Math.hypot(goal.x - at.x, goal.z - at.z), `to model (${mx}, ${mz})`).toBeLessThan(0.02);
    }
  });
});

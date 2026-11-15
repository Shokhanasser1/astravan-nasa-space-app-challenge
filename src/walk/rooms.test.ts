// Walking in the buildings with the astronaut (src/walk/rooms.ts): every room's door spot outside is free ground and
// finds its room, the astronaut stands clear where it comes in, E inside offers the way out there, and it can walk
// into the room and never through its walls.
import { describe, expect, it } from 'vitest';
import { BODY, fits, walkStep } from './collide';
import { OUTSIDE } from './world';
import { ROOMS, ROOM_IDS, doorAt } from './rooms';

describe('building rooms', () => {
  for (const id of ROOM_IDS) {
    const R = ROOMS[id];
    const body = BODY * R.s;

    it(`${id}: door outside, spawn inside, exit by the door`, () => {
      expect(fits(R.out.x, R.out.z, OUTSIDE)).toBe(true);
      expect(doorAt(R.out)).toBe(id);
      expect(fits(R.spawn.x, R.spawn.z, R.area, body)).toBe(true);
      expect(R.exit(R.spawn.x, R.spawn.z)).toBe(true);
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
      expect(Math.hypot(at.x - R.spawn.x, at.z - R.spawn.z) / R.s).toBeGreaterThan(0.6); // ≥ 0.6 m into the room
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
});

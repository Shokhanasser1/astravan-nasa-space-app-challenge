// Going through a door on foot (src/walk/doorWalk.ts): the astronaut reaches the doorstep, waits for the door,
// walks into the doorway, and only then passes inside; out is the same backwards. No jumps in between.
import { describe, expect, it } from 'vitest';
import { DOOR_WALK, doorFade, doorPose, doorTimes, type DoorPlan, type DoorPose } from './doorWalk';
import { ROOM_IDS, getRoom } from './rooms';

const pose = (): DoorPose => ({ x: 0, z: 0, facing: 0, vx: 0, vz: 0 });

describe('door walk', () => {
  for (const id of ROOM_IDS) {
    const R = getRoom(id);
    if (R.noDoor) continue;
    const near = { x: R.doorstep.x + 0.5, z: R.doorstep.z + 0.3, facing: R.doorstep.facing };
    const inPlan: DoorPlan = { dir: 1, from: near, step: R.doorstep, way: R.doorway };
    const outPlan: DoorPlan = { dir: -1, from: R.spawn, step: R.doorstep, way: R.doorway };

    it(`${id}: in — walks to the doorstep, waits for the door, steps into the doorway, then the cut`, () => {
      const T = doorTimes(inPlan);
      expect(T.go).toBeGreaterThanOrEqual(DOOR_WALK.open); // never through a closed door
      expect(T.cut).toBeGreaterThanOrEqual(T.go);
      const p = doorPose(inPlan, T.atStep, pose(), T);
      expect(Math.hypot(p.x - R.doorstep.x, p.z - R.doorstep.z)).toBeLessThan(1e-6);
      const w = doorPose(inPlan, T.cut, pose(), T);
      const end = R.doorway ?? R.doorstep;
      expect(Math.hypot(w.x - end.x, w.z - end.z)).toBeLessThan(1e-6);
      // the whole way: steps no longer than the walking pace allows (no teleport)
      let prev = doorPose(inPlan, 0, pose(), T);
      for (let t = 0.01; t <= T.cut; t += 0.01) {
        const q = doorPose(inPlan, t, pose(), T);
        expect(Math.hypot(q.x - prev.x, q.z - prev.z)).toBeLessThanOrEqual(DOOR_WALK.speed * 0.01 + 1e-9);
        prev = q;
      }
      // the view is black exactly at the cut and clear before and after
      expect(doorFade(inPlan, T.cut, T)).toBeCloseTo(1);
      expect(doorFade(inPlan, 0, T)).toBe(0);
      expect(doorFade(inPlan, T.end, T)).toBe(0);
    });

    it(`${id}: out — the door opens first, then it steps out of the doorway onto the doorstep, facing out`, () => {
      const T = doorTimes(outPlan);
      expect(T.cut).toBeGreaterThanOrEqual(DOOR_WALK.open);
      const a = doorPose(outPlan, T.cut, pose(), T);
      const start = R.doorway ?? R.doorstep;
      expect(Math.hypot(a.x - start.x, a.z - start.z)).toBeLessThan(1e-6);
      const b = doorPose(outPlan, T.end, pose(), T);
      // ends a step out, facing away from the building
      const facesOut = Math.cos(b.facing - (R.doorstep.facing + Math.PI));
      expect(facesOut).toBeCloseTo(1);
      expect(Math.hypot(b.vx, b.vz)).toBe(0);
    });
  }
});

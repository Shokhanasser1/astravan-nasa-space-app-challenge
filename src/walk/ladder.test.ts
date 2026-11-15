import { describe, expect, it } from 'vitest';
import { CLIMB_V, climbDuration, climbPhase, climbPose, type ClimbPose, type LadderClimb } from './ladder';
import { ROOMS, type RoomId } from './rooms';

const pose = (): ClimbPose => ({ x: 0, y: 0, z: 0, facing: 0, vx: 0, vy: 0, vz: 0, stage: 'on' });

/** The climb the Rig builds when E is pressed in room `id` at its ladder's E spot (here: its foot). */
function climbFrom(id: RoomId, from = ROOMS[id].ladder!.foot): LadderClimb {
  const R = ROOMS[id];
  const L = R.ladder!;
  const T = ROOMS[L.to];
  return { from, y0: R.floorY, foot: L.foot, rungs: L.rungs, to: L.arrive, y1: T.floorY };
}

describe('the habitat ladder climb', () => {
  for (const id of ['habitat', 'habitat_up'] as RoomId[]) {
    it(`${id}: starts where the body stood, ends exactly at the room handover's spot`, () => {
      const R = ROOMS[id];
      const start = { x: R.ladder!.foot.x + 0.2, z: R.ladder!.foot.z - 0.1, facing: 1 };
      const c = climbFrom(id, start);
      const T = climbDuration(c);
      const p0 = climbPose(c, 0, pose());
      expect(p0.x).toBeCloseTo(start.x, 6);
      expect(p0.z).toBeCloseTo(start.z, 6);
      expect(p0.y).toBeCloseTo(R.floorY, 6);
      const end = climbPose(c, T, pose());
      expect(end.stage).toBe('done');
      expect(end.x).toBeCloseTo(R.ladder!.arrive.x, 6);
      expect(end.z).toBeCloseTo(R.ladder!.arrive.z, 6);
      expect(end.y).toBeCloseTo(ROOMS[R.ladder!.to].floorY, 6);
      expect(Math.cos(end.facing - R.ladder!.arrive.facing)).toBeCloseTo(1, 6);
      // just before the end it is already (nearly) there: no jump at the handover
      const before = climbPose(c, T - 1 / 60, pose());
      expect(Math.hypot(before.x - end.x, before.y - end.y, before.z - end.z)).toBeLessThan(0.01);
    });
  }

  it('takes a believable ~2–4.5 s, at 0.3–0.6 m/s of height on the rungs', () => {
    const c = climbFrom('habitat');
    const T = climbDuration(c);
    expect(T).toBeGreaterThan(2);
    expect(T).toBeLessThan(4.5);
    expect(CLIMB_V).toBeGreaterThanOrEqual(0.3);
    expect(CLIMB_V).toBeLessThanOrEqual(0.6);
    let vmax = 0;
    for (let t = 0; t <= T; t += 1 / 120) vmax = Math.max(vmax, Math.abs(climbPose(c, t, pose()).vy));
    expect(vmax).toBeLessThan(0.7);
  });

  for (const id of ['habitat', 'habitat_up'] as RoomId[]) {
    it(`${id}: height changes monotonically, only on the rungs, at the ladder's foot spot`, () => {
      const R = ROOMS[id];
      const c = climbFrom(id, { x: R.ladder!.foot.x - 0.3, z: R.ladder!.foot.z + 0.2, facing: 0 });
      const up = c.y1 > c.y0;
      const T = climbDuration(c);
      let last = c.y0;
      let prev = climbPose(c, 0, pose());
      for (let t = 1 / 120; t <= T + 0.05; t += 1 / 120) {
        const p = climbPose(c, t, pose());
        expect(up ? p.y >= last - 1e-9 : p.y <= last + 1e-9).toBe(true);
        if (p.stage === 'climb') {
          // between the foot spot and the rungs' plane (the Climb clip's origin), never anywhere else
          const L = R.ladder!;
          const along = Math.hypot(p.x - L.foot.x, p.z - L.foot.z) + Math.hypot(p.x - L.rungs.x, p.z - L.rungs.z);
          expect(along).toBeCloseTo(Math.hypot(L.rungs.x - L.foot.x, L.rungs.z - L.foot.z), 6);
          expect(Math.sign(p.vy) === (up ? 1 : -1) || p.vy === 0).toBe(true);
        } else {
          expect(p.y === c.y0 || p.y === c.y1).toBe(true);
        }
        // continuous: no step bigger than the speed allows
        expect(Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z)).toBeLessThan(0.05);
        prev = p;
        last = p.y;
      }
    });
  }

  it('faces the rungs on the ladder, the same spot on both floors', () => {
    const a = ROOMS.habitat.ladder!.foot;
    const b = ROOMS.habitat_up.ladder!.foot;
    expect(a.x).toBeCloseTo(b.x, 9);
    expect(a.z).toBeCloseTo(b.z, 9);
    const c = climbFrom('habitat');
    const mid = climbPose(c, climbDuration(c) / 2, pose());
    expect(mid.stage).toBe('climb');
    expect(Math.cos(mid.facing - a.facing)).toBeCloseTo(1, 9);
    // mid-climb the origin is on the rungs' plane, 0.42 m (full size) in front of the foot spot
    expect(mid.x).toBeCloseTo(ROOMS.habitat.ladder!.rungs.x, 9);
    expect(mid.z).toBeCloseTo(ROOMS.habitat.ladder!.rungs.z, 9);
    expect(Math.hypot(a.x - mid.x, a.z - mid.z) / ROOMS.habitat.s).toBeCloseTo(0.42, 6);
    // and the body faces the rungs: they are ahead along its facing
    expect(Math.sin(a.facing) * (mid.x - a.x) + Math.cos(a.facing) * (mid.z - a.z)).toBeGreaterThan(0);
  });

  it('puts boots and hands on the rungs: the Climb phase repeats every two rungs', () => {
    expect(climbPhase(0.2825)).toBeCloseTo(0, 9);
    expect(climbPhase(0.2825 + 0.3)).toBeCloseTo(0.5, 9);
    expect(climbPhase(0.2825 + 1.2 + 0.15)).toBeCloseTo(0.25, 9);
    for (let h = 0; h < 3; h += 0.07) {
      const p = climbPhase(h);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
  });
});

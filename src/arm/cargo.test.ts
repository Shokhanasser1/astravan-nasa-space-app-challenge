import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ArmRig } from './rig';
import { CARGO_SIZE, GRAB_R, cargoSpots, makeCargo, restY, stepCargo, type CargoState, type Grip } from './cargo';
import { ASTRA_PLAN, HDU_PLAN } from '../scene/layout';
import { makeOutside } from '../walk/world';
import { clearance } from '../walk/collide';
import { groundHeight } from '../scene/ground';

const flat = () => 0;
const spots = [
  { kind: 'rock' as const, x: 0, z: 0, yaw: 0, s: 1, shade: 0 },
  { kind: 'box' as const, x: 2, z: 0, yaw: 0, s: 1, shade: 0 },
];
const grip = (x: number, y: number, z: number): Grip => ({ x, y, z, q: [0, 0, 0, 1] });
/** Run the jaws from open to `to` (several frames) with the grip still. */
function jaws(st: CargoState, g: Grip, from: number, to: number) {
  for (let i = 0; i <= 10; i++) stepCargo(st, 1 / 60, g, from + ((to - from) * i) / 10);
}
function fallUntilRest(st: CargoState, g: Grip, open = 1) {
  for (let i = 0; i < 600 && st.items.some((it) => it.mode === 'fall'); i++) stepCargo(st, 1 / 60, g, open);
}

describe('arm cargo', () => {
  it('lies on the ground at rest', () => {
    const st = makeCargo(spots, (x) => 0.5 + x);
    expect(st.items[0].y).toBeCloseTo(0.5 + CARGO_SIZE.rock.half);
    expect(st.items[1].y).toBeCloseTo(2.5 + CARGO_SIZE.box.half);
  });

  it('closing the jaws near one takes the nearest; it follows the grip and keeps its offset', () => {
    const st = makeCargo(spots, flat);
    const g = grip(0.1, 0.25, 0);
    stepCargo(st, 1 / 60, g, 1);
    jaws(st, g, 1, 0);
    expect(st.held).toBe(0);
    expect(st.items[0].mode).toBe('held');
    expect(st.items[1].mode).toBe('rest');
    const dy = st.items[0].y - g.y;
    // lift and move: it rides along, same offset
    g.x = 5;
    g.y = 2;
    g.z = -1;
    expect(stepCargo(st, 1 / 60, g, 0)).toBe(true);
    expect(st.items[0].x).toBeCloseTo(4.9);
    expect(st.items[0].y).toBeCloseTo(2 + dy);
    expect(st.items[0].z).toBeCloseTo(-1);
    // turn the gripper half round about Y: the offset turns with it
    g.q = [0, 1, 0, 0];
    stepCargo(st, 1 / 60, g, 0);
    expect(st.items[0].x).toBeCloseTo(5.1);
    // nothing moves: nothing to redraw
    expect(stepCargo(st, 1 / 60, g, 0)).toBe(false);
  });

  it('ignores things out of reach, and does not grab with jaws already closed', () => {
    const st = makeCargo(spots, flat);
    const far = grip(0, CARGO_SIZE.rock.half + GRAB_R + 0.05, 0);
    stepCargo(st, 1 / 60, far, 1);
    jaws(st, far, 1, 0);
    expect(st.held).toBe(-1);
    // closed jaws brought down onto it: no grab (only the closing takes)
    const near = grip(0, 0.2, 0);
    stepCargo(st, 1 / 60, near, 0);
    expect(st.held).toBe(-1);
    // half-way (between the thresholds) does nothing either
    jaws(st, near, 0, 0.5);
    jaws(st, near, 0.5, 0.3);
    expect(st.held).toBe(-1);
  });

  it('opening the jaws drops it; it falls at Moon gravity and lands on the ground height', () => {
    const ground = (x: number) => 0.2 + 0.1 * x;
    const st = makeCargo(spots, ground);
    const g = grip(0, 0.3, 0);
    jaws(st, g, 1, 0);
    expect(st.held).toBe(0);
    g.x = 3;
    g.y = 2.5;
    g.q = [Math.sin(0.4), 0, 0, Math.cos(0.4)]; // tilted claws
    stepCargo(st, 1 / 60, g, 0);
    stepCargo(st, 1 / 60, g, 0.9);
    const it = st.items[0];
    expect(it.mode).toBe('fall');
    expect(st.held).toBe(-1);
    // after 0.5 s it has fallen about ½·1.62·0.5² ≈ 0.2 m
    const y0 = it.y;
    for (let i = 0; i < 30; i++) stepCargo(st, 1 / 60, g, 1);
    expect(y0 - it.y).toBeGreaterThan(0.17);
    expect(y0 - it.y).toBeLessThan(0.23);
    fallUntilRest(st, g);
    expect(it.mode).toBe('rest');
    expect(it.y).toBeCloseTo(restY(it, ground));
    // lies upright (only its heading kept)
    expect(Math.abs(it.q[0]) + Math.abs(it.q[2])).toBeLessThan(1e-9);
    expect(stepCargo(st, 1 / 60, g, 1)).toBe(false);
  });

  it('holds only one at a time', () => {
    const st = makeCargo(
      [
        { kind: 'rock', x: 0, z: 0, yaw: 0, s: 1, shade: 0 },
        { kind: 'rock', x: 0.2, z: 0, yaw: 0, s: 1, shade: 1 },
      ],
      flat,
    );
    const g = grip(0.15, 0.2, 0);
    jaws(st, g, 1, 0);
    expect(st.held).toBe(1); // the nearer one
    jaws(st, g, 0, 0.3);
    jaws(st, g, 0.3, 0);
    expect(st.items.filter((i) => i.mode === 'held')).toHaveLength(1);
  });

  for (const plan of [ASTRA_PLAN, HDU_PLAN]) {
    it(`${plan.hdu ? 'HDU' : 'ASTRA'} plan: five spots on free ground in the roof arm's reach`, () => {
      const r = plan.PARKED_ROVER;
      const s = cargoSpots(r);
      expect(s.filter((p) => p.kind === 'rock')).toHaveLength(3);
      expect(s.filter((p) => p.kind === 'box')).toHaveLength(2);
      const out = makeOutside(plan.hdu, { name: 'rover', x: r.x, z: r.z, r: r.r });
      // the arm's foot on the roof: 0.5 m behind the middle
      const mx = r.x - 0.5 * Math.sin(r.yaw), mz = r.z - 0.5 * Math.cos(r.yaw);
      for (const p of s) {
        const pr = CARGO_SIZE[p.kind].r;
        for (const so of out.solids) expect(clearance(so, p.x, p.z, pr), `${so.name} at ${p.x}, ${p.z}`).toBeGreaterThan(0.2);
        const d = Math.hypot(p.x - mx, p.z - mz);
        expect(d).toBeGreaterThan(3);
        expect(d).toBeLessThan(4.3);
        expect(Math.abs(groundHeight(p.x, p.z) - groundHeight(r.x, r.z))).toBeLessThan(0.3);
      }
      // the roof arm (a stand-in for the GLB's three parts: the same joints) brings the claws' centre to each one
      const arm = new THREE.Group();
      const names = ['arm_upper', 'arm_fore', 'arm_turret'];
      names.reduce<THREE.Object3D>((parent, name) => {
        const g = new THREE.Group();
        g.name = name;
        parent.add(g);
        return g;
      }, arm);
      const rig = new ArmRig(arm, { scale: 2.4, shoulder: 0.42, deck: { back: 1.6, front: 2.6, halfW: 1.1 } });
      rig.place(mx, groundHeight(r.x, r.z) + 2.6, mz, r.yaw, groundHeight);
      const at = new THREE.Vector3(), q = new THREE.Quaternion();
      const st = makeCargo(s, groundHeight);
      for (const it of st.items) {
        const dx = it.x - mx, dz = it.z - mz;
        const turn = (Math.atan2(dx * Math.cos(r.yaw) - dz * Math.sin(r.yaw), dx * Math.sin(r.yaw) + dz * Math.cos(r.yaw)) * 180) / Math.PI;
        let best = Infinity;
        for (let lift = -20; lift <= 75; lift += 5)
          for (let bend = -80; bend <= 120; bend += 10)
            for (let wrist = -95; wrist <= 95; wrist += 10) {
              rig.set({ lift, bend, wrist, turn, open: 0 });
              rig.update(100);
              rig.gripWorld(at, q);
              best = Math.min(best, Math.hypot(at.x - it.x, at.y - it.y, at.z - it.z));
            }
        expect(best, `${it.kind} at ${it.x}, ${it.z}`).toBeLessThan(GRAB_R / 2);
      }
      rig.dispose();
      // apart from each other
      for (let i = 0; i < s.length; i++)
        for (let j = i + 1; j < s.length; j++) expect(Math.hypot(s[i].x - s[j].x, s[i].z - s[j].z)).toBeGreaterThan(1);
    });
  }
});

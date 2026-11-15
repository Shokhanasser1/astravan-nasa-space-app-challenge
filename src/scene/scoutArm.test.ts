// The science scout's robotic arm (ASTRA's model, src/vendor/astra/scene/models/scout.ts) works in the game: its
// joints survive the bake as a short chain of a few meshes, poseArm folds and unfolds it, and the work cycle reaches
// the rock in front of the rover and comes back.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bake } from './astra/bake';
import { finalize } from '../vendor/astra/scene/kit';
import { buildScout, poseArm } from '../vendor/astra/scene/models/scout';
import { ARM_CYCLE, armAt } from './AstraProps';

const T = ARM_CYCLE.deploy + ARM_CYCLE.work + ARM_CYCLE.stow + ARM_CYCLE.rest;

// ASTRA draws its small labels on a 2D canvas; tests run in node, so a do-nothing canvas stands in.
if (typeof document === 'undefined') {
  const ctx = new Proxy({}, { get: () => () => ({ width: 10 }) });
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  };
}

function bakedScout() {
  const s = buildScout();
  finalize(s.group);
  for (let i = s.arm.length - 1; i >= 0; i--) bake(s.arm[i], { keep: i + 1 < s.arm.length ? [s.arm[i + 1]] : [], live: [] });
  bake(s.group, { keep: [s.pan, s.tilt, ...s.spin, s.arm[0]], live: [] });
  return s;
}

const tip = (s: ReturnType<typeof buildScout>) => {
  s.group.updateMatrixWorld(true);
  return s.arm[4].getWorldPosition(new THREE.Vector3());
};

describe('scout arm', () => {
  it('cycle: folded at rest, unfolds, works with the tool turning, folds back', () => {
    expect(armAt(0).deploy).toBe(0);
    expect(armAt(ARM_CYCLE.deploy / 2).deploy).toBeCloseTo(0.5);
    const mid = armAt(ARM_CYCLE.deploy + ARM_CYCLE.work / 2);
    expect(mid.deploy).toBe(1);
    expect(mid.spin).toBeGreaterThan(0);
    expect(Math.abs(mid.dip)).toBeLessThan(0.1);
    expect(armAt(T - 0.1).deploy).toBe(0);
    expect(armAt(T + 1).deploy).toBeCloseTo(armAt(1).deploy); // repeats
    const out = { deploy: 0, spin: 0, dip: 0 };
    expect(armAt(3, out)).toBe(out); // writes into the given object (no allocation per frame)
  });

  it('joints survive the bake as a few meshes and reach the rock in front of the rover', () => {
    const s = bakedScout();
    let meshes = 0;
    s.arm[0].traverse((o) => ((o as THREE.Mesh).isMesh ? meshes++ : 0));
    expect(meshes).toBeGreaterThan(0);
    expect(meshes).toBeLessThanOrEqual(16); // a handful of draw calls for the whole arm
    for (let i = 1; i < s.arm.length; i++) expect(s.arm[i].parent).toBeTruthy();

    poseArm(s, 0, 0);
    const folded = tip(s);
    poseArm(s, 1, 0);
    const reach = tip(s);
    expect(folded.distanceTo(reach)).toBeGreaterThan(0.5);
    // ASTRA's DEPLOYED pose: 1.2 m ahead (the rover faces -Z), turret hanging down towards the ground
    expect(reach.z).toBeLessThan(folded.z);
    expect(reach.y).toBeLessThan(folded.y);
  });
});

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fit } from './fit';

const bounds = (o: THREE.Object3D) => {
  o.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(o, true);
};

describe('fit(object, height)', () => {
  it('scales to the height and puts the lowest point on the ground', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1)); // centred: y −1 … 1
    const k = fit(mesh, 3.6);
    const b = bounds(mesh);
    expect(k).toBeCloseTo(1.8);
    expect(b.min.y).toBeCloseTo(0);
    expect(b.max.y).toBeCloseTo(3.6);
    expect(b.max.x - b.min.x).toBeCloseTo(1.8); // uniform: the footprint scales with the height
  });

  it('keeps X and Z (origin = base centre), whatever the starting place and scale', () => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2));
    m.position.set(0.5, 3, -0.25);
    g.add(m);
    g.position.set(4, 7, -2);
    g.scale.setScalar(100); // a model exported in centimetres
    fit(g, 2);
    const b = bounds(g);
    expect(b.min.y).toBeCloseTo(0);
    expect(b.max.y).toBeCloseTo(2);
    expect(g.position.x).toBe(4);
    expect(g.position.z).toBe(-2);
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(4 + 0.5 * 2); // offset scaled with the model
  });

  it('works for an object that already has a parent (fits in the parent space)', () => {
    const parent = new THREE.Group();
    parent.position.set(0, 10, 0);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4));
    parent.add(m);
    fit(m, 1);
    const b = bounds(m);
    expect(b.min.y).toBeCloseTo(10); // the parent's ground
    expect(b.max.y).toBeCloseTo(11);
  });

  it('leaves an empty or flat object alone', () => {
    const empty = new THREE.Group();
    expect(fit(empty, 2)).toBe(1);
    expect(empty.scale.x).toBe(1);
    const flat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
    expect(fit(flat, 2)).toBe(1);
    expect(fit(new THREE.Mesh(new THREE.BoxGeometry()), 0)).toBe(1);
  });

  it('is idempotent: fitting twice changes nothing', () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5));
    fit(m, 2.5);
    const k = fit(m, 2.5);
    expect(k).toBeCloseTo(1);
    expect(bounds(m).max.y).toBeCloseTo(2.5);
  });
});

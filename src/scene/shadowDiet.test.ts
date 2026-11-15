import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SMALL_CASTER_M, trimCasters } from './shadowDiet';

const box = (size: number) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshStandardMaterial());
  m.castShadow = true;
  return m;
};

describe('trimCasters', () => {
  it('stops small parts casting and keeps big bodies', () => {
    const root = new THREE.Group();
    const bolt = box(0.2);
    const hull = box(3);
    root.add(bolt, hull);
    expect(trimCasters(root, SMALL_CASTER_M)).toBe(1);
    expect(bolt.castShadow).toBe(false);
    expect(hull.castShadow).toBe(true);
  });

  it('measures in world size: a big part in a scaled-down group is small', () => {
    const root = new THREE.Group();
    const g = new THREE.Group();
    g.scale.setScalar(0.1);
    const part = box(2); // radius ~1.7 m, ~0.17 m in the world
    g.add(part);
    root.add(g);
    trimCasters(root, SMALL_CASTER_M);
    expect(part.castShadow).toBe(false);
  });

  it('leaves instanced and skinned meshes alone and looks at each mesh once', () => {
    const root = new THREE.Group();
    const rocks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial(), 50);
    rocks.castShadow = true;
    const later = box(0.1);
    root.add(rocks, later);
    trimCasters(root, SMALL_CASTER_M);
    expect(rocks.castShadow).toBe(true);
    later.castShadow = true; // a part that asks for its shadow again keeps it
    expect(trimCasters(root, SMALL_CASTER_M)).toBe(0);
    expect(later.castShadow).toBe(true);
  });
});

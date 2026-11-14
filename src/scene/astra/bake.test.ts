import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bake } from './bake';
import { addDetail, DETAIL } from '../../vendor/astra/scene/surface';

const box = (mat: THREE.Material, x = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  m.position.x = x;
  return m;
};
const meshes = (g: THREE.Object3D) => {
  const out: THREE.Mesh[] = [];
  g.traverse((o) => (o as THREE.Mesh).isMesh && out.push(o as THREE.Mesh));
  return out;
};

describe('bake: static parts of a procedural model become a few meshes', () => {
  it('plain paints of the same finish share one vertex-coloured mesh', () => {
    const g = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: '#ff0000', roughness: 0.6, metalness: 0.1 });
    const blue = new THREE.MeshStandardMaterial({ color: '#0000ff', roughness: 0.6, metalness: 0.1 });
    g.add(box(red, 0), box(blue, 2), box(red, 4));
    bake(g, { keep: [], live: [] });
    const out = meshes(g);
    expect(out).toHaveLength(1);
    expect(out[0].geometry.getAttribute('color')).toBeTruthy();
    expect((out[0].material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
    // the box at x = 4 keeps its place
    out[0].geometry.computeBoundingBox();
    expect(out[0].geometry.boundingBox!.max.x).toBeCloseTo(4.5);
  });

  it('kept parts (moving) and live materials (glow, lamps) stay their own', () => {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: '#888888' });
    const glow = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffcc66', emissiveIntensity: 1 });
    const wheel = box(paint, 3);
    g.add(box(paint, 0), box(glow, 1), box(glow, 2), wheel);
    bake(g, { keep: [wheel], live: [glow] });
    const out = meshes(g);
    expect(out).toContain(wheel);
    const glowing = out.filter((m) => m.material === glow);
    expect(glowing).toHaveLength(1); // the two glow boxes merged, still the same material (power can change it)
    expect(out).toHaveLength(3);
  });

  it('textured or transparent materials merge only with themselves', () => {
    const g = new THREE.Group();
    const glass = new THREE.MeshStandardMaterial({ color: '#99ccff', transparent: true, opacity: 0.3 });
    const paint = new THREE.MeshStandardMaterial({ color: '#888888' });
    g.add(box(glass, 0), box(glass, 2), box(paint, 4));
    bake(g, { keep: [], live: [] });
    const out = meshes(g);
    expect(out).toHaveLength(2);
    expect(out.some((m) => m.material === glass)).toBe(true);
  });
  it("paints with ASTRA's surface detail merge too, and the merged paint gets the same detail back", () => {
    const g = new THREE.Group();
    const a = addDetail(new THREE.MeshStandardMaterial({ color: '#cccccc', roughness: 0.5 }), DETAIL.paint);
    const b = addDetail(new THREE.MeshStandardMaterial({ color: '#444444', roughness: 0.5 }), DETAIL.paint);
    g.add(box(a, 0), box(b, 2));
    bake(g, { keep: [], live: [] });
    const out = meshes(g);
    expect(out).toHaveLength(1);
    expect((out[0].material as THREE.Material).userData.detail).toBe(DETAIL.paint);
  });
});

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bake, mergeWorld } from './bake';
import { addDetail, DETAIL } from '../../vendor/astra/scene/surface';
import { finalize } from '../../vendor/astra/scene/kit';

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

  it('mergeWorld joins the paints of several placed models, hides the originals, leaves moving parts alone', () => {
    const paint = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 });
    const a = new THREE.Group();
    a.add(box(paint('#ff0000'), 0));
    a.position.x = 10;
    const b = new THREE.Group();
    const wing = new THREE.Group();
    wing.add(box(paint('#00ff00'), 0));
    b.add(box(paint('#0000ff'), 0), wing);
    bake(a, { keep: [], live: [] });
    bake(b, { keep: [wing], live: [] });
    bake(wing, { keep: [], live: [] });
    wing.userData.moves = true;
    const merged = mergeWorld([a, b]);
    const out = meshes(merged);
    expect(out).toHaveLength(1);
    out[0].geometry.computeBoundingBox();
    expect(out[0].geometry.boundingBox!.max.x).toBeCloseTo(10.5); // world space: model a stood at x = 10
    expect(meshes(a).every((m) => !m.visible)).toBe(true);
    expect(meshes(wing).every((m) => m.visible)).toBe(true);
  });

  it("mergeWorld draws the contact patches of every building in one call per strength, still under them", () => {
    const patch = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    patch.userData.blob = true;
    const roots = [0, 8].map((x) => {
      const r = new THREE.Group();
      r.position.x = x;
      r.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), patch));
      return r;
    });
    const out = mergeWorld(roots).children as THREE.Mesh[];
    expect(out.length).toBe(1);
    expect(out[0].renderOrder).toBe(1);
    expect(out[0].receiveShadow).toBe(false);
    expect(out[0].castShadow).toBe(false);
    expect(roots.every((r) => !r.children[0].visible)).toBe(true);
  });

  it("ASTRA's finalize leaves a hidden part hidden (labels below full detail are not drawn on phones)", () => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial();
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.25), mat);
    label.visible = false;
    g.add(label, new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));
    finalize(g);
    const drawn = meshes(g).filter((m) => m.visible);
    expect(drawn.length).toBe(1);
    expect(drawn[0].geometry.getAttribute('position').count).toBe(24); // the box only
  });
});

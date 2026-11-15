import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bakeInterior } from './Interiors';

const part = (name: string, color: string, x: number) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  m.name = name;
  m.position.x = x;
  return m;
};

/** scene → root node → furniture (static) + a door the clip moves (with a handle on it), like the interior GLBs */
function interior() {
  const scene = new THREE.Group();
  const root = new THREE.Group();
  root.name = 'greenhouse_interior';
  const furniture = new THREE.Group();
  furniture.add(part('a', '#ff0000', 0), part('b', '#0000ff', 1), part('c', '#00ff00', 2));
  const door = part('greenhouse_door', '#ffffff', 3);
  door.add(part('handle', '#888888', 0.3));
  root.add(furniture, door);
  scene.add(root);
  const clip = new THREE.AnimationClip('DoorOpen', 1, [new THREE.NumberKeyframeTrack('greenhouse_door.rotation[y]', [0, 1], [0, 1.5])]);
  return { scene, root, door, clip };
}

describe('bakeInterior', () => {
  it('merges the static parts of one finish into one mesh and keeps the animated door', () => {
    const { scene, root, door, clip } = interior();
    bakeInterior(scene, [clip]);
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh));
    // door + its merged handle + one merged furniture mesh (three colours, one finish)
    expect(meshes.length).toBe(3);
    expect(scene.getObjectByName('greenhouse_door')).toBe(door);
    expect(door.parent).toBe(root);
    // the merged furniture hangs under the root node (the habitat's "hatch only" toggles the root's children)
    expect(root.children.some((c) => (c as THREE.Mesh).isMesh && c !== door)).toBe(true);
  });

  it('keeps the colours as vertex colours', () => {
    const { scene, root, clip } = interior();
    bakeInterior(scene, [clip]);
    const merged = root.children.find((c) => (c as THREE.Mesh).isMesh && c.name !== 'greenhouse_door') as THREE.Mesh;
    expect((merged.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
    expect(merged.geometry.getAttribute('color')).toBeTruthy();
  });

  it("keeps a quantised GLB's real size (meshopt: normalised Int16 positions, the node's scale undoes it)", () => {
    // a 4 m wide, 3 m tall room wall stored as int16 / 32767 with the node scaled ×4 (KHR_mesh_quantization)
    const q = new THREE.BufferGeometry();
    const pos = new Int16Array([-16384, 0, 0, 16384, 0, 0, 16384, 24575, 0]); // (−0.5, 0) (0.5, 0) (0.5, 0.75)
    q.setAttribute('position', new THREE.BufferAttribute(pos, 3, true));
    q.setAttribute('normal', new THREE.BufferAttribute(new Int8Array([0, 0, 127, 0, 0, 127, 0, 0, 127]), 3, true));
    const wall = new THREE.Mesh(q, new THREE.MeshStandardMaterial({ color: '#cccccc' }));
    wall.scale.setScalar(4);
    wall.position.set(0, 0, -2);
    const { scene, root, clip } = interior();
    root.add(wall);
    bakeInterior(scene, [clip]);
    const box = new THREE.Box3();
    for (const c of root.children) {
      const m = c as THREE.Mesh;
      if (!m.isMesh || c.name === 'greenhouse_door') continue;
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox!);
    }
    expect(box.min.x).toBeCloseTo(-2, 2);
    expect(box.max.y).toBeCloseTo(3, 2);
    expect(box.min.z).toBeCloseTo(-2, 2); // (the wall stands at z −2)
  });

  it('a door clip still moves the door after baking', () => {
    const { scene, door, clip } = interior();
    bakeInterior(scene, [clip]);
    const mixer = new THREE.AnimationMixer(scene);
    const a = mixer.clipAction(clip);
    a.play();
    a.paused = true;
    a.time = 1;
    mixer.update(0);
    expect(door.rotation.y).toBeCloseTo(1.5);
  });
});

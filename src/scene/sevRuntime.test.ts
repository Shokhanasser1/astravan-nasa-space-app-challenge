// The crew rover as the game loads and moves it (drei's useGLTF = three-stdlib's GLTFLoader + MeshoptDecoder, a
// clone, the Drive clip on a mixer at the rover's speed, the steer pivots turned by applyRover): its wheels must
// turn and its wheel pairs must steer — checked on the world pose of the wheel meshes, what the player sees.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, MeshoptDecoder } from 'three-stdlib';
import { applyRover, rover } from './arrival';

// (node has no Image: three-stdlib's WebP extension probes for one; textures are not loaded here anyway)
const g0 = globalThis as unknown as { Image?: unknown };
g0.Image ??= class {
  onload?: () => void;
  height = 1;
  set src(_v: string) {
    setTimeout(() => this.onload?.());
  }
};

async function loadLikeDrei() {
  const buf = readFileSync(fileURLToPath(new URL('../../public/models/nasa-decor/sev.glb', import.meta.url)));
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(typeof MeshoptDecoder === 'function' ? (MeshoptDecoder as () => unknown)() : MeshoptDecoder);
  loader.register(((parser: { loadImageSource?: unknown }) => {
    parser.loadImageSource = () => Promise.resolve(new THREE.Texture());
    return { name: 'node_no_images' };
  }) as never);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((res, rej) => loader.parse(ab, '', res as never, rej));
}

const worldQ = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());

describe('crew rover in the game (Decor + applyRover)', () => {
  it('wheels turn with the mixer at the rover speed and the pairs steer', async () => {
    const g = await loadLikeDrei();
    const obj = g.scene.clone(true);
    const mixer = new THREE.AnimationMixer(obj);
    mixer.clipAction(g.animations.find((a) => a.name === 'Drive')!).play();
    rover.steerParts = [];
    obj.traverse((n) => {
      const m = /^sev_steer_[LR]([123])$/.exec(n.name);
      if (m) rover.steerParts.push({ node: n, k: m[1] === '1' ? 1 : m[1] === '3' ? -1 : 0 });
    });
    rover.object = obj;
    expect(rover.steerParts).toHaveLength(6);
    const mesh = obj.getObjectByName('sev_wheel_L1_mesh')!;
    expect(mesh).toBeTruthy();

    // one frame like Decor's useFrame: applyRover, then the mixer at the rover's speed
    const frame = (dt: number) => {
      applyRover();
      mixer.timeScale = rover.speed / 1.0;
      mixer.update(Math.min(dt, 0.05));
      obj.updateMatrixWorld(true);
    };
    rover.speed = 0;
    rover.steer = 0;
    frame(1 / 60);
    const q0 = worldQ(mesh);
    // drive 0.5 s at 1.5 m/s: the wheel (r 0.289 m) turns ~2.6 rad
    rover.speed = 1.5;
    let turned = 0;
    let q = q0.clone();
    for (let i = 0; i < 30; i++) {
      frame(1 / 60);
      const qn = worldQ(mesh);
      turned += q.angleTo(qn);
      q = qn;
    }
    expect(turned).toBeGreaterThan(2);
    // steer: the front pair turns about the vertical
    rover.speed = 0;
    frame(1 / 60);
    const before = worldQ(mesh);
    rover.steer = 0.4;
    frame(1 / 60);
    const after = worldQ(mesh);
    expect(before.angleTo(after)).toBeGreaterThan(0.3);
    rover.steer = 0;
    rover.object = null;
    rover.steerParts = [];
  });
});

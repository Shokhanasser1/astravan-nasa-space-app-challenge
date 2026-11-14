// The astronaut's clips, played by AnimController as the game plays them (model moved at the body's speed):
// boots stay planted on the ground and the reported footfalls (boot prints) land under the boots, alternate
// left/right and are one stride apart. Loads the shipped GLB (meshopt, no images in node).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { AnimController, CLIP_SPEED } from './anim.js';

const GLB = fileURLToPath(new URL('../../public/models/astronaut/astronaut.glb', import.meta.url));

let gltf: GLTF;
beforeAll(async () => {
  const buf = readFileSync(GLB);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register((parser) => {
    parser.loadImageSource = () => Promise.resolve(new THREE.Texture());
    return { name: 'node_no_images' };
  });
  gltf = await loader.parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
});

type Print = { x: number; z: number; yaw: number; side: string; t: number };

/** Walk the astronaut straight along +Z at `speed` for `seconds`; returns the prints and the worst boot drift. */
function stroll(speed: number, running: boolean, seconds: number) {
  const model = gltf.scene;
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  const clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
  const anim = new AnimController(model, clips);
  const dt = 1 / 60;
  const prints: Print[] = [];
  let drift = 0;
  for (let t = 0; t < seconds; t += dt) {
    model.position.z += speed * dt;
    anim.update(dt, {
      onGround: true, windup: -1, vy: 0, v0: 1.2, speed, carrying: false, pouring: false, running, k: 1,
    });
    for (const f of anim.footfalls) if (t > 0.8) prints.push({ ...f, t });
    anim.footfalls.length = 0;
    // a boot that was just printed must stay on its print for the next 0.1 s (planted, not sliding)
    for (const p of prints) {
      if (t - p.t > 0 && t - p.t <= 0.1) {
        const b = anim.bootOnGround(p.side as 'L' | 'R')!;
        drift = Math.max(drift, Math.hypot(b.x - p.x, b.z - p.z));
      }
    }
  }
  return { prints, drift, state: anim.state };
}

describe('astronaut clips as the game plays them', () => {
  for (const [label, speed, running, clip] of [
    ['walk 1.0 m/s', 1.0, false, 'Walk'],
    ['slow walk 0.7 m/s', 0.7, false, 'Walk'],
    ['lope 2.0 m/s', 2.0, true, 'Run'],
  ] as const) {
    it(`${label}: boots planted, prints alternate one step apart under the boots`, () => {
      const { prints, drift, state } = stroll(speed, running, 7);
      expect(state).toBe(clip);
      expect(prints.length).toBeGreaterThanOrEqual(4);
      for (let i = 1; i < prints.length; i++) expect(prints[i].side).not.toBe(prints[i - 1].side);
      // one cycle of the clip = two steps; the stride is the clip's planted speed × its length
      const stride = CLIP_SPEED[clip] * gltf.animations.find((c) => c.name === clip)!.duration;
      for (let i = 2; i < prints.length; i++) {
        expect(Math.abs(prints[i].z - prints[i - 2].z - stride)).toBeLessThan(0.04 * stride);
      }
      for (const p of prints) {
        expect(Math.abs(p.x)).toBeGreaterThan(0.08); // left and right of the walking line, not on it
        expect(Math.abs(p.x)).toBeLessThan(0.32);
        expect(Math.sign(p.x)).toBe(p.side === 'L' ? 1 : -1); // facing +Z the left boot is on +X
      }
      expect(drift).toBeLessThan(0.02);
    });
  }
});

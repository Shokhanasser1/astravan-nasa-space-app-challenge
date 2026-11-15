// The NASA decor machines move (public/models/nasa-decor, animated in Blender: blender/decor_anim): RASSOR digs with
// its front drum and the crew rover's wheels turn at the rate of its Drive clip's ground speed. Loads the shipped
// GLBs (meshopt, no images in node) and plays the clips the way Decor.tsx does.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

async function load(name: string): Promise<GLTF> {
  const buf = readFileSync(fileURLToPath(new URL(`../../public/models/nasa-decor/${name}`, import.meta.url)));
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register((parser) => {
    parser.loadImageSource = () => Promise.resolve(new THREE.Texture());
    return { name: 'node_no_images' };
  });
  return loader.parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
}

let rassor: GLTF;
let sev: GLTF;
beforeAll(async () => {
  [rassor, sev] = await Promise.all([load('rassor.glb'), load('sev.glb')]);
});

/** Play `clip` on a fresh clone and return a function that poses it at time t (seconds). */
function player(g: GLTF, clip: string) {
  const root = g.scene.clone(true);
  const mixer = new THREE.AnimationMixer(root);
  const c = g.animations.find((a) => a.name === clip)!;
  mixer.clipAction(c).play();
  return {
    root,
    clip: c,
    at(t: number) {
      mixer.setTime(t);
      root.updateMatrixWorld(true);
    },
  };
}

describe('RASSOR digs', () => {
  it('has its drums and arms as parts and an 8 s Dig loop', () => {
    for (const n of ['rassor_body', 'rassor_arm_front', 'rassor_arm_rear', 'rassor_drum_front', 'rassor_drum_rear', 'COL_rassor']) {
      expect(rassor.scene.getObjectByName(n), n).toBeTruthy();
    }
    const dig = rassor.animations.find((a) => a.name === 'Dig');
    expect(dig?.duration).toBeCloseTo(8, 1);
  });

  it('the front drum turns and goes down into the ground, then comes back', () => {
    const p = player(rassor, 'Dig');
    const drum = p.root.getObjectByName('rassor_drum_front')!;
    const y = (t: number) => (p.at(t), drum.getWorldPosition(new THREE.Vector3()).y);
    const rest = y(0);
    const deep = y(4.4);
    expect(rest - deep).toBeGreaterThan(0.06); // ~10 cm into the regolith
    expect(Math.abs(y(7.95) - rest)).toBeLessThan(0.01); // back where it started: the loop closes
    p.at(1);
    const q1 = drum.quaternion.clone();
    p.at(2);
    expect(q1.angleTo(drum.quaternion)).toBeGreaterThan(0.5); // turning (about a quarter turn a second)
  });
});

describe('crew rover (SEV) is ready to drive', () => {
  const R = 0.289; // wheel radius (m), measured in Blender

  it('has 12 wheels on 6 bogies and a Drive clip', () => {
    const names: string[] = [];
    sev.scene.traverse((o) => names.push(o.name));
    expect(names.filter((n) => /^sev_wheel_[LR]\d$/.test(n))).toHaveLength(12);
    expect(names.filter((n) => /^sev_bogie_[LR]\d$/.test(n))).toHaveLength(6);
    expect(sev.scene.getObjectByName('COL_sev')).toBeTruthy();
    expect(sev.animations.find((a) => a.name === 'Drive')).toBeTruthy();
  });

  it('wheels turn at the rate of 1.0 m/s on the ground', () => {
    const p = player(sev, 'Drive');
    const wheel = p.root.getObjectByName('sev_wheel_L1')!;
    // angle turned over 0.5 s, in small steps so a full turn is not missed
    let angle = 0;
    p.at(0.2);
    let q = wheel.quaternion.clone();
    for (let t = 0.25; t <= 0.7 + 1e-9; t += 0.05) {
      p.at(t);
      angle += q.angleTo(wheel.quaternion);
      q = wheel.quaternion.clone();
    }
    const speed = (angle / 0.5) * R;
    expect(speed).toBeGreaterThan(0.9);
    expect(speed).toBeLessThan(1.1);
  });
});

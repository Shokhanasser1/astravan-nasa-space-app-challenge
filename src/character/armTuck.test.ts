// Arms in by a wall (src/character/armTuck.ts) on the real astronaut model and its clips: the hands come within the
// body's wall distance, and nothing but the two arms moves (boots, so their prints, and the body stay the clips').
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { ArmTuck } from './armTuck';
import { ROOM_BODY } from '../walk/rooms';

const FILE = fileURLToPath(new URL('../../public/models/astronaut/astronaut.glb', import.meta.url));

async function load(): Promise<GLTF> {
  await MeshoptDecoder.ready;
  const buf = readFileSync(FILE);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register((parser) => {
    parser.loadImageSource = () => Promise.resolve(new THREE.Texture());
    return { name: 'node_no_images' };
  });
  return loader.parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
}

const at = (o: THREE.Object3D) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);

describe('arms in by a wall', () => {
  let gltf: GLTF;
  beforeAll(async () => {
    gltf = await load();
  });

  for (const clip of ['Idle', 'Walk', 'Run']) {
    it(`${clip}: the hands come within the indoor wall distance; boots and head do not move`, () => {
      const model = gltf.scene;
      // turned and moved like in the game: the tuck works in the body's own frame
      model.position.set(3, 0.5, -2);
      model.rotation.set(0, 1.1, 0);
      const mixer = new THREE.AnimationMixer(model);
      const c = gltf.animations.find((a) => a.name === clip)!;
      mixer.clipAction(c).play();
      const tuck = new ArmTuck(model);
      const max = ROOM_BODY + 0.03;
      const inv = new THREE.Matrix4();
      for (let t = 0; t < c.duration; t += c.duration / 8) {
        tuck.restore();
        mixer.setTime(t);
        model.updateMatrixWorld(true);
        const foot = at(model.getObjectByName('LeftFoot')!);
        const head = at(model.getObjectByName('Head')!);
        tuck.amount = 1;
        tuck.apply(model, 1, 1 / 60, max);
        inv.copy(model.matrixWorld).invert();
        for (const side of ['Left', 'Right']) {
          const hand = at(model.getObjectByName(`${side}Hand`)!).applyMatrix4(inv);
          expect(Math.abs(hand.x)).toBeLessThanOrEqual(max + 1e-3);
        }
        expect(at(model.getObjectByName('LeftFoot')!).distanceTo(foot)).toBeLessThan(1e-6);
        expect(at(model.getObjectByName('Head')!).distanceTo(head)).toBeLessThan(1e-6);
      }
      // let go: the clips' own arms come back (nothing builds up frame after frame)
      tuck.restore();
      mixer.setTime(0.3);
      model.updateMatrixWorld(true);
      const free = at(model.getObjectByName('LeftHand')!);
      tuck.amount = 0;
      expect(tuck.apply(model, 0, 1 / 60, max)).toBe(false);
      expect(at(model.getObjectByName('LeftHand')!).distanceTo(free)).toBeLessThan(1e-6);
      mixer.stopAllAction();
    });
  }
});

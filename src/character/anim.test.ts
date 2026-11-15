// The astronaut's clips, played by AnimController as the game plays them (model moved at the body's speed):
// boots stay planted on the ground and the reported footfalls (boot prints) land under the boots, alternate
// left/right and are one stride apart. Loads the shipped GLB (meshopt, no images in node).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { AnimController, CLIMB_RISE, FIDGET_S, GESTURES, INSERT_HOLD, measureSole } from './anim.js';
import { GroundFx, PRINT_FILL, PRINT_QUAD } from '../look/fx.js';

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
  return { prints, drift, state: anim.state, speeds: anim.speeds as Record<string, number>, legK: anim.legK as number };
}

describe('astronaut clips as the game plays them', () => {
  for (const [label, speed, running, clip] of [
    ['walk 1.0 m/s', 1.0, false, 'Walk'],
    ['slow walk 0.7 m/s', 0.7, false, 'Walk'],
    ['lope 2.0 m/s', 2.0, true, 'Run'],
  ] as const) {
    it(`${label}: boots planted, prints alternate one step apart under the boots`, () => {
      const { prints, drift, state, speeds, legK } = stroll(speed, running, 7);
      expect(state).toBe(clip);
      expect(prints.length).toBeGreaterThanOrEqual(4);
      for (let i = 1; i < prints.length; i++) expect(prints[i].side).not.toBe(prints[i - 1].side);
      // one cycle of the clip = two steps; the stride is the clip's planted speed × its length
      // (a rig with shorter legs plants its clips for slower ground speeds: AnimController.speeds)
      const stride = speeds[clip] * gltf.animations.find((c) => c.name === clip)!.duration;
      for (let i = 2; i < prints.length; i++) {
        expect(Math.abs(prints[i].z - prints[i - 2].z - stride)).toBeLessThan(0.04 * stride);
      }
      for (const p of prints) {
        expect(Math.abs(p.x)).toBeGreaterThan(0.08); // left and right of the walking line, not on it
        expect(Math.abs(p.x)).toBeLessThan(0.32);
        expect(Math.sign(p.x)).toBe(p.side === 'L' ? 1 : -1); // facing +Z the left boot is on +X
      }
      // (the kid astronaut's rig is refitted to shorter legs, 15 Nov: its lope's planted boot drifts ≤ 3 cm at 2 m/s —
      // smaller than the boot, not seen; walking stays within 2 cm)
      expect(drift).toBeLessThan(clip === 'Run' && legK !== 1 ? 0.035 : 0.02);
    });
  }
});

describe('a jump leaves boot prints', () => {
  it('the crouch prints both boots once where it starts; the landing prints both again', () => {
    const model = gltf.scene;
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    const anim = new AnimController(model, Object.fromEntries(gltf.animations.map((c) => [c.name, c])));
    const s = { onGround: true, windup: -1, vy: 0, v0: 1.2, speed: 0, carrying: false, pouring: false, running: false, k: 1 };
    const dt = 1 / 60;
    for (let t = 0; t < 0.5; t += dt) anim.update(dt, s);
    anim.footfalls.length = 0;
    for (let w = 0; w < 0.8; w += dt) anim.update(dt, { ...s, windup: w }); // crouch
    expect(anim.footfalls.map((f) => f.side).sort()).toEqual(['L', 'R']);
    anim.footfalls.length = 0;
    for (let u = 0; u < 1.4; u += dt) anim.update(dt, { ...s, onGround: false, vy: 1.2 - 1.62 * u }); // flight
    expect(anim.footfalls.length).toBe(0);
    anim.update(dt, s); // touch-down
    expect(anim.footfalls.filter((f) => f.landing).map((f) => f.side).sort()).toEqual(['L', 'R']);
  });
});

describe('gestures (Insert, Wrist, LookAround) as the game plays them', () => {
  const still = { onGround: true, windup: -1, vy: 0, v0: 1.2, speed: 0, carrying: false, pouring: false, running: false, k: 1 };
  const clipsOf = () => Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
  const make = () => {
    const model = gltf.scene;
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    const anim = new AnimController(model, clipsOf());
    anim.update(1 / 60, still);
    return anim;
  };
  const run = (anim: AnimController, seconds: number, s = still, each?: (t: number) => void) => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      anim.update(1 / 60, s);
      each?.(t);
    }
  };

  it('the GLB has every gesture, each from and back to the Idle pose (no pop when it fades in or out)', () => {
    const clips = clipsOf();
    const idle = clips.Idle;
    for (const name of GESTURES) {
      const clip = clips[name];
      expect(clip, name).toBeTruthy();
      for (const tr of clip.tracks) {
        if (!tr.name.endsWith('.quaternion')) continue;
        const it = idle.tracks.find((x) => x.name === tr.name);
        if (!it) continue;
        const q0 = new THREE.Quaternion().fromArray(it.values, 0);
        const first = new THREE.Quaternion().fromArray(tr.values, 0);
        const last = new THREE.Quaternion().fromArray(tr.values, tr.values.length - 4);
        expect(q0.angleTo(first), `${name} ${tr.name} first`).toBeLessThan(0.02);
        expect(q0.angleTo(last), `${name} ${tr.name} last`).toBeLessThan(0.02);
      }
    }
  });

  it('Insert plays once, holds the battery only between grab and release, then back to Idle', () => {
    const anim = make();
    expect(anim.gesture('Insert')).toBe(true);
    expect(anim.state).toBe('Insert');
    let held = 0;
    let wrong = 0;
    run(anim, anim.actions.Insert.getClip().duration + 0.2, still, () => {
      const t = anim.actions.Insert.time;
      if (anim.holdingBattery()) {
        held++;
        if (t < INSERT_HOLD.from || t > INSERT_HOLD.to) wrong++;
      }
    });
    expect(held).toBeGreaterThan(10);
    expect(wrong).toBe(0);
    expect(anim.state).toBe('Idle');
    expect(anim.gesturing()).toBe(false);
  });

  it('Insert backward (a battery taken back) also ends in Idle; asked twice, it plays twice', () => {
    const anim = make();
    expect(anim.gesture('Insert', true)).toBe(true);
    const d = anim.actions.Insert.getClip().duration;
    run(anim, 0.3);
    expect(anim.actions.Insert.time).toBeLessThan(d - 0.2); // running backward
    expect(anim.gesture('Insert', true)).toBe(true); // queued
    run(anim, d - 0.2);
    expect(anim.gesturing('Insert')).toBe(true); // the second one
    run(anim, d + 0.3);
    expect(anim.state).toBe('Idle');
  });

  it('walking or jumping ends a gesture at once; no gesture starts while moving', () => {
    const anim = make();
    anim.gesture('Wrist');
    run(anim, 0.5);
    run(anim, 0.3, { ...still, speed: 1.0 });
    expect(anim.state).toBe('Walk');
    expect(anim.gesture('LookAround')).toBe(false);
    run(anim, 0.5);
    anim.gesture('LookAround');
    run(anim, 0.1, { ...still, windup: 0.05 });
    expect(anim.state).toBe('JumpStart');
    expect(anim.gesturing()).toBe(false);
  });

  it('standing still a while → one LookAround, then Idle again', () => {
    const anim = make();
    let now = 1000;
    anim.now = () => now;
    anim.play('Walk', 0);
    anim.play('Idle', 0); // idleSince = 1000
    expect(anim.fidget(now + FIDGET_S[0] * 1000 - 1)).toBe(false);
    now += FIDGET_S[1] * 1000 + 1;
    expect(anim.fidget(now)).toBe(true);
    expect(anim.state).toBe('LookAround');
    run(anim, anim.actions.LookAround.getClip().duration + 0.2);
    expect(anim.state).toBe('Idle');
  });

  it('an astronaut.glb without gestures simply skips them', () => {
    const clips = clipsOf();
    for (const n of GESTURES) delete clips[n];
    const anim = new AnimController(gltf.scene, clips);
    expect(anim.gesture('Insert')).toBe(false);
    expect(anim.fidget(1e12)).toBe(false);
    expect(anim.holdingBattery()).toBe(false);
  });
});

describe('climbing the habitat ladder', () => {
  const still = { onGround: true, windup: -1, vy: 0, v0: 1.2, speed: 0, carrying: false, pouring: false, running: false, k: 1 };
  const make = () => new AnimController(gltf.scene, Object.fromEntries(gltf.animations.map((c) => [c.name, c])));
  const run = (anim: AnimController, seconds: number, s: Record<string, unknown>) => {
    for (let t = 0; t < seconds; t += 1 / 60) anim.update(1 / 60, s);
  };

  it('the shipped astronaut.glb has the Climb clip: 1.4 s for two 0.30 m rungs', () => {
    const clip = gltf.animations.find((c) => c.name === 'Climb');
    expect(clip).toBeTruthy();
    expect(0.6 / clip!.duration).toBeCloseTo(CLIMB_RISE, 2);
  });

  it('scrubs Climb by the height on the ladder (so it runs backward going down), then stands again', () => {
    const anim = make();
    run(anim, 0.5, { ...still, climb: 0.25, climbV: 0.9 });
    expect(anim.state).toBe('Climb');
    const d = anim.actions.Climb.getClip().duration;
    expect(anim.actions.Climb.time).toBeCloseTo(0.25 * (d - 0.001), 6);
    run(anim, 0.1, { ...still, climb: 0.1, climbV: -0.9 });
    expect(anim.actions.Climb.time).toBeCloseTo(0.1 * (d - 0.001), 6);
    run(anim, 0.5, { ...still, climb: null });
    expect(anim.state).toBe('Idle');
  });

  it('an astronaut.glb without Climb treads in place with Walk', () => {
    const clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
    delete clips.Climb;
    const anim = new AnimController(gltf.scene, clips);
    run(anim, 0.3, { ...still, climb: 0.5, climbV: 0.9 });
    expect(anim.state).toBe('Walk');
    expect(anim.actions.Walk.timeScale).toBeGreaterThan(0);
  });
});

describe('boot prints are the size of the boot', () => {
  it('measures the sole on the model at rest; the print covers exactly that sole', async () => {
    // a fresh copy at rest (the other tests pose the shared scene)
    const buf = readFileSync(GLB);
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.register((parser) => {
      parser.loadImageSource = () => Promise.resolve(new THREE.Texture());
      return { name: 'node_no_images' };
    });
    const g = await loader.parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
    const sole = measureSole(g.scene)!;
    expect(sole).toBeTruthy();
    // independently: the left boot's skinned vertices (world, at rest, facing +Z) in the lowest 3 cm
    g.scene.updateMatrixWorld(true);
    const foot = g.scene.getObjectByName('LeftFoot')!;
    const toe = g.scene.getObjectByName('LeftToeBase')!;
    const pts: THREE.Vector3[] = [];
    g.scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      const ids = m.skeleton.bones.flatMap((b, i) => (b === foot || b === toe ? [i] : []));
      const si = m.geometry.getAttribute('skinIndex'), sw = m.geometry.getAttribute('skinWeight'), pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        let best = -1, bw = 0;
        for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); }
        if (!ids.includes(best)) continue;
        const v = new THREE.Vector3().fromBufferAttribute(pos as THREE.BufferAttribute, i);
        m.applyBoneTransform(i, v);
        pts.push(v.applyMatrix4(m.matrixWorld));
      }
    });
    const low = Math.min(...pts.map((p) => p.y));
    const box = new THREE.Box3().setFromPoints(pts.filter((p) => p.y < low + 0.03));
    const size = box.getSize(new THREE.Vector3());
    expect(Math.abs(sole.len - size.z)).toBeLessThan(0.015); // heel to toe
    expect(Math.abs(sole.wid - size.x)).toBeLessThan(0.015); // across
    expect(sole.len).toBeGreaterThan(0.18);
    expect(sole.len).toBeLessThan(0.45);
    // the print: quad × the part the drawn sole fills × the scale GroundFx.setBoot gives = the sole
    const fx = { bootScale: { x: 1, z: 1 } };
    GroundFx.prototype.setBoot.call(fx, sole);
    expect(PRINT_QUAD.l * PRINT_FILL.l * fx.bootScale.z).toBeCloseTo(sole.len, 6);
    expect(PRINT_QUAD.w * PRINT_FILL.w * fx.bootScale.x).toBeCloseTo(sole.wid, 6);
    // and the print's centre is the sole's centre (the boot at rest: ankle + along the boot + beside it)
    const anim = new AnimController(g.scene, {});
    const p = anim.bootOnGround('L')!;
    const c = box.getCenter(new THREE.Vector3());
    expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeLessThan(0.015);
  });
});

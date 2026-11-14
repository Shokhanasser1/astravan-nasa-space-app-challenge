import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLOW, MAT } from '../parts/materials';
import {
  ANIMATED, BOTH_SIDES, BUILDINGS, HEIGHT, NO_SHADOW, REQUIRED_NODES, TWINS, kitProblems, lift, lookOf, prepare, sharedMaterial, spin, yaw,
  type Building,
} from './kit';

const named = (name: string) => new THREE.MeshStandardMaterial({ name });
const box = (w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], name = '') => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.name = name;
  return m;
};

/** A stand-in for a loaded GLB scene: what the Blender export gives (named nodes, palette material names). */
function fakeScene(b: Building, opts: { skip?: string } = {}) {
  const scene = new THREE.Group();
  const shell = box(2, 2, 2, named('panel'), `${b}_shell`);
  shell.position.y = 1;
  scene.add(shell);
  for (const n of REQUIRED_NODES[b]) {
    if (n === opts.skip) continue;
    const part = box(0.3, 0.3, 0.3, named('gold'), n);
    part.position.set(0.5, 0.5, 0.5);
    scene.add(part);
  }
  return scene;
}
const fullKit = () => Object.fromEntries(BUILDINGS.map((b) => [b, fakeScene(b)])) as unknown as Record<Building, THREE.Object3D>;

describe('palette material names → shared materials', () => {
  it('reads Blender names, with or without a .001 suffix, any case', () => {
    expect(lookOf('panel')).toBe('panel');
    expect(lookOf('Gold.002')).toBe('gold');
    expect(lookOf(' window_glow ')).toBe('window_glow');
    expect(lookOf('lambert2SG')).toBeNull();
    expect(lookOf(undefined)).toBeNull();
  });

  it('maps every palette name onto one shared material (one material set for grey shapes and models)', () => {
    expect(sharedMaterial('panel', true)).toBe(MAT.panel);
    expect(sharedMaterial('gold', true)).toBe(MAT.gold);
    expect(sharedMaterial('glass', true)).toBe(MAT.glass);
    expect(sharedMaterial('dome', false)).toBe(MAT.dome);
    expect(sharedMaterial('window_glow', true)).toBe(GLOW.window);
    expect(sharedMaterial('cable_glow', true)).toBe(GLOW.cableOn);
    expect(sharedMaterial('window_glow', false)).toBe(GLOW.dark);
    expect(sharedMaterial('cable_glow', false)).toBe(GLOW.dark);
  });

  it('double-sided twins: made once, same look, only for the NASA models with inside-out fragments', () => {
    const twin = sharedMaterial('panel', true, true) as THREE.MeshStandardMaterial;
    expect(twin).not.toBe(MAT.panel);
    expect(twin).toBe(sharedMaterial('panel', false, true)); // one object, reused
    expect(twin.side).toBe(THREE.DoubleSide);
    expect(twin.color.equals(MAT.panel.color)).toBe(true);
    expect([twin.roughness, twin.metalness]).toEqual([MAT.panel.roughness, MAT.panel.metalness]);
    expect(MAT.panel.side).toBe(THREE.FrontSide); // the grey shapes are untouched
    expect(TWINS.size).toBe(3);
    expect(sharedMaterial('dome', true, true)).toBe(MAT.dome);
    expect(sharedMaterial('window_glow', true, true)).toBe(GLOW.window);
    expect([...BOTH_SIDES].sort()).toEqual(['dish', 'lander', 'scout']);
  });

  it('glow materials stay unlit and out of tone mapping (only they pass Bloom)', () => {
    for (const m of [GLOW.window, GLOW.cableOn, GLOW.dark]) expect(m.toneMapped).toBe(false);
  });
});

describe('prepare(): clone, remap, shadows, fit', () => {
  const scene = () => {
    const s = new THREE.Group();
    const shell = box(3, 3.6, 3, [named('panel'), named('gold.001')], 'hab_shell');
    shell.position.y = 1.8;
    const win = box(0.5, 0.4, 0.02, named('window_glow'), 'glow_window');
    win.position.set(0, 2, 1.5);
    const bolt = box(0.1, 0.1, 0.1, named('panel'), 'bolt');
    const odd = box(0.2, 0.2, 0.2, named('lambert2SG'), 'odd');
    s.add(shell, win, bolt, odd);
    return s;
  };

  it('replaces palette materials with the shared ones and keeps unknown ones (reported)', () => {
    const p = prepare(scene(), 3.6);
    const shell = p.nodes.get('hab_shell') as THREE.Mesh;
    expect(shell.material).toEqual([MAT.panel, MAT.gold]);
    expect((p.nodes.get('glow_window') as THREE.Mesh).material).toBe(GLOW.window);
    expect(((p.nodes.get('odd') as THREE.Mesh).material as THREE.Material).name).toBe('lambert2SG');
    expect(p.unknown).toEqual(['lambert2SG']);
  });

  it('does not touch the loaded scene (a clone; geometry shared, not copied)', () => {
    const src = scene();
    const p = prepare(src, 3.6);
    const original = src.getObjectByName('hab_shell') as THREE.Mesh;
    expect((original.material as THREE.Material[])[0].name).toBe('panel');
    expect((p.nodes.get('hab_shell') as THREE.Mesh).geometry).toBe(original.geometry);
  });

  it('only big solid bodies cast and receive shadows; glow and small parts do not', () => {
    const p = prepare(scene(), 3.6);
    expect(p.nodes.get('hab_shell')!.castShadow).toBe(true);
    expect((p.nodes.get('hab_shell') as THREE.Mesh).receiveShadow).toBe(true);
    expect(p.nodes.get('glow_window')!.castShadow).toBe(false);
    expect(p.nodes.get('bolt')!.castShadow).toBe(false);
  });

  it('a part the scene turns every frame casts no shadow (the shadow map is redrawn only on demand)', () => {
    const withHead = () => {
      const s = scene();
      const head = new THREE.Group();
      head.name = 'dish_head';
      head.position.y = 2;
      head.add(box(1.6, 1.2, 1.6, named('panel'), 'reflector'));
      s.add(head);
      return s;
    };
    const casts = (p: ReturnType<typeof prepare>) => {
      const out: boolean[] = [];
      p.nodes.get('dish_head')!.traverse((o) => void ((o as THREE.Mesh).isMesh && out.push(o.castShadow || o.receiveShadow)));
      return out;
    };
    const plain = prepare(withHead(), 3.6, { animated: ['dish_head'] });
    expect(casts(plain)).toContain(true); // big enough to cast one: the option is what turns it off
    const kept = prepare(withHead(), 3.6, { animated: ['dish_head'], noShadow: ['dish_head'] });
    expect(casts(kept).length).toBeGreaterThan(0);
    expect(casts(kept)).not.toContain(true);
    expect(kept.nodes.get('hab_shell')!.castShadow).toBe(true);
  });

  it('the dish head and the workshop arm are the shadowless moving parts', () => {
    expect(NO_SHADOW.dish).toEqual(['dish_head']);
    expect(NO_SHADOW.workshop).toEqual(['arm']);
    for (const b of BUILDINGS) for (const n of NO_SHADOW[b]) expect(ANIMATED[b]).toContain(n);
  });

  it('scales to the real height, base on the ground', () => {
    const p = prepare(scene(), 7.2);
    p.root.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(p.root, true);
    expect(b.min.y).toBeCloseTo(0);
    expect(b.max.y).toBeCloseTo(7.2);
  });

  it('hides the model glow meshes by default: the code lamps are the glow in both looks', () => {
    const p = prepare(scene(), 3.6);
    expect(p.glows.map((m) => m.name)).toEqual(['glow_window']);
    expect(p.nodes.get('glow_window')!.visible).toBe(false);
    expect(p.nodes.get('hab_shell')!.visible).toBe(true);
    expect(prepare(scene(), 3.6, { showGlow: true }).nodes.get('glow_window')!.visible).toBe(true);
  });

  it('has a real height for every building', () => {
    for (const b of BUILDINGS) expect(HEIGHT[b]).toBeGreaterThan(1);
  });
});

describe('prepare(): static meshes merged per material (fewer draw calls)', () => {
  /** A rover: a body (panel + glass) and four glass wheels under empty pivots, one wheel mirrored. */
  const rover = () => {
    const s = new THREE.Group();
    const body = new THREE.Object3D();
    body.name = 'scout_body';
    body.add(box(1, 0.5, 1.4, named('panel'), 'body_panel'), box(0.9, 0.3, 0.2, named('glass'), 'body_glass'));
    body.position.y = 0.5;
    s.add(body);
    for (const [n, x, z] of [['fl', 0.5, 0.4], ['fr', -0.5, 0.4], ['rl', 0.5, -0.4], ['rr', -0.5, -0.4]] as const) {
      const pivot = new THREE.Object3D();
      pivot.name = `scout_wheel_${n}`;
      pivot.position.set(x, 0.2, z);
      const wheel = box(0.1, 0.4, 0.4, named('glass'), `wheel_${n}_mesh`);
      if (n === 'rr') wheel.scale.x = -1; // a mirrored copy, as Blender exports them
      pivot.add(wheel);
      s.add(pivot);
    }
    return s;
  };
  const stats = (o: THREE.Object3D) => {
    let meshes = 0;
    let tri = 0;
    o.updateWorldMatrix(true, true);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh || !m.visible) return;
      meshes++;
      tri += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
    });
    return { meshes, tri, box: new THREE.Box3().setFromObject(o, true) };
  };

  it('one mesh per material for what does not move; same triangles, same place', () => {
    const before = stats(prepare(rover(), 0.75, { animated: ['scout_wheel_fl', 'scout_wheel_fr', 'scout_wheel_rl', 'scout_wheel_rr'] }).root);
    const p = prepare(rover(), 0.75);
    const after = stats(p.root);
    expect(before.meshes).toBe(6);
    expect(after.meshes).toBe(2); // panel + glass
    expect(after.tri).toBe(before.tri);
    expect(after.box.min.distanceTo(before.box.min)).toBeLessThan(1e-5);
    expect(after.box.max.distanceTo(before.box.max)).toBeLessThan(1e-5);
    expect(p.owned).toHaveLength(1); // the merged glass; the single panel mesh stays as loaded
    expect(p.nodes.get('scout_wheel_fl')).toBeTruthy(); // pivots stay, empty
  });

  it('an animated node keeps its own meshes (merged inside it), apart from the static ones', () => {
    const p = prepare(rover(), 0.75, { animated: ['scout_wheel_fl'] });
    const fl = p.nodes.get('scout_wheel_fl')!;
    expect(fl.children.filter((c) => (c as THREE.Mesh).isMesh)).toHaveLength(1);
    expect(stats(p.root).meshes).toBe(3); // static panel, static glass (body + 3 wheels), the fl wheel
  });

  it('double-sided models merge their twin materials the same way', () => {
    const p = prepare(rover(), 0.75, { bothSides: true });
    const mats = new Set<THREE.Material>();
    p.root.traverse((o) => void ((o as THREE.Mesh).isMesh && mats.add((o as THREE.Mesh).material as THREE.Material)));
    expect([...mats].every((m) => m.side === THREE.DoubleSide)).toBe(true);
    expect(mats.size).toBe(2);
  });

  it('merged faces still face outwards, also for a mirrored node', () => {
    const p = prepare(rover(), 0.75);
    const glass = [...p.root.children].find((c) => c.name === 'static_glass') as THREE.Mesh;
    const g = glass.geometry;
    const [a, b, c, n, e1, e2] = Array.from({ length: 6 }, () => new THREE.Vector3());
    let agree = 0;
    const idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(g.attributes.position, idx.getX(i));
      b.fromBufferAttribute(g.attributes.position, idx.getX(i + 1));
      c.fromBufferAttribute(g.attributes.position, idx.getX(i + 2));
      n.fromBufferAttribute(g.attributes.normal, idx.getX(i));
      if (e1.subVectors(b, a).cross(e2.subVectors(c, a)).dot(n) > 0) agree++;
    }
    expect(agree).toBe(idx.count / 3);
  });
});

describe('all six or none: kitProblems()', () => {
  it('a full kit with every named part is usable', () => {
    expect(kitProblems(fullKit())).toEqual([]);
  });

  it('one missing file → the kit is not used (all grey)', () => {
    const kit: Partial<Record<Building, THREE.Object3D>> = fullKit();
    delete kit.garden;
    expect(kitProblems(kit)).toEqual(['garden: missing']);
    expect(kitProblems({})).toHaveLength(BUILDINGS.length);
  });

  it('a model without its named moving part → the kit is not used', () => {
    const kit = fullKit();
    kit.lander = fakeScene('lander', { skip: 'lander_body' });
    expect(kitProblems(kit)).toEqual(['lander: no node lander_body']);
  });

  it('names the parts the scene animates', () => {
    expect(REQUIRED_NODES.lander).toContain('lander_body');
    expect(REQUIRED_NODES.dish).toContain('dish_head');
    expect(REQUIRED_NODES.scout).toEqual(expect.arrayContaining(['scout_wheel_fl', 'scout_wheel_fr', 'scout_wheel_rl', 'scout_wheel_rr']));
  });
});

describe('motion helpers (from the rest pose, allocation-free)', () => {
  it('lift moves a node up in metres even when the model was scaled by fit()', () => {
    const s = new THREE.Group();
    const body = box(1, 1, 1, named('panel'), 'lander_body');
    body.position.y = 1.5;
    const base = box(2, 1, 2, named('gold'), 'lander_base');
    base.position.y = 0.5;
    s.add(body, base);
    s.scale.setScalar(100); // exported in centimetres: 2 units tall → fit scales by 0.02
    const p = prepare(s, 4);
    const top = p.nodes.get('lander_body')!;
    const y0 = top.getWorldPosition(new THREE.Vector3()).y;
    lift(top, 30);
    expect(top.getWorldPosition(new THREE.Vector3()).y - y0).toBeCloseTo(30);
    lift(top, 0);
    expect(top.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(y0);
  });

  it('yaw turns about the vertical axis from rest; spin rolls about the side axis', () => {
    const s = new THREE.Group();
    const head = box(1, 0.2, 1, named('panel'), 'dish_head');
    head.rotation.x = -0.6; // tilted towards the sky
    const wheel = box(0.15, 0.44, 0.44, named('glass'), 'scout_wheel_fl');
    s.add(head, wheel);
    const p = prepare(s, 1);
    const h = p.nodes.get('dish_head')!;
    const rest = h.quaternion.clone();
    yaw(h, Math.PI / 2);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(h.quaternion);
    expect(fwd.x).toBeGreaterThan(0.7); // +Z turned towards +X
    yaw(h, 0);
    expect(h.quaternion.angleTo(rest)).toBeCloseTo(0);

    const w = p.nodes.get('scout_wheel_fl')!;
    const pivot = w.position.clone();
    spin(w, Math.PI / 2);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(w.quaternion);
    expect(Math.abs(up.z)).toBeCloseTo(1); // rolled about X
    expect(w.position.equals(pivot)).toBe(true); // turns about its pivot, does not move
  });

  it('nodes without a rest pose (not prepared) are left alone', () => {
    const o = new THREE.Object3D();
    lift(o, 5);
    yaw(o, 1);
    spin(o, 1);
    expect(o.position.y).toBe(0);
    expect(o.quaternion.w).toBe(1);
  });
});

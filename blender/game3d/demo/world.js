// Oy karvonsaroyi — level / personaj / animatsiya yordamchilari.
// Faqat three.js ga bog'liq (DOM yo'q), shuning uchun Node smoke testida ham ishlaydi.
import * as THREE from 'three';
import { makeOBB, MOVE, BODY } from './physics.js';

// ---------------------------------------------------------------- name helpers
const hasPrefix = (o, p) => (o.name || '').startsWith(p);
function ancestorWith(o, test) {
  for (let a = o; a; a = a.parent) if (test(a)) return a;
  return null;
}

// ---------------------------------------------------------------- ground height index
/** XZ grid of world-space triangles; heightAt() = highest surface at (x, z). */
export class GroundIndex {
  constructor(meshes, cell = 2.0) {
    this.cell = cell;
    this.grid = new Map();
    this.tris = [];
    this.count = 0;
    this.bounds = new THREE.Box3();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (const mesh of meshes) {
      mesh.updateWorldMatrix(true, false);
      const pos = mesh.geometry.attributes.position;
      const idx = mesh.geometry.index;
      const n = idx ? idx.count : pos.count;
      for (let i = 0; i + 2 < n; i += 3) {
        const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
        a.fromBufferAttribute(pos, ia).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(pos, ib).applyMatrix4(mesh.matrixWorld);
        c.fromBufferAttribute(pos, ic).applyMatrix4(mesh.matrixWorld);
        const t = this.tris.length;
        this.tris.push([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z]);
        this.bounds.expandByPoint(a).expandByPoint(b).expandByPoint(c);
        const x0 = Math.floor(Math.min(a.x, b.x, c.x) / cell), x1 = Math.floor(Math.max(a.x, b.x, c.x) / cell);
        const z0 = Math.floor(Math.min(a.z, b.z, c.z) / cell), z1 = Math.floor(Math.max(a.z, b.z, c.z) / cell);
        for (let gx = x0; gx <= x1; gx++) {
          for (let gz = z0; gz <= z1; gz++) {
            const k = gx + ',' + gz;
            let arr = this.grid.get(k);
            if (!arr) this.grid.set(k, (arr = []));
            arr.push(t);
          }
        }
      }
    }
    this.count = this.tris.length;
  }

  heightAt(x, z) {
    const arr = this.grid.get(Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell));
    if (!arr) return null;
    let best = null;
    for (const t of arr) {
      const T = this.tris[t];
      const x1 = T[0], z1 = T[2], x2 = T[3], z2 = T[5], x3 = T[6], z3 = T[8];
      const d = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
      if (Math.abs(d) < 1e-12) continue;
      const l1 = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / d;
      const l2 = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const y = l1 * T[1] + l2 * T[4] + l3 * T[7];
      if (best === null || y > best) best = y;
    }
    return best;
  }
}

// ---------------------------------------------------------------- collision boxes
const _v = new THREE.Vector3();

/** OBB(s) from a collision mesh: one per connected part (joined boxes), else the mesh bbox. */
export function obbsFromMesh(mesh, name = mesh.name) {
  mesh.updateWorldMatrix(true, false);
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const parts = [];
  if (pos.count <= 4000) {
    // weld by position (1 mm), union-find over triangles
    const key = (i) => `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    const id = new Map();
    const vid = new Int32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const k = key(i);
      if (!id.has(k)) id.set(k, id.size);
      vid[i] = id.get(k);
    }
    const parent = new Int32Array(id.size).map((_, i) => i);
    const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const idx = geo.index;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i + 2 < n; i += 3) {
      const a = vid[idx ? idx.getX(i) : i], b = vid[idx ? idx.getX(i + 1) : i + 1], c = vid[idx ? idx.getX(i + 2) : i + 2];
      parent[find(b)] = find(a);
      parent[find(c)] = find(a);
    }
    const boxes = new Map();
    for (let i = 0; i < pos.count; i++) {
      const r = find(vid[i]);
      if (!boxes.has(r)) boxes.set(r, new THREE.Box3());
      boxes.get(r).expandByPoint(_v.fromBufferAttribute(pos, i));
    }
    for (const bb of boxes.values()) parts.push(bb);
  } else {
    geo.computeBoundingBox();
    parts.push(geo.boundingBox.clone());
  }
  const m = mesh.matrixWorld;
  const e = m.elements;
  const ax = new THREE.Vector3(e[0], e[1], e[2]);
  const ay = new THREE.Vector3(e[4], e[5], e[6]);
  const az = new THREE.Vector3(e[8], e[9], e[10]);
  const sx = ax.length(), sy = ay.length(), sz = az.length();
  ax.normalize(); ay.normalize(); az.normalize();
  return parts.filter((bb) => !bb.isEmpty()).map((bb) => {
    const c = bb.getCenter(new THREE.Vector3()).applyMatrix4(m);
    const h = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    return makeOBB(c.toArray(), [ax.toArray(), ay.toArray(), az.toArray()],
      [Math.max(h.x * sx, 0.01), Math.max(h.y * sy, 0.01), Math.max(h.z * sz, 0.01)], name);
  });
}

/**
 * Exact boxes from glTF extras (game3d/assets convention): userData.boxes = JSON string (or array) of
 * [cx, cy, cz, sx, sy, sz] in the collider node's own space. Returns null when there are none.
 */
export function obbsFromBoxes(node, name = node.name) {
  let boxes = node.userData && node.userData.boxes;
  if (typeof boxes === 'string') {
    try { boxes = JSON.parse(boxes); } catch (_) { return null; }
  }
  if (!Array.isArray(boxes) || !boxes.length) return null;
  node.updateWorldMatrix(true, false);
  const m = node.matrixWorld;
  const e = m.elements;
  const ax = new THREE.Vector3(e[0], e[1], e[2]);
  const ay = new THREE.Vector3(e[4], e[5], e[6]);
  const az = new THREE.Vector3(e[8], e[9], e[10]);
  const sx = ax.length(), sy = ay.length(), sz = az.length();
  ax.normalize(); ay.normalize(); az.normalize();
  const out = [];
  for (const b of boxes) {
    if (!Array.isArray(b) || b.length < 6) continue;
    const c = new THREE.Vector3(b[0], b[1], b[2]).applyMatrix4(m);
    out.push(makeOBB(c.toArray(), [ax.toArray(), ay.toArray(), az.toArray()],
      [Math.max(b[3] * sx / 2, 0.01), Math.max(b[4] * sy / 2, 0.01), Math.max(b[5] * sz / 2, 0.01)], name));
  }
  return out.length ? out : null;
}

/** Box in the object's own frame (all meshes, incl. hidden), ignoring its current transform. */
export function localBox(obj) {
  obj.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  const box = new THREE.Box3();
  const tmp = new THREE.Matrix4();
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    tmp.multiplyMatrices(inv, o.matrixWorld);
    box.union(o.geometry.boundingBox.clone().applyMatrix4(tmp));
  });
  return box;
}

/** Upright OBB around a bag at its current place (yaw only). */
export function bagOBB(bag) {
  const lb = bag.userData.localBox || localBox(bag);
  bag.updateWorldMatrix(true, false);
  const c = lb.getCenter(new THREE.Vector3()).applyMatrix4(bag.matrixWorld);
  const s = bag.getWorldScale(new THREE.Vector3());
  const h = lb.getSize(new THREE.Vector3()).multiplyScalar(0.5).multiply(s);
  const q = bag.getWorldQuaternion(new THREE.Quaternion());
  const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const ay = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const az = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  return makeOBB(c.toArray(), [ax.toArray(), ay.toArray(), az.toArray()], h.toArray(), 'BAGCOL_' + bag.name);
}

// ---------------------------------------------------------------- level parsing
/**
 * Reads a level scene: COL_ground (ground), COL_* (boxes), BAG_* (bags), SPAWN_player.
 * Returns { colliders, ground, bags, spawn:{pos,yaw}, groundSource, ice }
 */
export function parseLevel(root) {
  root.updateMatrixWorld(true);
  const groundMeshes = [];
  const colliders = [];
  const bags = [];
  const ice = [];
  let spawn = null;
  root.traverse((o) => {
    if (hasPrefix(o, 'BAG_') && !ancestorWith(o.parent, (a) => hasPrefix(a, 'BAG_'))) bags.push(o);
    if (hasPrefix(o, 'ICE_') && !ancestorWith(o.parent, (a) => hasPrefix(a, 'ICE_'))) ice.push(o);
    if (o.name === 'SPAWN_player' || hasPrefix(o, 'SPAWN_player')) {
      const p = o.getWorldPosition(new THREE.Vector3());
      const f = new THREE.Vector3(0, 0, 1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion()));
      spawn = { pos: p.toArray(), yaw: Math.atan2(f.x, f.z) };
    }
  });
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const doneBoxes = new Set();
  for (const o of meshes) {
    const col = ancestorWith(o, (a) => hasPrefix(a, 'COL_'));
    if (col) {
      o.visible = false;
      if (/^COL_ground/i.test(col.name)) {
        groundMeshes.push(o);
        continue;
      }
      const bag = ancestorWith(o, (a) => hasPrefix(a, 'BAG_'));
      if (doneBoxes.has(col)) continue;
      const exact = obbsFromBoxes(col, col.name);      // assets: exact boxes from glTF extras
      if (exact) doneBoxes.add(col);
      for (const b of exact || obbsFromMesh(o, col.name)) {
        b.bag = bag || null;
        colliders.push(b);
      }
    } else {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  }
  let groundSource = 'COL_ground';
  if (!groundMeshes.length) {
    const named = meshes.filter((m) => m.visible && /ground|terrain|regolith|surface|moon|oy_/i.test(m.name));
    if (named.length) {
      groundMeshes.push(...named);
      groundSource = 'name:' + named.map((m) => m.name).join(',');
    } else {
      let best = null, area = 0;
      for (const m of meshes) {
        if (!m.visible) continue;
        const bb = new THREE.Box3().setFromObject(m);
        const s = bb.getSize(new THREE.Vector3());
        if (s.x * s.z > area) { area = s.x * s.z; best = m; }
      }
      if (best) groundMeshes.push(best);
      groundSource = 'largest:' + (best ? best.name : 'none');
    }
  }
  const ground = new GroundIndex(groundMeshes);
  // bags without their own collider get an upright box
  for (const bag of bags) {
    bag.userData.localBox = localBox(bag);
    bag.userData.colliders = colliders.filter((c) => c.bag === bag);
    if (!bag.userData.colliders.length) {
      const b = bagOBB(bag);
      b.bag = bag;
      colliders.push(b);
      bag.userData.colliders = [b];
    }
  }
  return { colliders, ground, bags, spawn, groundSource, ice };
}

// ---------------------------------------------------------------- fallback level (no GLB yet)
export function buildFallbackLevel() {
  const root = new THREE.Group();
  root.name = 'fallback_level';
  const regolith = new THREE.MeshStandardMaterial({ color: 0x8b8a86, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 40, 40), regolith);
  ground.rotation.x = -Math.PI / 2;
  ground.name = 'ground';
  ground.receiveShadow = true;
  root.add(ground);
  const colGround = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 1, 1));
  colGround.rotation.x = -Math.PI / 2;
  colGround.name = 'COL_ground';
  root.add(colGround);
  // rocks (decor only)
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 1, flatShading: true });
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const r = 0.15 + rnd() * 0.6;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat);
    const a = rnd() * Math.PI * 2, d = 12 + rnd() * 80;
    rock.position.set(Math.cos(a) * d, r * 0.3, Math.sin(a) * d);
    rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    rock.scale.y = 0.6;
    root.add(rock);
  }
  // HDU stand-in (habitat, ~5.6 m wide) + SEV stand-in (rover, 4.5 m long)
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.7 });
  const hdu = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 3.6, 12), white);
  hdu.position.set(0, 1.8, -12);
  hdu.name = 'HDU_placeholder';
  root.add(hdu);
  for (const rot of [0, Math.PI / 4]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.6, 5.2));
    col.position.copy(hdu.position);
    col.rotation.y = rot;
    col.name = 'COL_hdu_' + (rot ? 'b' : 'a');
    root.add(col);
  }
  const sev = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.6, 4.5), white);
  sev.position.set(9, 1.6, -3);
  sev.rotation.y = 0.5;
  sev.name = 'SEV_placeholder';
  root.add(sev);
  const sevCol = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.2, 4.5));
  sevCol.position.set(9, 1.6, -3);
  sevCol.rotation.y = 0.5;
  sevCol.name = 'COL_sev';
  root.add(sevCol);
  // crew-lock bag stand-ins (CTB size 0.425 x 0.235 x 0.502 m, laid flat)
  const bagMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ef, roughness: 0.9 });
  const strap = new THREE.MeshStandardMaterial({ color: 0x3b6fd6, roughness: 0.8 });
  const bagSpots = [[2.5, 0, 2], [3.2, 0, 2.6], [-2.8, 0, 1.2], [-3.0, 0.235, 1.2]];
  bagSpots.forEach((p, i) => {
    const bag = new THREE.Group();
    bag.name = 'BAG_' + String(i + 1).padStart(2, '0');
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.425, 0.235, 0.502), bagMat);
    body.position.y = 0.1175;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.435, 0.06, 0.06), strap);
    band.position.set(0, 0.2, 0);
    bag.add(body, band);
    bag.position.set(p[0], p[1], p[2]);
    bag.rotation.y = i * 0.7;
    root.add(bag);
  });
  const spawn = new THREE.Object3D();
  spawn.name = 'SPAWN_player';
  spawn.position.set(0, 0, 4);
  spawn.rotation.y = Math.PI;          // face -Z: the bags and the base are in front
  root.add(spawn);
  return root;
}

// ---------------------------------------------------------------- character
export function setupCharacter(gltf) {
  const model = gltf.scene;
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
    }
  });
  const socket = model.getObjectByName('BagSocket');
  const clips = {};
  for (const c of gltf.animations) clips[c.name] = c;
  return { model, socket, clips };
}

/** Animation state machine with cross-fades: Idle / Walk / Run / Jump / Carry (+ CarryIdle, Pour). */
export class AnimController {
  constructor(model, clips) {
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const name of ['Idle', 'Walk', 'Run', 'Jump', 'Carry', 'Pour']) {
      if (clips[name]) this.actions[name] = this.mixer.clipAction(clips[name]);
    }
    if (clips.Pour) {
      const hold = clips.Pour.clone();
      hold.name = 'CarryIdle';
      this.actions.CarryIdle = this.mixer.clipAction(hold);   // Pour frame 0 = standing with the bag
    }
    const j = this.actions.Jump;
    if (j) {
      j.setLoop(THREE.LoopOnce, 1);
      j.clampWhenFinished = true;
    }
    this.current = null;
    this.state = '';
    this.play('Idle', 0);
  }

  play(name, fade = 0.25) {
    const next = this.actions[name];
    if (!next || this.current === next) return;
    next.reset();
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.paused = false;
    if (this.current && fade > 0) {
      next.fadeIn(fade);
      this.current.fadeOut(fade);
    } else if (this.current) {
      this.current.stop();
    }
    next.play();
    this.current = next;
    this.state = name;
  }

  /** s: { onGround, windup, vy, v0, speed, carrying, pouring, running, k } */
  update(dt, s) {
    const A = this.actions;
    if (!s.onGround || s.windup >= 0) {
      if (this.state !== 'Jump') {
        this.play('Jump', s.windup >= 0 ? 0.1 : 0.2);
        A.Jump.time = s.windup >= 0 ? 0.06 : 0.55;
      }
      A.Jump.paused = true;
      if (s.windup >= 0) {
        A.Jump.time = Math.min(0.06 + s.windup, 0.24);
      } else {
        const v0 = Math.max(s.v0 || 1.0, 0.3);
        const u = Math.min(1, Math.max(0, (v0 - s.vy) / (2 * v0)));
        A.Jump.time = Math.min(0.24 + u * 0.94, A.Jump.getClip().duration - 0.001);
      }
    } else if (s.carrying) {
      if (s.pouring && A.Pour) {
        this.play('Pour', 0.3);
      } else if (s.speed > 0.15) {
        this.play('Carry', 0.25);
        A.Carry.timeScale = THREE.MathUtils.clamp(s.speed / (MOVE.walk * s.k), 0.5, 2.0);
      } else {
        this.play('CarryIdle', 0.3);
        A.CarryIdle.paused = true;
        A.CarryIdle.time = 0;
      }
    } else if (s.speed > 0.15) {
      if (s.running && s.speed > 0.5 * (MOVE.walk + MOVE.run) * s.k) {
        this.play('Run', 0.25);
        A.Run.timeScale = THREE.MathUtils.clamp(s.speed / (MOVE.run * s.k), 0.6, 1.5);
      } else {
        this.play('Walk', 0.25);
        A.Walk.timeScale = THREE.MathUtils.clamp(s.speed / (MOVE.walk * s.k), 0.4, 1.8);
      }
    } else {
      this.play('Idle', 0.3);
    }
    this.mixer.update(dt);
  }
}

// ---------------------------------------------------------------- carrying a bag
export const HAND_GAP = 0.42;   // m between the palms in the Carry pose (CTB width 42.5 cm)

/** Put the bag in the hands (BagSocket bone). Disables its colliders. */
export function attachBag(bag, socket) {
  const lb = bag.userData.localBox || (bag.userData.localBox = localBox(bag));
  if (!bag.userData.origScale) bag.userData.origScale = bag.getWorldScale(new THREE.Vector3());
  for (const c of bag.userData.colliders || []) c.enabled = false;
  const size = lb.getSize(new THREE.Vector3()).multiply(bag.userData.origScale);
  // long horizontal side across the hands
  const turn = size.z > size.x;
  const across = turn ? size.z : size.x;
  const fit = THREE.MathUtils.clamp(HAND_GAP / Math.max(across, 1e-3), 0.6, 1.6);
  bag.userData.fit = fit;
  socket.add(bag);
  bag.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn ? Math.PI / 2 : 0);
  bag.scale.copy(bag.userData.origScale).multiplyScalar(fit);
  const c = lb.getCenter(new THREE.Vector3()).multiply(bag.scale).applyQuaternion(bag.quaternion);
  bag.position.copy(c).negate();
  return bag;
}

/** Put the bag on the ground in front of the player. Returns its new collider. */
export function dropBag(bag, scene, feetPos, yaw, groundHeightFn) {
  const lb = bag.userData.localBox;
  scene.attach(bag);
  bag.scale.copy(bag.userData.origScale || new THREE.Vector3(1, 1, 1));
  bag.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const size = lb.getSize(new THREE.Vector3()).multiply(bag.scale);
  const dist = BODY.radius + 0.5 * Math.max(size.x, size.z) + 0.12;
  const x = feetPos[0] + Math.sin(yaw) * dist;
  const z = feetPos[2] + Math.cos(yaw) * dist;
  const gy = groundHeightFn(x, z);
  const y = (gy === null ? feetPos[1] : gy);
  const c = lb.getCenter(new THREE.Vector3()).multiply(bag.scale).applyQuaternion(bag.quaternion);
  bag.position.set(x - c.x, y - lb.min.y * bag.scale.y, z - c.z);
  bag.updateMatrixWorld(true);
  const box = bagOBB(bag);
  box.bag = bag;
  bag.userData.colliders = [box];
  return box;
}

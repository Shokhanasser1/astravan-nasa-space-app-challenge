// Boulders and pebbles: two instanced meshes (two draw calls for all of them), part-buried, dusty on top,
// blocks thrown onto the rims of fresh craters. Rocks taller than a step get a collision box.
import * as THREE from 'three';
import { rng, noise } from './noise.js';
import { NEAR_R } from './terrain.js';

const STEP_UP = 0.35;   // physics.js MOVE.stepUp: lower rocks are stepped over

function rockGeometry(detail, seed, squash) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g = g.toNonIndexed();          // faceted, like fractured rock
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + 0.28 * noise(v.x * 1.9 + seed, v.z * 1.9 - seed, 3) + 0.14 * noise(v.y * 3.1, v.x * 3.1, 9);
    v.multiplyScalar(k);
    v.y *= squash;
    if (v.y < -0.3) v.y = -0.3 - (v.y + 0.3) * 0.15;   // a flat base, sitting in the soil
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  // dust settles on the upward faces
  const n = g.attributes.normal;
  const col = new Float32Array(p.count * 3);
  const rock = new THREE.Color('#77746e'), dust = new THREE.Color('#8d8a84'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const t = THREE.MathUtils.smoothstep(n.getY(i), 0.35, 0.85);
    c.copy(rock).lerp(dust, t);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

/** Pebbles are a few centimetres: 8 faces are enough (650 of them = 5k triangles). */
function pebbleGeometry() {
  const g = new THREE.OctahedronGeometry(1, 0);
  g.scale(1, 0.6, 1.2);
  g.translate(0, 0.15, 0);
  const n = g.attributes.position.count;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.42), 3));
  g.computeVertexNormals();
  return g;
}

/**
 * H: Heights. Returns { boulders, pebbles, colliders } — colliders are { x, y, z, sx, sy, sz, yaw } boxes
 * for rocks inside the walking area that are too tall to step over.
 */
export function buildRocks(H, { big: bigCount = 60, boulders = 200, pebbles = 700, play = 100, bigMin = 14, seed = 4242 } = {}) {
  const r = rng(seed);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, flatShading: true });
  // the biggest blocks get the rounder 80-face shape; the rest (and the pebbles) 20 faces
  const big = new THREE.InstancedMesh(rockGeometry(1, 1.3, 0.72), mat, bigCount);
  const mid = new THREE.InstancedMesh(rockGeometry(0, 2.7, 0.7), mat, boulders);
  const small = new THREE.InstancedMesh(pebbleGeometry(), mat, pebbles);
  for (const o of [big, mid]) {
    o.castShadow = true;
    o.receiveShadow = true;
  }
  small.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), t = new THREE.Vector3();
  const colliders = [];
  const place = (mesh, i, x, z, size, sink) => {
    const sy = size * (0.6 + 0.5 * r());
    const yaw = r() * Math.PI * 2;
    e.set((r() - 0.5) * 0.35, yaw, (r() - 0.5) * 0.35);
    q.setFromEuler(e);
    s.set(size * (0.8 + 0.5 * r()), sy, size * (0.8 + 0.5 * r()));
    const y = H.height(x, z) - sy * sink;
    t.set(x, y, z);
    m.compose(t, q, s);
    mesh.setMatrixAt(i, m);
    const top = y + sy * 0.72 * 1.1;
    if (mesh !== small && Math.abs(x) < play && Math.abs(z) < play && top - H.height(x, z) > STEP_UP) {
      colliders.push({ x, y: (H.height(x, z) + top) / 2, z, sx: s.x * 1.5, sy: top - H.height(x, z), sz: s.z * 1.5, yaw });
    }
  };
  const offPad = (x, z, margin) => H.padDist(x, z) > 1 + margin;
  // blocks on the rims of the freshest craters
  let n = 0;
  for (const c of H.craters) {
    if (c.fresh < 0.72 || c.R < 3.5) continue;
    const k = 3 + Math.floor(r() * 4);
    for (let j = 0; j < k && n < boulders * 0.3; j++) {
      const a = r() * Math.PI * 2, d = c.R * (0.95 + 0.5 * r());
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      if (!offPad(x, z, 0.15)) continue;
      place(mid, n++, x, z, 0.15 + 0.45 * Math.pow(r(), 2) * (c.R / 6), 0.3);
    }
  }
  // the big blocks: few, mostly away from the base
  let b = 0;
  while (b < bigCount) {
    const a = r() * Math.PI * 2, d = bigMin + Math.sqrt(r()) * (NEAR_R - bigMin - 2);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!offPad(x, z, 0.2)) continue;
    place(big, b++, x, z, 0.6 + 1.6 * Math.pow(r(), 2.5), 0.3);
  }
  // scattered boulders: many small, a few big, more of them farther out
  while (n < boulders) {
    const a = r() * Math.PI * 2, d = 6 + Math.sqrt(r()) * (NEAR_R - 8);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!offPad(x, z, 0.12)) continue;
    const size = 0.08 + 0.7 * Math.pow(r(), 3) * (0.4 + 0.6 * Math.min(1, d / 60));
    place(mid, n++, x, z, size, 0.32);
  }
  // pebbles: near the base, where you walk; a few on the graded pad too
  let p = 0;
  while (p < pebbles) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 70;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!offPad(x, z, 0) && r() > 0.25) continue;
    place(small, p++, x, z, 0.025 + 0.09 * Math.pow(r(), 2.5), 0.25);
  }
  for (const [o, name] of [[big, 'look_blocks'], [mid, 'look_boulders'], [small, 'look_pebbles']]) {
    o.instanceMatrix.needsUpdate = true;
    o.computeBoundingSphere();
    o.name = name;
  }
  return { big, boulders: mid, pebbles: small, colliders };
}

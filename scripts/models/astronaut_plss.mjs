// Replace the astronaut's backpack (PLSS) with a compact, modern one (15 Nov, Samandar: "smaller, more compact,
// more modern"). Works on the game GLB itself, so the rig and all 15 clips stay exactly as they are:
//   1. the old backpack = the body's triangles rigid on Spine2 (weight 1) behind the torso (z < 0: the suit faces +z);
//   2. they are dropped, and a new backpack — a rounded shell like the xEMU's, a dark back panel, side vents, a top
//      cap and one orange stripe (vertex colours, one material, one draw call) — is added to the same skinned mesh,
//      weight 1 on Spine2, so it rides the back in every clip.
// Usage: node scripts/models/astronaut_plss.mjs <in.glb> <out.glb>   then  npm run glb -- <out.glb> <final.glb> ...
import { NodeIO, Accessor } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const [input, output] = process.argv.slice(2);
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
const root = doc.getRoot();
const skin = root.listSkins()[0];
const joints = skin.listJoints();
const SPINE2 = joints.findIndex((j) => j.getName() === 'Spine2');
const ibm = skin.getInverseBindMatrices();
// mesh space → the rest pose (the same for every joint at rest: checked below)
const bindOf = (j) => new THREE.Matrix4().fromArray(joints[j].getWorldMatrix()).multiply(new THREE.Matrix4().fromArray(ibm.getElement(j, [])));
const W = bindOf(SPINE2);
if (bindOf(0).elements.some((x, i) => Math.abs(x - W.elements[i]) > 1e-4)) throw new Error('rest pose is not the bind pose');
const Winv = W.clone().invert();

const body = root.listMeshes().find((m) => m.getName() === 'Astronaut');
const suit = body.listPrimitives()[0];
const P = suit.getAttribute('POSITION'), J = suit.getAttribute('JOINTS_0'), Wt = suit.getAttribute('WEIGHTS_0');
const v = new THREE.Vector3(), p = [], j = [], w = [];
const isPack = new Uint8Array(P.getCount());
const old = new THREE.Box3();
for (let i = 0; i < P.getCount(); i++) {
  P.getElement(i, p);
  J.getElement(i, j);
  Wt.getElement(i, w);
  v.fromArray(p).applyMatrix4(W);
  const k = j.indexOf(SPINE2);
  if (k >= 0 && w[k] > 0.99 && v.z < 0) {
    isPack[i] = 1;
    old.expandByPoint(v);
  }
}
// 1. flatten the old backpack against the back: the model has no back under it (it was an open shell), so the old
//    pack's own faces become a 1 cm plate that closes the back, and the new pack sits on it
const PLATE = old.max.z - 0.01;
let moved = 0;
for (let i = 0; i < P.getCount(); i++) {
  if (!isPack[i]) continue;
  P.getElement(i, p);
  v.fromArray(p).applyMatrix4(W);
  // tucked behind the new pack: no plate below it at the hips or above it behind the helmet
  const x = Math.max(-0.3, Math.min(0.3, v.x)), y = Math.max(0.97, Math.min(1.62, v.y)), z = Math.max(PLATE, v.z);
  if (x !== v.x || y !== v.y || z !== v.z) {
    v.set(x, y, z).applyMatrix4(Winv).toArray(p);
    P.setElement(i, p);
    moved++;
  }
}
console.log(`old backpack flattened into the back plate: ${moved} vertices`);
const os = old.getSize(new THREE.Vector3());
console.log(`old backpack: ${os.x.toFixed(3)} wide × ${os.y.toFixed(3)} high × ${os.z.toFixed(3)} deep, z ${old.min.z.toFixed(3)}…${old.max.z.toFixed(3)}`);

// 2. the new backpack (rest pose, metres; the back is −z)
const lin = (hex) => new THREE.Color(hex); // three converts sRGB hex to linear, as glTF vertex colours are
const WHITE = lin('#e8ecf2'), GREY = lin('#a9b2c0'), DARK = lin('#2a3140'), ORANGE = lin('#ff8a3d');
// about an xEMU's proportions on a 1.85 m suit: shoulder blades to the small of the back, a hand's depth
const wd = os.x * 0.75, ht = os.y * 0.62, dp = Math.min(0.12, os.z * 0.52);
const front = old.max.z + 0.015; // a little into the back: no gap in any pose
const top = Math.min(old.max.y - 0.1, 1.66);
const cx = (old.min.x + old.max.x) / 2;
const cy = top - ht / 2;
const cz = front - dp / 2;
const back = front - dp;
const parts = [];
const part = (g, colour, x, y, z) => {
  g.translate(x, y, z);
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colour.toArray(col, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  parts.push(g);
};
part(new RoundedBoxGeometry(wd, ht, dp, 2, 0.035), WHITE, cx, cy, cz); // the shell
part(new RoundedBoxGeometry(wd * 0.7, ht * 0.6, 0.014, 1, 0.006), DARK, cx, cy - ht * 0.06, back + 0.003); // back panel
part(new RoundedBoxGeometry(wd * 0.7, 0.014, 0.01, 1, 0.003), ORANGE, cx, cy + ht * 0.3, back + 0.002); // stripe
part(new RoundedBoxGeometry(wd * 0.5, 0.03, dp * 0.7, 1, 0.01), GREY, cx, top + 0.01, cz); // top cap
for (const s of [-1, 1]) part(new RoundedBoxGeometry(0.012, ht * 0.38, dp * 0.55, 1, 0.004), DARK, cx + s * (wd / 2 - 0.002), cy, cz); // vents
const g = mergeGeometries(parts, false);
const n = g.attributes.position.count;

// into the body's mesh space (the inverse of the bind), weight 1 on Spine2
const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
const nm = new THREE.Matrix3().getNormalMatrix(Winv);
const nv = new THREE.Vector3();
for (let i = 0; i < n; i++) {
  v.fromBufferAttribute(g.attributes.position, i).applyMatrix4(Winv).toArray(pos, i * 3);
  nv.fromBufferAttribute(g.attributes.normal, i).applyMatrix3(nm).normalize().toArray(nor, i * 3);
}
const jnt = new Uint8Array(n * 4), wgt = new Float32Array(n * 4);
for (let i = 0; i < n; i++) {
  jnt[i * 4] = SPINE2;
  wgt[i * 4] = 1;
}
const buffer = root.listBuffers()[0];
const acc = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);
const mat = doc
  .createMaterial('AstronautPack')
  .setBaseColorFactor([1, 1, 1, 1])
  .setRoughnessFactor(0.55)
  .setMetallicFactor(0);
const prim = doc
  .createPrimitive()
  .setMaterial(mat)
  .setIndices(acc(g.index ? new Uint16Array(g.index.array) : Uint16Array.from({ length: n }, (_, i) => i), Accessor.Type.SCALAR))
  .setAttribute('POSITION', acc(pos, Accessor.Type.VEC3))
  .setAttribute('NORMAL', acc(nor, Accessor.Type.VEC3))
  .setAttribute('COLOR_0', acc(new Float32Array(g.attributes.color.array), Accessor.Type.VEC3))
  .setAttribute('JOINTS_0', acc(jnt, Accessor.Type.VEC4))
  .setAttribute('WEIGHTS_0', acc(wgt, Accessor.Type.VEC4));
if (!process.env.NOPACK) body.addPrimitive(prim);
console.log(`new backpack: ${((g.index ? g.index.count : n) / 3) | 0} triangles, ${wd.toFixed(3)} × ${ht.toFixed(3)} × ${dp.toFixed(3)} m`);
// (PLAIN=1: no meshopt, for Blender's importer to look at it; the game file goes through `npm run glb`)
if (process.env.PLAIN) for (const e of root.listExtensionsUsed()) if (e.extensionName === 'EXT_meshopt_compression') e.dispose();
await io.write(output, doc);

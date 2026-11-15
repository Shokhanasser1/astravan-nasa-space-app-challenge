// Put the kid astronaut (blender/kid_astronaut/build_kid.py) on the game's rig: the body of
// public/models/astronaut/astronaut.glb is replaced by the kid's parts, skinned to the same 23 bones, so all the
// clips (and the Battery prop in the right glove) work unchanged.
//   - each part follows the bones in its glTF extras ("bones"): a vertex is weighted to them by how near it is to each
//     bone (inverse distance to the bone's segment, ^4, at most 4): knees and elbows bend smoothly;
//   - parts merge into 4 draw calls: every plain paint in one vertex-coloured material, then the gold bands, the gold
//     visor (metal) and the clear bubble (transparent).
// Usage: node scripts/models/astronaut_kid.mjs <game astronaut.glb> <kid_parts.glb> <out.glb>
import { NodeIO, Accessor } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';

const [gamePath, kidPath, output] = process.argv.slice(2);
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(gamePath);
const kid = await io.read(kidPath);
const root = doc.getRoot();
const skin = root.listSkins()[0];
const joints = skin.listJoints();
const names = joints.map((j) => j.getName());
const ibm = skin.getInverseBindMatrices();
const bindOf = (j) => new THREE.Matrix4().fromArray(joints[j].getWorldMatrix()).multiply(new THREE.Matrix4().fromArray(ibm.getElement(j, [])));
const W = bindOf(0);
if (joints.some((_, j) => bindOf(j).elements.some((x, i) => Math.abs(x - W.elements[i]) > 1e-4))) throw new Error('rest pose is not the bind pose');
const Winv = W.clone().invert();
const nmat = new THREE.Matrix3().getNormalMatrix(Winv);

// each bone as a segment in the rest pose: its head to its children's (a leaf: a short stub along its parent)
const headOf = (j) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(joints[j].getWorldMatrix()));
const seg = joints.map((jn, j) => {
  const a = headOf(j);
  const kids = jn.listChildren().filter((c) => joints.includes(c));
  let b;
  if (kids.length) b = kids.map((c) => headOf(joints.indexOf(c))).reduce((s, v) => s.add(v), new THREE.Vector3()).divideScalar(kids.length);
  else {
    const p = jn.getParentNode();
    const pa = p && joints.includes(p) ? headOf(joints.indexOf(p)) : a.clone().sub(new THREE.Vector3(0, 0.1, 0));
    b = a.clone().add(a.clone().sub(pa).normalize().multiplyScalar(0.08));
  }
  return new THREE.Line3(a, b);
});
const near = new THREE.Vector3();
const distTo = (j, v) => seg[j].closestPointToPoint(v, true, near).distanceTo(v);

// the groups: plain paints share one vertex-coloured material
const GROUPS = {
  paint: { make: () => doc.createMaterial('KidPaint').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.7).setMetallicFactor(0) },
  kid_gold: { make: () => doc.createMaterial('KidGold').setBaseColorFactor([0.8, 0.42, 0.06, 1]).setRoughnessFactor(0.35).setMetallicFactor(0.4) },
  kid_visor: { make: () => doc.createMaterial('KidVisor').setBaseColorFactor([1, 0.68, 0.25, 1]).setRoughnessFactor(0.18).setMetallicFactor(1).setDoubleSided(true) },
  kid_glass: {
    make: () => doc.createMaterial('KidGlass').setBaseColorFactor([0.9, 0.95, 1, 0.14]).setRoughnessFactor(0.04).setMetallicFactor(0).setAlphaMode('BLEND').setDoubleSided(true),
  },
};
const acc = { };
for (const k of Object.keys(GROUPS)) acc[k] = { pos: [], nor: [], col: [], jnt: [], wgt: [], idx: [] };

const v = new THREE.Vector3(), n = new THREE.Vector3(), p = [], q = [];
let parts = 0;
for (const node of kid.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const bones = String(node.getExtras()?.bones ?? '').split(',').filter(Boolean).map((b) => names.indexOf(b));
  if (!bones.length || bones.some((b) => b < 0)) throw new Error(`part ${node.getName()}: unknown bones ${node.getExtras()?.bones}`);
  const M = new THREE.Matrix4().fromArray(node.getWorldMatrix());
  const Mn = new THREE.Matrix3().getNormalMatrix(M);
  for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial();
    const key = GROUPS[mat?.getName()] ? mat.getName() : 'paint';
    const g = acc[key];
    const base = g.pos.length / 3;
    const colour = mat?.getBaseColorFactor() ?? [1, 1, 1, 1];
    const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL');
    for (let i = 0; i < P.getCount(); i++) {
      v.fromArray(P.getElement(i, p)).applyMatrix4(M);
      n.fromArray(N.getElement(i, q)).applyMatrix3(Mn).normalize();
      // weights: nearer bones count more (^4), the four strongest kept
      const w = bones.map((b) => [b, 1 / Math.pow(distTo(b, v) + 0.02, 4)]).sort((x, y) => y[1] - x[1]).slice(0, 4);
      const sum = w.reduce((s, [, x]) => s + x, 0);
      for (let k = 0; k < 4; k++) {
        g.jnt.push(w[k] ? w[k][0] : 0);
        g.wgt.push(w[k] ? w[k][1] / sum : 0);
      }
      v.applyMatrix4(Winv);
      g.pos.push(v.x, v.y, v.z);
      n.applyMatrix3(nmat).normalize();
      g.nor.push(n.x, n.y, n.z);
      g.col.push(colour[0], colour[1], colour[2]);
    }
    const I = prim.getIndices();
    for (let i = 0; i < I.getCount(); i++) g.idx.push(base + I.getScalar(i));
    parts++;
  }
}

// the body's mesh gets the kid's primitives instead of the NASA suit's
const body = root.listMeshes().find((m) => m.getName() === 'Astronaut');
for (const prim of body.listPrimitives()) prim.dispose();
const buffer = root.listBuffers()[0];
const A = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);
let tris = 0;
for (const [key, g] of Object.entries(acc)) {
  if (!g.idx.length) continue;
  const count = g.pos.length / 3;
  const prim = doc
    .createPrimitive()
    .setMaterial(GROUPS[key].make())
    .setIndices(A(count > 65535 ? new Uint32Array(g.idx) : new Uint16Array(g.idx), Accessor.Type.SCALAR))
    .setAttribute('POSITION', A(new Float32Array(g.pos), Accessor.Type.VEC3))
    .setAttribute('NORMAL', A(new Float32Array(g.nor), Accessor.Type.VEC3))
    .setAttribute('JOINTS_0', A(new Uint8Array(g.jnt), Accessor.Type.VEC4))
    .setAttribute('WEIGHTS_0', A(new Float32Array(g.wgt), Accessor.Type.VEC4));
  if (key === 'paint') prim.setAttribute('COLOR_0', A(new Float32Array(g.col), Accessor.Type.VEC3));
  body.addPrimitive(prim);
  tris += g.idx.length / 3;
}
// drop what the old suit used and nothing else needs (its textures and materials)
for (const m of root.listMaterials()) if (!m.listParents().some((x) => x.propertyType === 'Primitive')) m.dispose();
for (const t of root.listTextures()) if (!t.listParents().some((x) => x.propertyType === 'Material')) t.dispose();
console.log(`kid astronaut: ${parts} parts, ${tris} triangles, ${Object.values(acc).filter((g) => g.idx.length).length} draw calls`);
if (process.env.PLAIN) for (const e of root.listExtensionsUsed()) if (e.extensionName === 'EXT_meshopt_compression') e.dispose();
await io.write(output, doc);

// The old kid astronaut's backpack on the new body, bigger and rigid (the lead, 15 Nov ~22:25: "the bag bigger and not
// moving, take it from the old model"): the old model's backpack triangles (behind its back) cut out at its rest pose,
// with their UVs and the old body's textures, scaled to PACK_H m tall and set on the new body's back, as a plain mesh
// node under the Spine2 joint (moves with the chest as one piece, never bends with the arms). The new body's own,
// thinner backpack stays inside it, hidden.
//   node scripts/models/backpack.mjs <old astronaut.glb> <new astronaut.glb> <out.glb>
import { NodeIO, Accessor } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';
import sharp from 'sharp';

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [oldPath, newPath, out] = process.argv.slice(2);
const P = JSON.parse(process.env.P ?? '{}');
/** The old backpack: behind CUT_Z (m, the old body's back is at ~−0.07), between these heights (old rest pose). */
const CUT_Z = P.cutZ ?? -0.11;
const CUT_Y = P.cutY ?? [0.7, 1.4];
const CUT_X = P.cutX ?? 0.28;
/**
 * The pack's height on the new body (m), how far its top sits below the shoulder joints, and where its front face goes
 * (z, m): a little inside the back, so the face never shows and the body's own thinner pack ends up inside this one.
 */
const PACK_H = P.h ?? 0.66;
const TOP_BELOW = P.top ?? 0.0;
const FRONT_Z = P.front ?? -0.0;
/** Width against the uniform scale (the old pack was broad for the old, narrower body; the sides must not show). */
const WIDTH = P.wx ?? 0.85;
const M4 = (a) => new THREE.Matrix4().fromArray(a);

/** Every skinned vertex of `doc` at its rest pose, in world space, per primitive. */
function restWorld(doc, prim, node) {
  const skin = node.getSkin();
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  const B = joints.map((j, i) => M4(j.getWorldMatrix()).multiply(M4(ibm.getElement(i, []))));
  const Pa = prim.getAttribute('POSITION'), Ja = prim.getAttribute('JOINTS_0'), Wa = prim.getAttribute('WEIGHTS_0');
  const out = [];
  const v = new THREE.Vector3(), t = new THREE.Vector3(), e = [], f = [];
  for (let i = 0; i < Pa.getCount(); i++) {
    v.fromArray(Pa.getElement(i, e));
    Ja.getElement(i, e);
    Wa.getElement(i, f);
    const acc = new THREE.Vector3();
    for (let k = 0; k < 4; k++) if (f[k] > 0) acc.add(t.copy(v).applyMatrix4(B[e[k]]).multiplyScalar(f[k]));
    out.push(acc);
  }
  return out;
}

// 1. the old backpack, cut out
const old = await io.read(oldPath);
const oNode = old.getRoot().listNodes().find((n) => n.getSkin() && n.getMesh()?.getName() === 'Astronaut');
const oPrim = oNode.getMesh().listPrimitives().find((p) => /KidAI/.test(p.getMaterial()?.getName() ?? '')) ?? oNode.getMesh().listPrimitives()[0];
const opos = restWorld(old, oPrim, oNode);
const inPack = (p) => p.z < CUT_Z && p.y > CUT_Y[0] && p.y < CUT_Y[1] && Math.abs(p.x) < CUT_X;
const idx = oPrim.getIndices();
const keep = [];
for (let i = 0; i < idx.getCount(); i += 3) {
  const a = idx.getScalar(i), b = idx.getScalar(i + 1), c = idx.getScalar(i + 2);
  if (inPack(opos[a]) && inPack(opos[b]) && inPack(opos[c])) keep.push(a, b, c);
}
if (keep.length < 300) throw new Error(`only ${keep.length / 3} backpack triangles: check CUT_*`);
const remap = new Map();
const used = [];
for (const v of keep) if (!remap.has(v)) { remap.set(v, used.length); used.push(v); }
const box = new THREE.Box3().setFromPoints(used.map((v) => opos[v]));
const size = box.getSize(new THREE.Vector3());
console.log(`old backpack: ${keep.length / 3} triangles, ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m`);

// 2. the new body's back, where the pack goes
const doc = await io.read(newPath);
const root = doc.getRoot();
const node = root.listNodes().find((n) => n.getSkin() && n.getMesh()?.getName() === 'Astronaut');
const jointW = (nm) => new THREE.Vector3().setFromMatrixPosition(M4(root.listNodes().find((n) => n.getName() === nm).getWorldMatrix()));
const sp2 = root.listNodes().find((n) => n.getName() === 'Spine2');
const shoulderY = jointW('LeftArm').y;
const k = PACK_H / size.y;
const top = shoulderY - TOP_BELOW;
// pack frame: centre in x, top at `top`, its front face (old box max z) at FRONT_Z
const place = new THREE.Matrix4().makeTranslation(0, top - k * size.y / 2, FRONT_Z - k * size.z / 2)
  .multiply(new THREE.Matrix4().makeScale(k * WIDTH, k, k))
  .multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2));
console.log(`front face at z ${FRONT_Z}, shoulders y ${shoulderY.toFixed(2)}; pack x${k.toFixed(2)} → ${(k * WIDTH * size.x).toFixed(2)} × ${(k * size.y).toFixed(2)} × ${(k * size.z).toFixed(2)} m`);

// 3. the mesh, in Spine2's frame at rest (a child of the joint: rigid with the chest)
const toLocal = M4(sp2.getWorldMatrix()).invert().multiply(place);
const nrm = new THREE.Matrix3().getNormalMatrix(toLocal);
const On = oPrim.getAttribute('NORMAL'), Ouv = oPrim.getAttribute('TEXCOORD_0');
const pos = new Float32Array(used.length * 3), nor = new Float32Array(used.length * 3), uv = new Float32Array(used.length * 2);
const v = new THREE.Vector3(), e = [];
used.forEach((o, i) => {
  v.copy(opos[o]).applyMatrix4(place).applyMatrix4(M4(sp2.getWorldMatrix()).invert()).toArray(pos, i * 3);
  if (On) v.fromArray(On.getElement(o, e)).applyMatrix3(nrm).normalize().toArray(nor, i * 3);
  if (Ouv) uv.set(Ouv.getElement(o, []), i * 2);
});
const buffer = root.listBuffers()[0];
const A = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);
const om = oPrim.getMaterial();
// only the part of the old body's texture the pack uses (its UV box, a few pixels round it), at most TEX_MAX px: the
// whole 1024 atlas twice (colour + normal) put the model over 1 MB
const TEX_MAX = P.tex ?? 512;
let u0 = 1, v0 = 1, u1 = 0, v1 = 0;
for (let i = 0; i < uv.length; i += 2) { u0 = Math.min(u0, uv[i]); u1 = Math.max(u1, uv[i]); v0 = Math.min(v0, uv[i + 1]); v1 = Math.max(v1, uv[i + 1]); }
const srcImg = om.getBaseColorTexture() ?? om.getNormalTexture();
const meta = srcImg ? await sharp(Buffer.from(srcImg.getImage())).metadata() : null;
const crop = meta && {
  left: Math.max(0, Math.floor(u0 * meta.width) - 4), top: Math.max(0, Math.floor(v0 * meta.height) - 4),
  right: Math.min(meta.width, Math.ceil(u1 * meta.width) + 4), bottom: Math.min(meta.height, Math.ceil(v1 * meta.height) + 4),
};
if (crop) {
  for (let i = 0; i < uv.length; i += 2) {
    uv[i] = (uv[i] * meta.width - crop.left) / (crop.right - crop.left);
    uv[i + 1] = (uv[i + 1] * meta.height - crop.top) / (crop.bottom - crop.top);
  }
  console.log(`pack texture: ${crop.right - crop.left} × ${crop.bottom - crop.top} px of the old ${meta.width} px atlas`);
}
async function copyTex(t) {
  if (!t) return null;
  const img = await sharp(Buffer.from(t.getImage()))
    .extract({ left: crop.left, top: crop.top, width: crop.right - crop.left, height: crop.bottom - crop.top })
    .resize({ width: TEX_MAX, height: TEX_MAX, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  return doc.createTexture(`pack_${t.getName() || 'tex'}`).setImage(new Uint8Array(img)).setMimeType('image/webp');
}
const mat = doc.createMaterial('KidPack').setBaseColorFactor(om.getBaseColorFactor()).setMetallicFactor(om.getMetallicFactor())
  .setRoughnessFactor(om.getRoughnessFactor());
const bc = await copyTex(om.getBaseColorTexture());
if (bc) mat.setBaseColorTexture(bc);
const nt = await copyTex(om.getNormalTexture());
if (nt) mat.setNormalTexture(nt);
const prim = doc.createPrimitive().setMaterial(mat)
  .setIndices(A(new Uint16Array(keep.map((x) => remap.get(x))), Accessor.Type.SCALAR))
  .setAttribute('POSITION', A(pos, Accessor.Type.VEC3)).setAttribute('NORMAL', A(nor, Accessor.Type.VEC3))
  .setAttribute('TEXCOORD_0', A(uv, Accessor.Type.VEC2));
const pack = doc.createNode('Backpack').setMesh(doc.createMesh('Backpack').addPrimitive(prim));
sp2.addChild(pack);
if (process.env.PLAIN) for (const x of root.listExtensionsUsed()) if (x.extensionName === 'EXT_meshopt_compression') x.dispose();
await io.write(out, doc);
console.log('wrote', out);

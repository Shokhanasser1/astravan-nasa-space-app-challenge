// The AI-made kid astronaut (Meshy image-to-3D on Higgsfield, from the team's concept picture) on the game's rig.
//   fit:      node astronaut_ai.mjs fit <ai.glb> <mesh_out.glb> <joints_out.json> [height]
//             scales the model (T-pose, y up, facing +z) to `height`, feet on the ground, and places the rig's 23
//             joints on its body from slices of the mesh (crotch, arm line, torso width, legs, hands)
//   (Blender) blender/kid_astronaut/bind_ai.py mesh_out.glb joints.json skinned.glb   -> bone-heat weights
//   assemble: node astronaut_ai.mjs assemble <game astronaut.glb> <skinned.glb> <joints.json> <out.glb>
//             moves the game rig's joints to the fitted places (rest translations, inverse bind matrices, and every
//             clip's translation keys shifted by the same amounts — rotations untouched, so the clips play the same
//             motion on the new proportions) and replaces the body with the skinned AI mesh (its textures kept).
import { NodeIO, Accessor } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [cmd, ...args] = process.argv.slice(2);
const M4 = (a) => new THREE.Matrix4().fromArray(a);

const PARENTS = {
  Hips: null, LeftUpLeg: 'Hips', LeftLeg: 'LeftUpLeg', LeftFoot: 'LeftLeg', LeftToeBase: 'LeftFoot',
  RightUpLeg: 'Hips', RightLeg: 'RightUpLeg', RightFoot: 'RightLeg', RightToeBase: 'RightFoot',
  Spine: 'Hips', Spine1: 'Spine', Spine2: 'Spine1', BagSocket: 'Spine2',
  LeftShoulder: 'Spine2', LeftArm: 'LeftShoulder', LeftForeArm: 'LeftArm', LeftHand: 'LeftForeArm',
  Neck: 'Spine2', Head: 'Neck',
  RightShoulder: 'Spine2', RightArm: 'RightShoulder', RightForeArm: 'RightArm', RightHand: 'RightForeArm',
};

if (cmd === 'fit') {
  const [aiPath, meshOut, jointsOut, hArg] = args;
  const H = Number(hArg ?? 1.7);
  const doc = await io.read(aiPath);
  const root = doc.getRoot();
  // every vertex in world space
  const pts = [];
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const W = M4(node.getWorldMatrix());
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION');
      const p = [];
      for (let i = 0; i < P.getCount(); i++) pts.push(new THREE.Vector3().fromArray(P.getElement(i, p)).applyMatrix4(W));
    }
  }
  const box = new THREE.Box3().setFromPoints(pts);
  const s = H / (box.max.y - box.min.y);
  const cx = (box.min.x + box.max.x) / 2;
  // the torso's middle in z, at half height
  const mid = pts.filter((v) => Math.abs(v.y - (box.min.y + box.max.y) / 2) < 0.03 / s && Math.abs(v.x - cx) < 0.1 / s);
  const cz = mid.length ? mid.reduce((a, v) => a + v.z, 0) / mid.length : (box.min.z + box.max.z) / 2;
  const T = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-cx, -box.min.y, -cz));
  for (const v of pts) v.applyMatrix4(T);
  // put the transform on the scene's root nodes, so the mesh file Blender reads is already fitted
  for (const scene of root.listScenes()) {
    for (const n of scene.listChildren()) {
      const holder = doc.createNode('fit').setMatrix(T.toArray());
      scene.removeChild(n);
      holder.addChild(n);
      scene.addChild(holder);
    }
  }
  await io.write(meshOut, doc);

  const slice = (f) => pts.filter(f);
  const mean = (a, k) => a.reduce((t, v) => t + v[k], 0) / Math.max(1, a.length);
  const halfSpan = Math.max(...pts.map((v) => Math.abs(v.x)));
  const armBand = slice((v) => Math.abs(v.x) > 0.72 * halfSpan);
  const armY = mean(armBand, 'y');
  // crotch: the lowest height (above the feet) with body at the middle line
  let crotch = 0.45 * H;
  for (let y = 0.12 * H; y < 0.7 * H; y += 0.004) {
    if (slice((v) => Math.abs(v.x) < 0.012 && Math.abs(v.y - y) < 0.006).length > 0) {
      crotch = y;
      break;
    }
  }
  const legBand = (y0, y1) => slice((v) => v.y > y0 && v.y < y1 && v.x > 0.01);
  const legX = (y) => mean(legBand(y - 0.02, y + 0.02), 'x');
  const legZ = (y) => mean(legBand(y - 0.02, y + 0.02), 'z');
  const torso = slice((v) => v.y > armY - 0.12 * H && v.y < armY - 0.07 * H && Math.abs(v.x) < 0.5 * halfSpan);
  const torsoW = Math.max(...torso.map((v) => Math.abs(v.x)));
  const armAt = (x) => {
    const a = slice((v) => v.x > x - 0.02 && v.x < x + 0.02 && Math.abs(v.y - armY) < 0.1 * H);
    return [mean(a, 'y'), mean(a, 'z')];
  };
  const hipY = crotch + 0.035 * H;
  const neckY = armY + 0.035 * H;
  const zT = 0.0;
  const J = {};
  const put = (n, x, y, z) => (J[n] = { pos: [+x.toFixed(4), +y.toFixed(4), +z.toFixed(4)], parent: PARENTS[n] });
  put('Hips', 0, hipY, zT);
  for (const [k, t] of [['Spine', 0.22], ['Spine1', 0.5], ['Spine2', 0.78]]) put(k, 0, hipY + (neckY - hipY) * t, zT);
  put('Neck', 0, neckY, zT);
  put('Head', 0, neckY + 0.07 * H, zT + 0.01);
  const ankleY = 0.07 * H;
  const upY = crotch - 0.01 * H;
  const kneeY = (upY + ankleY) / 2 + 0.01 * H;
  const shX = torsoW * 0.85;
  const handX = halfSpan - 0.075 * H;
  const elbowX = (shX + handX) / 2;
  const feet = slice((v) => v.y < 0.08 * H && v.x > 0.01);
  const toeZ = Math.max(...feet.map((v) => v.z));
  for (const [side, sx] of [['Left', 1], ['Right', -1]]) {
    // (the rig's Left is +x: its own left, as the model faces +z)
    put(`${side}UpLeg`, sx * legX(upY - 0.05 * H), upY, legZ(upY - 0.05 * H));
    put(`${side}Leg`, sx * legX(kneeY), kneeY, legZ(kneeY));
    put(`${side}Foot`, sx * legX(ankleY + 0.03 * H), ankleY, legZ(ankleY + 0.03 * H));
    put(`${side}ToeBase`, sx * legX(ankleY + 0.03 * H), 0.025 * H, toeZ * 0.75);
    put(`${side}Shoulder`, sx * torsoW * 0.25, armY - 0.01 * H, zT);
    const [ey, ez] = armAt(elbowX);
    // (the shoulder slice also catches the backpack: its depth from the elbow's instead)
    const [ay] = armAt(shX + 0.03);
    put(`${side}Arm`, sx * shX, ay, ez * 0.5);
    put(`${side}ForeArm`, sx * elbowX, ey, ez);
    const [hy, hz] = armAt(handX);
    put(`${side}Hand`, sx * handX, hy, hz);
  }
  // the battery is carried in front of the belly (the clips reach there): keep the old rig's offset, scaled
  const Sp2 = J.Spine2.pos;
  const k = H / 1.85;
  put('BagSocket', 0, Sp2[1] - 0.18 * k, 0.37 * k);
  writeFileSync(jointsOut, JSON.stringify(J, null, 1));
  console.log(`fit: height ${H} m (scale ${s.toFixed(3)}), crotch ${crotch.toFixed(3)}, arm line ${armY.toFixed(3)}, half span ${halfSpan.toFixed(3)}, torso half width ${torsoW.toFixed(3)}`);
} else if (cmd === 'assemble') {
  const [gamePath, skinnedPath, jointsPath, out] = args;
  const J = JSON.parse(readFileSync(jointsPath, 'utf8'));
  const doc = await io.read(gamePath);
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const joints = skin.listJoints();
  const byName = new Map(joints.map((j, i) => [j.getName(), i]));

  // 1. the rig's joints to their fitted places (top-down: each joint's new world from its parent's new world)
  const oldLocalT = new Map(joints.map((j) => [j, j.getTranslation().slice()]));
  const posOf = (n) => new THREE.Vector3().setFromMatrixPosition(M4(root.listNodes().find((x) => x.getName() === n).getWorldMatrix()));
  const legLen = () => posOf('LeftUpLeg').distanceTo(posOf('LeftLeg')) + posOf('LeftLeg').distanceTo(posOf('LeftFoot'));
  const oldLeg = legLen();
  const newWorld = new Map();
  const worldOf = (node) => {
    if (newWorld.has(node)) return newWorld.get(node);
    const p = node.getParentNode();
    const pw = p ? (joints.includes(p) ? worldOf(p) : M4(p.getWorldMatrix())) : new THREE.Matrix4();
    if (!joints.includes(node)) return M4(node.getWorldMatrix());
    const want = J[node.getName()];
    const local = M4(node.getMatrix());
    if (want) {
      const t = new THREE.Vector3(...want.pos).applyMatrix4(pw.clone().invert());
      node.setTranslation([t.x, t.y, t.z]);
      local.copy(M4(node.getMatrix()));
    }
    const w = pw.clone().multiply(local);
    newWorld.set(node, w);
    return w;
  };
  for (const j of joints) worldOf(j);
  const ibm = skin.getInverseBindMatrices();
  const ibmArr = new Float32Array(joints.length * 16);
  joints.forEach((j, i) => ibmArr.set(newWorld.get(j).clone().invert().toArray(), i * 16));
  ibm.setArray(ibmArr).setType('MAT4').setNormalized(false);

  // 2. every clip's translation keys follow the new rest; their motion (the hips' bob and sway) scales with the legs,
  //    so the boots stay planted (each sampler gets its own copy of its keys)
  const kLeg = legLen() / oldLeg;
  let shifted = 0;
  for (const anim of root.listAnimations()) {
    for (const ch of anim.listChannels()) {
      const node = ch.getTargetNode();
      if (ch.getTargetPath() !== 'translation' || !joints.includes(node)) continue;
      const now = node.getTranslation();
      const was = oldLocalT.get(node);
      const sampler = ch.getSampler();
      const src = sampler.getOutput();
      const vals = new Float32Array(src.getCount() * 3);
      const e = [];
      for (let i = 0; i < src.getCount(); i++) {
        src.getElement(i, e);
        vals.set([0, 1, 2].map((c) => now[c] + (e[c] - was[c]) * kLeg), i * 3);
      }
      sampler.setOutput(doc.createAccessor().setArray(vals).setType('VEC3').setBuffer(root.listBuffers()[0]));
      shifted++;
    }
  }

  // 3. the body: the skinned AI mesh instead of the old one
  const body = root.listMeshes().find((m) => m.getName() === 'Astronaut');
  const bodyNode = root.listNodes().find((n) => n.getMesh() === body);
  const Minv = M4(bodyNode.getWorldMatrix()).invert();
  for (const prim of body.listPrimitives()) prim.dispose();
  const src = await io.read(skinnedPath);
  const sskin = src.getRoot().listSkins()[0];
  const sj = sskin.listJoints();
  const sibm = sskin.getInverseBindMatrices();
  const remap = sj.map((n) => byName.get(n.getName()));
  if (remap.some((x) => x === undefined)) throw new Error('skinned file has unknown bones: ' + sj.map((n) => n.getName()).join(','));
  // a skinned vertex's place at rest: joint world × inverse bind × (the mesh node's world × v), as three.js does
  const Wsrc = M4(sj[0].getWorldMatrix()).multiply(M4(sibm.getElement(0, [])));
  const buffer = root.listBuffers()[0];
  const A = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);
  const texMap = new Map();
  const copyTex = (t) => {
    if (!t) return null;
    if (texMap.has(t)) return texMap.get(t);
    const n = doc.createTexture(t.getName()).setImage(t.getImage()).setMimeType(t.getMimeType()).setURI(t.getURI());
    texMap.set(t, n);
    return n;
  };
  let tris = 0;
  for (const mesh of src.getRoot().listMeshes()) {
    const holder = src.getRoot().listNodes().find((n) => n.getMesh() === mesh);
    const toLocal = Minv.clone().multiply(Wsrc).multiply(M4(holder.getWorldMatrix()));
    const nrm = new THREE.Matrix3().getNormalMatrix(toLocal);
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), UV = prim.getAttribute('TEXCOORD_0');
      const Js = prim.getAttribute('JOINTS_0'), Ws = prim.getAttribute('WEIGHTS_0');
      const n = P.getCount();
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), jnt = new Uint8Array(n * 4), wgt = new Float32Array(n * 4);
      const v = new THREE.Vector3(), e = [], f = [];
      for (let i = 0; i < n; i++) {
        v.fromArray(P.getElement(i, e)).applyMatrix4(toLocal).toArray(pos, i * 3);
        if (N) v.fromArray(N.getElement(i, e)).applyMatrix3(nrm).normalize().toArray(nor, i * 3);
        Js.getElement(i, e);
        Ws.getElement(i, f);
        const sum = f.reduce((a, b) => a + b, 0) || 1;
        for (let k = 0; k < 4; k++) {
          jnt[i * 4 + k] = f[k] > 0 ? remap[e[k]] : 0;
          wgt[i * 4 + k] = f[k] / sum;
        }
      }
      const I = prim.getIndices();
      const idx = I ? Array.from({ length: I.getCount() }, (_, i) => I.getScalar(i)) : Array.from({ length: n }, (_, i) => i);
      const sm = prim.getMaterial();
      const mat = doc.createMaterial('KidAI').setBaseColorFactor(sm?.getBaseColorFactor() ?? [1, 1, 1, 1])
        .setMetallicFactor(sm?.getMetallicFactor() ?? 0).setRoughnessFactor(sm?.getRoughnessFactor() ?? 0.8);
      if (sm) {
        const bc = copyTex(sm.getBaseColorTexture());
        if (bc) mat.setBaseColorTexture(bc);
        const nt = copyTex(sm.getNormalTexture());
        if (nt) mat.setNormalTexture(nt);
        const mr = copyTex(sm.getMetallicRoughnessTexture());
        if (mr) mat.setMetallicRoughnessTexture(mr);
      }
      const p = doc.createPrimitive().setMaterial(mat)
        .setIndices(A(n > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), Accessor.Type.SCALAR))
        .setAttribute('POSITION', A(pos, Accessor.Type.VEC3))
        .setAttribute('JOINTS_0', A(jnt, Accessor.Type.VEC4))
        .setAttribute('WEIGHTS_0', A(wgt, Accessor.Type.VEC4));
      if (N) p.setAttribute('NORMAL', A(nor, Accessor.Type.VEC3));
      if (UV) p.setAttribute('TEXCOORD_0', A(new Float32Array(UV.getArray()), Accessor.Type.VEC2));
      body.addPrimitive(p);
      tris += idx.length / 3;
    }
  }
  for (const m of root.listMaterials()) if (!m.listParents().some((x) => x.propertyType === 'Primitive')) m.dispose();
  for (const t of root.listTextures()) if (!t.listParents().some((x) => x.propertyType === 'Material')) t.dispose();
  if (process.env.PLAIN) for (const e of root.listExtensionsUsed()) if (e.extensionName === 'EXT_meshopt_compression') e.dispose();
  await io.write(out, doc);
  console.log(`assemble: legs x${kLeg.toFixed(3)}, ${joints.length} joints moved, ${shifted} translation channels shifted, ${tris} triangles, ${texMap.size} textures`);
} else {
  console.log('usage: fit <ai.glb> <mesh.glb> <joints.json> [height] | assemble <game.glb> <skinned.glb> <joints.json> <out.glb>');
}

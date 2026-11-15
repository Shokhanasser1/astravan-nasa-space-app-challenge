// A Meshy auto-rigged character (Higgsfield 3D, rigging on) → the input of `astronaut_ai.mjs assemble`, without Blender:
// the body at its bind pose, scaled to `height`, feet on the ground, facing +z, centred; Meshy's skin weights moved to
// the game rig's 23 joint names (a Meshy bone the game rig lacks gives its weight to its nearest mapped parent); the
// joints' places from Meshy's skeleton (joints.json, the same format `fit` writes).
//   node scripts/models/meshy_rig.mjs <meshy_rigged.glb> <skinned_out.glb> <joints_out.json> [height=1.7]
// then:
//   node scripts/models/astronaut_ai.mjs assemble public/models/astronaut/astronaut.glb <skinned_out.glb> <joints.json> <out.glb>
import { NodeIO, Accessor } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { writeFileSync } from 'node:fs';
import * as THREE from 'three';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const [src, out, jointsOut, hArg] = process.argv.slice(2);
const H = Number(hArg ?? 1.7);
const M4 = (a) => new THREE.Matrix4().fromArray(a);

const PARENTS = {
  Hips: null, LeftUpLeg: 'Hips', LeftLeg: 'LeftUpLeg', LeftFoot: 'LeftLeg', LeftToeBase: 'LeftFoot',
  RightUpLeg: 'Hips', RightLeg: 'RightUpLeg', RightFoot: 'RightLeg', RightToeBase: 'RightFoot',
  Spine: 'Hips', Spine1: 'Spine', Spine2: 'Spine1', BagSocket: 'Spine2',
  LeftShoulder: 'Spine2', LeftArm: 'LeftShoulder', LeftForeArm: 'LeftArm', LeftHand: 'LeftForeArm',
  Neck: 'Spine2', Head: 'Neck',
  RightShoulder: 'Spine2', RightArm: 'RightShoulder', RightForeArm: 'RightArm', RightHand: 'RightForeArm',
};
/** Meshy bone name (lower case, letters and digits only) → the game rig's joint. */
const key = (s) => s.toLowerCase().replace(/^mixamorig:?/, '').replace(/[^a-z0-9]/g, '');
const MAP = {
  hips: 'Hips', pelvis: 'Hips', spine: 'Spine', spine01: 'Spine1', spine1: 'Spine1', spine02: 'Spine2', spine2: 'Spine2',
  neck: 'Neck', head: 'Head',
};
for (const [s, S] of [['left', 'Left'], ['right', 'Right']]) {
  Object.assign(MAP, {
    [`${s}shoulder`]: `${S}Shoulder`, [`${s}arm`]: `${S}Arm`, [`${s}forearm`]: `${S}ForeArm`, [`${s}hand`]: `${S}Hand`,
    [`${s}upleg`]: `${S}UpLeg`, [`${s}leg`]: `${S}Leg`, [`${s}foot`]: `${S}Foot`, [`${s}toebase`]: `${S}ToeBase`,
  });
}

const doc = await io.read(src);
const root = doc.getRoot();
const meshNodes = root.listNodes().filter((n) => n.getMesh() && n.getSkin());
if (!meshNodes.length) throw new Error('no skinned mesh: was the model rigged?');
const skin = meshNodes[0].getSkin();
const sj = skin.listJoints();
console.log('meshy joints:', sj.map((j) => j.getName()).join(', '));
// Meshy counts its spine top-down (Hips → Spine02 → Spine01 → Spine → neck); Mixamo and the game rig bottom-up
if (sj.some((j) => key(j.getName()) === 'spine02')) Object.assign(MAP, { spine02: 'Spine', spine01: 'Spine1', spine: 'Spine2' });
const mapped = (j) => {
  for (let n = j; n; n = n.getParentNode()) {
    const g = MAP[key(n.getName())];
    if (g) return g;
  }
  return 'Hips';
};
const jointOf = sj.map(mapped);
const missing = Object.keys(PARENTS).filter((g) => g !== 'BagSocket' && !sj.some((j) => MAP[key(j.getName())] === g));
if (missing.length) console.warn('game joints with no Meshy bone (placed between neighbours):', missing.join(', '));

// bind pose: a vertex's place = Σ w · (joint world × inverse bind) × v
const ibm = skin.getInverseBindMatrices();
const B = sj.map((j, i) => M4(j.getWorldMatrix()).multiply(M4(ibm.getElement(i, []))));
const parts = [];
const all = [];
for (const node of meshNodes) {
  for (const prim of node.getMesh().listPrimitives()) {
    const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL');
    const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
    const n = P.getCount();
    const pos = [], nor = [], jw = [];
    const v = new THREE.Vector3(), t = new THREE.Vector3(), nv = new THREE.Vector3(), nt = new THREE.Vector3(), e = [], f = [];
    for (let i = 0; i < n; i++) {
      v.fromArray(P.getElement(i, e));
      J.getElement(i, e);
      W.getElement(i, f);
      const acc = new THREE.Vector3(), nacc = new THREE.Vector3();
      if (N) nv.fromArray(N.getElement(i, []));
      const wsum = {};
      for (let k = 0; k < 4; k++) {
        if (!(f[k] > 0)) continue;
        acc.add(t.copy(v).applyMatrix4(B[e[k]]).multiplyScalar(f[k]));
        if (N) nacc.add(nt.copy(nv).transformDirection(B[e[k]]).multiplyScalar(f[k]));
        const g = jointOf[e[k]];
        wsum[g] = (wsum[g] ?? 0) + f[k];
      }
      pos.push(acc);
      nor.push(nacc.normalize());
      jw.push(Object.entries(wsum).sort((a, b) => b[1] - a[1]).slice(0, 4));
      all.push(acc);
    }
    parts.push({ prim, pos, nor, jw });
  }
}

// scale to H, feet on the ground, centred in x and z, facing +z (toes ahead of the ankles)
const box = new THREE.Box3().setFromPoints(all);
const s = H / (box.max.y - box.min.y);
const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
const jw = (g) => {
  const j = sj.find((x) => MAP[key(x.getName())] === g);
  return j ? new THREE.Vector3().setFromMatrixPosition(M4(j.getWorldMatrix())) : null;
};
const ank = jw('LeftFoot'), toe = jw('LeftToeBase');
const flip = ank && toe && toe.z < ank.z ? -1 : 1; // Meshy faces +z; turn it round if its toes point -z
if (flip < 0) console.log('model faced -z: turned round');
const T = new THREE.Matrix4().makeRotationY(flip < 0 ? Math.PI : 0)
  .multiply(new THREE.Matrix4().makeScale(s, s, s))
  .multiply(new THREE.Matrix4().makeTranslation(-cx, -box.min.y, -cz));
const R3 = new THREE.Matrix3().getNormalMatrix(T);

// the joints' places (world, fitted); a game joint with no Meshy bone goes between its neighbours
const J = {};
const put = (g, v) => (J[g] = { pos: v.toArray().map((x) => +x.toFixed(4)), parent: PARENTS[g] });
for (const g of Object.keys(PARENTS)) {
  const p = jw(g);
  if (p) put(g, p.applyMatrix4(T));
}
const lerp = (a, b, t) => new THREE.Vector3(...J[a].pos).lerp(new THREE.Vector3(...J[b].pos), t);
if (!J.Spine1 && J.Spine && J.Neck) put('Spine1', lerp('Spine', 'Neck', 0.4));
if (!J.Spine2 && J.Spine1 && J.Neck) put('Spine2', lerp('Spine1', 'Neck', 0.5));
if (!J.Spine && J.Hips && J.Spine1) put('Spine', lerp('Hips', 'Spine1', 0.5));
for (const S of ['Left', 'Right']) {
  if (!J[`${S}Shoulder`] && J.Spine2 && J[`${S}Arm`]) put(`${S}Shoulder`, lerp('Spine2', `${S}Arm`, 0.35));
  if (!J[`${S}ToeBase`] && J[`${S}Foot`]) {
    const f = new THREE.Vector3(...J[`${S}Foot`].pos);
    put(`${S}ToeBase`, new THREE.Vector3(f.x, 0.025 * H, f.z + 0.09 * H));
  }
}
// the battery is carried in front of the belly (the clips reach there): the old rig's offset, scaled
const k = H / 1.85;
put('BagSocket', new THREE.Vector3(0, J.Spine2.pos[1] - 0.18 * k, 0.37 * k));
for (const g of Object.keys(PARENTS)) if (!J[g]) throw new Error(`no place for joint ${g}`);
writeFileSync(jointsOut, JSON.stringify(J, null, 1));

// the output skin: one node per game joint (world place, no rotation), inverse bind = its inverse; the mesh in fitted
// world space at the bind pose; joints/weights re-indexed by name
const names = Object.keys(PARENTS);
const buffer = root.listBuffers()[0];
const A = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);
const jNodes = names.map((g) => doc.createNode(g).setTranslation(J[g].pos));
const scene = root.listScenes()[0];
const rig = doc.createNode('Rig');
for (const n of jNodes) rig.addChild(n);
const ibmArr = new Float32Array(names.length * 16);
names.forEach((g, i) => ibmArr.set(new THREE.Matrix4().makeTranslation(...J[g].pos).invert().toArray(), i * 16));
const newSkin = doc.createSkin('Body').setInverseBindMatrices(A(ibmArr, 'MAT4'));
for (const n of jNodes) newSkin.addJoint(n);
const index = new Map(names.map((g, i) => [g, i]));
const body = doc.createMesh('Body');
let tris = 0;
for (const { prim, pos, nor, jw: jws } of parts) {
  const n = pos.length;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), JJ = new Uint8Array(n * 4), WW = new Float32Array(n * 4);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.copy(pos[i]).applyMatrix4(T).toArray(P, i * 3);
    v.copy(nor[i]).applyMatrix3(R3).normalize().toArray(N, i * 3);
    const sum = jws[i].reduce((a, [, w]) => a + w, 0) || 1;
    jws[i].forEach(([g, w], c) => {
      JJ[i * 4 + c] = index.get(g);
      WW[i * 4 + c] = w / sum;
    });
  }
  const p = doc.createPrimitive().setMaterial(prim.getMaterial()).setIndices(prim.getIndices())
    .setAttribute('POSITION', A(P, Accessor.Type.VEC3)).setAttribute('NORMAL', A(N, Accessor.Type.VEC3))
    .setAttribute('JOINTS_0', A(JJ, Accessor.Type.VEC4)).setAttribute('WEIGHTS_0', A(WW, Accessor.Type.VEC4));
  const uv = prim.getAttribute('TEXCOORD_0');
  if (uv) p.setAttribute('TEXCOORD_0', uv);
  body.addPrimitive(p);
  tris += (prim.getIndices()?.getCount() ?? n) / 3;
}
const holder = doc.createNode('Body').setMesh(body).setSkin(newSkin);
for (const c of scene.listChildren()) scene.removeChild(c);
scene.addChild(rig).addChild(holder);
for (const a of root.listAnimations()) a.dispose();
for (const n of root.listNodes()) if (n !== rig && n !== holder && !jNodes.includes(n)) n.dispose();
for (const sk of root.listSkins()) if (sk !== newSkin) sk.dispose();
for (const m of root.listMeshes()) if (m !== body) m.dispose();
await io.write(out, doc);
const leg = new THREE.Vector3(...J.LeftUpLeg.pos).distanceTo(new THREE.Vector3(...J.LeftLeg.pos)) +
  new THREE.Vector3(...J.LeftLeg.pos).distanceTo(new THREE.Vector3(...J.LeftFoot.pos));
console.log(`meshy_rig: height ${H} m (scale ${s.toFixed(3)}), hips ${J.Hips.pos[1].toFixed(3)} m, leg ${leg.toFixed(3)} m, ${tris} triangles`);

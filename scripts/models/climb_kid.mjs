// Re-make the Climb clip of the kid astronaut for the HDU ladder: hips BODY_BEHIND behind the rungs' plane, boots
// planted on rungs, wrists on rungs; replaces only the Climb animation's samplers (meshopt kept).
//   node scripts/models/climb_kid.mjs <astronaut.glb> <out.glb>   (15 Nov: the kid on the HDU ladder; audit #11–#14)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [src, out] = process.argv.slice(2);
const P = JSON.parse(process.env.P ?? '{}');
const BEHIND = P.behind ?? 0.42, HIPY = P.hipy ?? 0.45, LEAN = P.lean ?? 5, NOD = P.nod ?? -8;
const RUNG_R = 0.016, BALL_UP = RUNG_R + 0.037, BALL_Z = P.ballz ?? 0.0, FOOT_X = 0.085, HAND_X = 0.10;
const WRIST_UP = 0.03, WRIST_Z = -0.045;
const doc = await io.read(src);
const root = doc.getRoot();
const gnodes = root.listNodes();
const obj = new Map();
for (const n of gnodes) { const o = new THREE.Object3D(); o.name = n.getName(); o.position.fromArray(n.getTranslation()); o.quaternion.fromArray(n.getRotation()); o.scale.fromArray(n.getScale()); obj.set(n, o); }
const scene = new THREE.Object3D();
for (const n of gnodes) { const p = n.getParentNode(); (p ? obj.get(p) : scene).add(obj.get(n)); }
const O = (nm) => obj.get(gnodes.find((n) => n.getName() === nm));
const rest = new Map([...obj.values()].map((o) => [o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }]));
const anim = root.listAnimations().find((a) => a.getName() === 'Climb');
const chans = anim.listChannels().map((ch) => { const s = ch.getSampler(); const inp = s.getInput(), o = s.getOutput(); const n = inp.getCount(), es = o.getElementSize(); const times = [], vals = []; for (let i = 0; i < n; i++) { times.push(inp.getScalar(i)); vals.push(o.getElement(i, [])); } return { ch, s, node: obj.get(ch.getTargetNode()), path: ch.getTargetPath(), interp: s.getInterpolation(), times, vals }; });
const DUR = Math.max(...chans.map((c) => c.times.at(-1)));
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
function sample(c, t) { const { times, vals } = c; const n = times.length; if (t <= times[0]) return vals[0]; if (t >= times[n - 1]) return vals[n - 1]; let i = 0; while (times[i + 1] < t) i++; if (c.interp === 'STEP') return vals[i]; const u = (t - times[i]) / (times[i + 1] - times[i]); if (c.path === 'rotation') return qa.fromArray(vals[i]).slerp(qb.fromArray(vals[i + 1]), u).toArray(); return vals[i].map((v, k) => v + (vals[i + 1][k] - v) * u); }
function basePose(t) { for (const [o, r] of rest) { o.position.copy(r.p); o.quaternion.copy(r.q); o.scale.copy(r.s); } for (const c of chans) { const v = sample(c, t); if (c.path === 'translation') c.node.position.fromArray(v); else if (c.path === 'rotation') c.node.quaternion.fromArray(v); else c.node.scale.fromArray(v); } }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion());
const wp = (o) => o.getWorldPosition(new THREE.Vector3());
// rest world rotations (for hinge axes and the hand/foot frames)
for (const [o, r] of rest) { o.position.copy(r.p); o.quaternion.copy(r.q); }
scene.updateMatrixWorld(true);
const restW = new Map([...rest.keys()].map((o) => [o, wq(o)]));
const restWP = new Map([...rest.keys()].map((o) => [o, wp(o)]));
const B = {}; for (const nm of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftShoulder', 'RightShoulder']) B[nm] = O(nm);
const hingeLocal = (o, axisW) => axisW.clone().applyQuaternion(restW.get(o).clone().invert()).normalize();
const H = { LeftLeg: hingeLocal(B.LeftLeg, V(1, 0, 0)), RightLeg: hingeLocal(B.RightLeg, V(1, 0, 0)), LeftForeArm: hingeLocal(B.LeftForeArm, V(0, -1, 0)), RightForeArm: hingeLocal(B.RightForeArm, V(0, 1, 0)) };
function twoBone(r, m, e, T, pole, h) {
  scene.updateMatrixWorld(true);
  const A = wp(r), l1 = m.position.length(), l2 = e.position.length();
  const d = THREE.MathUtils.clamp(T.distanceTo(A), Math.abs(l1 - l2) + 1e-4, (l1 + l2) * 0.9995);
  const v1 = m.position.clone().applyQuaternion(m.quaternion.clone().invert()); // root→mid in mid frame
  const ev = e.position.clone();
  const ePar = h.clone().multiplyScalar(ev.dot(h)), ePerp = ev.clone().sub(ePar);
  const k0 = v1.dot(ePar), Ac = v1.dot(ePerp), Bc = v1.dot(h.clone().cross(ePerp));
  const R = Math.hypot(Ac, Bc), dl = Math.atan2(Bc, Ac);
  const c = (d * d - l1 * l1 - l2 * l2) / 2;
  const phi = dl + Math.acos(THREE.MathUtils.clamp((c - k0) / R, -1, 1));
  m.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(h, phi));
  scene.updateMatrixWorld(true);
  const E = wp(e), K = wp(m);
  const q1 = new THREE.Quaternion().setFromUnitVectors(E.clone().sub(A).normalize(), T.clone().sub(A).normalize());
  const u = T.clone().sub(A).normalize();
  const K1 = K.clone().sub(A).applyQuaternion(q1);
  const kp = K1.clone().sub(u.clone().multiplyScalar(K1.dot(u))).normalize(), pp = pole.clone().sub(u.clone().multiplyScalar(pole.dot(u))).normalize();
  const ang = Math.atan2(kp.clone().cross(pp).dot(u), kp.dot(pp));
  const q2 = new THREE.Quaternion().setFromAxisAngle(u, ang);
  const Wn = q2.multiply(q1).multiply(wq(r));
  r.quaternion.copy(wq(r.parent).invert().multiply(Wn));
  scene.updateMatrixWorld(true);
}
function setWorldRot(o, Wn) { scene.updateMatrixWorld(true); o.quaternion.copy(wq(o.parent).invert().multiply(Wn)); scene.updateMatrixWorld(true); }
const sm = (s) => s * s * (3 - 2 * s);
const herm = (s, a, b, ma, mb) => { const s2 = s * s, s3 = s2 * s; return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * ma + (-2 * s3 + 3 * s2) * b + (s3 - s2) * mb; };
const rungY = (m, ph) => 0.3 * m - 0.6 * ph;
// limb schedule: [swing start, swing end, rung index at the swing start]; one cycle = 2 rungs up
const SW = { LF: [0.02, 0.40, 0], RF: [0.52, 0.90, 1], RH: [0.22, 0.57, 3], LH: [0.72, 1.07, 4] };
function limb(k, ph) {
  const [t0, t1, m0] = SW[k]; const j = Math.floor(ph - t0), tc = ph - j;
  if (tc <= t1) { const s = (tc - t0) / (t1 - t0); const ya = rungY(m0 + 2 * j, t0 + j), yb = rungY(m0 + 2 * j + 2, t1 + j); const mv = -0.6 * (t1 - t0); return { y: herm(s, ya, yb, mv, mv), s, swing: true, rung: null }; }
  const m = m0 + 2 * j + 2; return { y: rungY(m, ph), s: 0, swing: false, rung: m };
}
const tgt = { LeftHip: null };
function posePhase(ph) {
  const w = 2 * Math.PI * ph;
  basePose(ph * DUR);
  B.Hips.position.set(0.012 * Math.cos(w - 2 * Math.PI * 0.25), HIPY + 0.012 * Math.sin(2 * w - 1.0), -BEHIND);
  B.Hips.quaternion.setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(2), THREE.MathUtils.degToRad(3 * Math.sin(w + 0.2)), THREE.MathUtils.degToRad(2 * Math.sin(w + 0.5)), 'YXZ'));
  const lean = THREE.MathUtils.degToRad(LEAN), tw = THREE.MathUtils.degToRad(-3 * Math.sin(w + 0.9));
  for (const [nm, f] of [['Spine', 0.4], ['Spine1', 0.35], ['Spine2', 0.25]]) B[nm].quaternion.copy(rest.get(B[nm]).q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(lean * f - THREE.MathUtils.degToRad(2) * (nm === 'Spine' ? 1 : 0), tw * f, 0, 'YXZ')));
  B.Neck.quaternion.copy(rest.get(B.Neck).q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(NOD * 0.4), 0, 0)));
  B.Head.quaternion.copy(rest.get(B.Head).q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(NOD * 0.6), THREE.MathUtils.degToRad(5 * Math.sin(w + 0.6)), 0)));
  scene.updateMatrixWorld(true);
  const res = {};
  for (const [k, side, sg] of [['LF', 'Left', 1], ['RF', 'Right', -1]]) {
    const L = limb(k, ph);
    const bump = L.swing ? Math.sin(Math.PI * L.s) : 0;
    const ball = V(sg * FOOT_X, L.y + BALL_UP + 0.04 * bump, BALL_Z - 0.13 * bump);
    const pitch = THREE.MathUtils.degToRad(L.swing ? -12 * bump : 0); // toes up in the swing
    const yaw = sg * THREE.MathUtils.degToRad(3);
    const R = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    const Ft = B[side + 'Foot'], Tb = B[side + 'ToeBase'];
    const fv = restWP.get(Tb).clone().sub(restWP.get(Ft)).applyQuaternion(R);
    const ankle = ball.clone().sub(fv);
    const pole = V(sg * 0.9, 0.5, -0.2);
    twoBone(B[side + 'UpLeg'], B[side + 'Leg'], Ft, ankle, pole, H[side + 'Leg']);
    setWorldRot(Ft, R.clone().multiply(restW.get(Ft)));
    res[k] = { want: ball, L };
  }
  for (const [k, side, sg] of [['LH', 'Left', 1], ['RH', 'Right', -1]]) {
    const L = limb(k, ph);
    const bump = L.swing ? Math.sin(Math.PI * L.s) : 0;
    const wrist = V(sg * HAND_X, L.y + WRIST_UP + 0.02 * bump, WRIST_Z - 0.12 * bump);
    const pole = V(sg * 0.55, -1.0, -0.35);
    twoBone(B[side + 'Arm'], B[side + 'ForeArm'], B[side + 'Hand'], wrist, pole, H[side + 'ForeArm']);
    const pitch = THREE.MathUtils.degToRad(L.swing ? 25 + 10 * (1 - bump) : 45);
    const R = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, -sg * Math.PI / 2 + sg * THREE.MathUtils.degToRad(10), 0, 'XYZ'));
    // R = Rx(pitch)·Ry(∓90°): the hand's rest direction (±x) to +z, then down over the rung
    const Rq = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), pitch).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -sg * Math.PI / 2 + sg * THREE.MathUtils.degToRad(10)));
    setWorldRot(B[side + 'Hand'], Rq.multiply(restW.get(B[side + 'Hand'])));
    res[k] = { want: wrist, L };
  }
  return res;
}
// bake
const N = 42; const times = [], keys = new Map();
const joints = Object.values(B);
let maxErr = { f: 0, h: 0 };
for (let i = 0; i <= N; i++) {
  const ph = (i % N) / N; const r = posePhase(ph);
  times.push((i / N) * DUR);
  scene.updateMatrixWorld(true);
  for (const k of ['LF', 'RF']) maxErr.f = Math.max(maxErr.f, wp(B[(k[0] === 'L' ? 'Left' : 'Right') + 'ToeBase']).distanceTo(r[k].want));
  for (const k of ['LH', 'RH']) maxErr.h = Math.max(maxErr.h, wp(B[(k[0] === 'L' ? 'Left' : 'Right') + 'Hand']).distanceTo(r[k].want));
  for (const o of [...rest.keys()]) { if (!keys.has(o)) keys.set(o, { q: [], p: [] }); const K = keys.get(o); const q = o.quaternion.clone().normalize(); const prev = K.q.at(-1); if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w); K.q.push(q); K.p.push(o.position.clone()); }
}
console.log('IK max error: ball', maxErr.f.toFixed(4), 'wrist', maxErr.h.toFixed(4));
if (out) {
  const buf = root.listBuffers()[0];
  const tAcc = doc.createAccessor('climb_t').setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buf);
  const old = new Set();
  for (const c of chans) {
    const o = c.node; if (!joints.includes(o)) continue;
    if (c.path === 'rotation') { old.add(c.s.getInput()); old.add(c.s.getOutput()); const arr = new Float32Array(keys.get(o).q.flatMap((q) => [q.x, q.y, q.z, q.w])); c.s.setInput(tAcc).setOutput(doc.createAccessor().setType('VEC4').setArray(arr).setBuffer(buf)).setInterpolation('LINEAR'); }
    else if (c.path === 'translation' && o === B.Hips) { old.add(c.s.getInput()); old.add(c.s.getOutput()); const arr = new Float32Array(keys.get(o).p.flatMap((p) => [p.x, p.y, p.z])); c.s.setInput(tAcc).setOutput(doc.createAccessor().setType('VEC3').setArray(arr).setBuffer(buf)).setInterpolation('LINEAR'); }
  }
  let disposed = 0; for (const a of old) if (a.listParents().filter((p) => p.propertyType !== 'Root').length === 0) { a.dispose(); disposed++; }
  await io.write(out, doc);
  console.log('wrote', out, 'disposed accessors', disposed);
}
if (process.env.DBG) for (const ph of [0, 0.25, 0.5, 0.75]) { const r = posePhase(ph); scene.updateMatrixWorld(true); for (const s of ['Left', 'Right']) { const k = s[0] + 'H'; console.log(ph, s, 'shoulder', wp(B[s + 'Arm']).toArray().map(v => v.toFixed(3)).join(','), 'want', r[k].want.toArray().map(v => v.toFixed(3)).join(','), 'got', wp(B[s + 'Hand']).toArray().map(v => v.toFixed(3)).join(','), 'dist', wp(B[s + 'Arm']).distanceTo(r[k].want).toFixed(3), 'len', (B[s+'ForeArm'].position.length() + B[s+'Hand'].position.length()).toFixed(3)); } }

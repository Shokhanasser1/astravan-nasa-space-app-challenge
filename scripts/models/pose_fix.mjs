// Arms down along the body and legs parallel, in the astronaut's clips (the lead, 15 Nov ~22:30: "walks like a robot,
// the arms must hang at 90° and not in a V, the legs must be parallel").
//   node scripts/models/pose_fix.mjs <astronaut.glb> <out.glb>
// Arms: the clips were made for a bulky suit with arms held out (upper arm 31° from vertical standing, ~38° walking,
// ~44° loping). In the clips where the arms hang free (ARM_CLIPS) each upper arm is turned toward the body about the
// body's forward axis, by one angle per clip (so the swing stays), until it hangs ARM_TARGET° from vertical.
// Legs: the AI body's rest stance has its feet wide (ankle 7 cm outside the hip). In every clip each thigh is turned
// in by LEG_IN about the forward axis in its own frame (as if the leg's rest were straighter) and the foot turned
// back by the same in its parent's frame, so the sole stays flat. Then re-run climb_kid.mjs: Climb is IK-made.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [src, out] = process.argv.slice(2);
const P = JSON.parse(process.env.P ?? '{}');
/** Upper arm's angle from vertical (deg, frontal plane) the free-hanging clips end up with. */
const ARM_TARGET = P.arm ?? 8;
/** How each clip's correction is measured: the mean over the clip, or its first/last frame (the idle pose it joins). */
const ARM_CLIPS = { Idle: 'mean', Walk: 'mean', Run: 'mean', JumpStart: 'first', JumpAir: 'JumpStart', JumpLand: 'last' };
/** Ankle's distance outside the hip joint (m) the legs keep at rest: parallel, boots ~4 cm apart. */
const ANKLE_OUT = P.ankle ?? 0.025;

const doc = await io.read(src);
const root = doc.getRoot();
const gnodes = root.listNodes();
const obj = new Map();
for (const n of gnodes) {
  const o = new THREE.Object3D();
  o.name = n.getName();
  o.position.fromArray(n.getTranslation());
  o.quaternion.fromArray(n.getRotation());
  o.scale.fromArray(n.getScale());
  obj.set(n, o);
}
const scene = new THREE.Object3D();
for (const n of gnodes) (n.getParentNode() ? obj.get(n.getParentNode()) : scene).add(obj.get(n));
const O = (nm) => obj.get(gnodes.find((n) => n.getName() === nm));
const nodeOf = (nm) => gnodes.find((n) => n.getName() === nm);
const rest = new Map([...obj.values()].map((o) => [o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }]));
const toRest = () => { for (const [o, r] of rest) { o.position.copy(r.p); o.quaternion.copy(r.q); o.scale.copy(r.s); } };
const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion());
const wp = (o) => o.getWorldPosition(new THREE.Vector3());
const Z = new THREE.Vector3(0, 0, 1);

function channels(anim) {
  return anim.listChannels().map((ch) => {
    const s = ch.getSampler();
    const inp = s.getInput(), o = s.getOutput();
    const times = [], vals = [];
    for (let i = 0; i < inp.getCount(); i++) { times.push(inp.getScalar(i)); vals.push(o.getElement(i, [])); }
    return { ch, s, node: obj.get(ch.getTargetNode()), path: ch.getTargetPath(), times, vals };
  });
}
function poseAt(chans, t) {
  toRest();
  for (const c of chans) {
    const { times, vals } = c;
    let i = 0;
    while (i < times.length - 2 && times[i + 1] < t) i++;
    const u = times.length > 1 ? THREE.MathUtils.clamp((t - times[i]) / (times[i + 1] - times[i] || 1), 0, 1) : 0;
    const a = vals[i], b = vals[Math.min(i + 1, vals.length - 1)];
    if (c.path === 'rotation') c.node.quaternion.fromArray(a).slerp(new THREE.Quaternion().fromArray(b), u);
    else if (c.path === 'translation') c.node.position.fromArray(a.map((v, k) => v + (b[k] - v) * u));
  }
  scene.updateMatrixWorld(true);
}
/** Upper arm's angle from vertical in the frontal plane (deg; + = out to its side). */
function abduction(side) {
  const s = wp(O(`${side}Arm`)), e = wp(O(`${side}ForeArm`));
  return (Math.atan2((e.x - s.x) * (side === 'Left' ? 1 : -1), s.y - e.y) * 180) / Math.PI;
}
function writeRot(c, quats) {
  const buf = root.listBuffers()[0];
  c.s.setOutput(doc.createAccessor().setType('VEC4').setArray(new Float32Array(quats.flatMap((q) => q.toArray()))).setBuffer(buf));
}

// legs: the thigh's turn (its own frame) and the foot's turn back (its parent's frame), from the rest pose
toRest();
scene.updateMatrixWorld(true);
const legFix = {};
for (const [side, sg] of [['Left', 1], ['Right', -1]]) {
  const hip = wp(O(`${side}UpLeg`)), ankle = wp(O(`${side}Foot`));
  const now = new THREE.Vector3(ankle.x - hip.x, ankle.y - hip.y, 0);
  const want = new THREE.Vector3(sg * ANKLE_OUT, ankle.y - hip.y, 0);
  const R = new THREE.Quaternion().setFromUnitVectors(now.clone().normalize(), want.normalize()); // world, about z
  const Wt = wq(O(`${side}UpLeg`)), Ws = wq(O(`${side}Leg`));
  legFix[side] = {
    thigh: Wt.clone().invert().multiply(R).multiply(Wt), // q' = q · C
    foot: Ws.clone().invert().multiply(R.clone().invert()).multiply(Ws), // q' = D · q (the shin's frame)
    deg: (2 * Math.acos(Math.min(1, Math.abs(R.w))) * 180) / Math.PI,
  };
}
console.log(`legs in by ${legFix.Left.deg.toFixed(1)}° / ${legFix.Right.deg.toFixed(1)}° (ankle ${ANKLE_OUT} m outside the hip)`);

// arms: one angle per clip, measured first (JumpAir takes JumpStart's, so the jump's parts still join)
const corr = {};
const anims = root.listAnimations();
for (const pass of ['measure', 'reuse']) {
  for (const anim of anims) {
    const name = anim.getName();
    const how = ARM_CLIPS[name];
    if (!how || corr[name]) continue;
    if (pass === 'measure' && ARM_CLIPS[how]) continue; // (a clip's name: take that clip's angle in the second pass)
    if (pass === 'reuse') { corr[name] = corr[how]; continue; }
    const chans = channels(anim);
    const dur = Math.max(...chans.map((c) => c.times.at(-1)));
    corr[name] = {};
    for (const side of ['Left', 'Right']) {
      const at = how === 'first' ? [0] : how === 'last' ? [dur] : Array.from({ length: 24 }, (_, i) => (dur * i) / 24);
      let sum = 0;
      for (const t of at) { poseAt(chans, t); sum += abduction(side); }
      corr[name][side] = sum / at.length - ARM_TARGET;
    }
  }
}
toRest();
scene.updateMatrixWorld(true);
const armAxis = {};
for (const side of ['Left', 'Right']) armAxis[side] = Z.clone().applyQuaternion(wq(O(`${side}Shoulder`)).invert()).normalize();
/**
 * Gestures start and end in the Idle pose (no pop when they fade in or out): they take Idle's arm correction fully at
 * their ends and none in the middle (where the hand reaches the pocket, the wrist or the visor), smoothly between.
 */
const GESTURE_CLIPS = ['Insert', 'Wrist', 'LookAround'];
const EDGE = 0.3; // fraction of the gesture at each end over which the correction fades
const ss = (x) => { const t = THREE.MathUtils.clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const I = new THREE.Quaternion();
for (const anim of anims) {
  const chans = channels(anim);
  const gesture = GESTURE_CLIPS.includes(anim.getName());
  const c0 = gesture ? corr.Idle : corr[anim.getName()];
  const dur = Math.max(...chans.map((c) => c.times.at(-1)));
  const weight = (t) => (gesture ? Math.max(1 - ss(t / (EDGE * dur)), ss((t - (1 - EDGE) * dur) / (EDGE * dur))) : 1);
  for (const side of ['Left', 'Right']) {
    // arms: turn about the body's forward axis in the shoulder's (parent's) frame; − on the left (+x) brings it down
    const c = chans.find((x) => x.node === O(`${side}Arm`) && x.path === 'rotation');
    if (c0 && c && Math.abs(c0[side]) >= 0.5) {
      const A = new THREE.Quaternion().setFromAxisAngle(armAxis[side], THREE.MathUtils.degToRad(side === 'Left' ? -c0[side] : c0[side]));
      writeRot(c, c.vals.map((v, i) => I.clone().slerp(A, weight(c.times[i])).multiply(new THREE.Quaternion().fromArray(v)).normalize()));
    }
    // legs: every clip
    const t = chans.find((x) => x.node === O(`${side}UpLeg`) && x.path === 'rotation');
    const f = chans.find((x) => x.node === O(`${side}Foot`) && x.path === 'rotation');
    if (t) writeRot(t, t.vals.map((v) => new THREE.Quaternion().fromArray(v).multiply(legFix[side].thigh).normalize()));
    if (f) writeRot(f, f.vals.map((v) => legFix[side].foot.clone().multiply(new THREE.Quaternion().fromArray(v)).normalize()));
  }
}
for (const [k, v] of Object.entries(corr)) console.log(`arms ${k}: in by ${v.Left.toFixed(1)}° / ${v.Right.toFixed(1)}°`);

// Arm swing (the arms hardly moved: ±10° walking, ±6° loping, elbows almost straight → "like a robot"): each upper
// arm's forward/back angle is spread around a new middle (SWING: amplitude and middle, deg; + = forward), keeping its
// timing against the legs, and the elbow bends a little more (bent arms in a pressurised suit).
const SWING = { Walk: { amp: P.walkAmp ?? 16, mid: P.walkMid ?? 2, elbow: P.walkElbow ?? 10 }, Run: { amp: P.runAmp ?? 22, mid: P.runMid ?? 4, elbow: P.runElbow ?? 15 } };
const X = new THREE.Vector3(1, 0, 0);
const hinge = {};
for (const [side, ax] of [['Left', new THREE.Vector3(0, -1, 0)], ['Right', new THREE.Vector3(0, 1, 0)]]) {
  hinge[side] = { lat: X.clone().applyQuaternion(wq(O(`${side}Shoulder`)).invert()).normalize(), elbow: ax.applyQuaternion(wq(O(`${side}ForeArm`)).invert()).normalize() };
}
for (const anim of anims) {
  const sw = SWING[anim.getName()];
  if (!sw) continue;
  const chans = channels(anim); // (the arms as corrected above)
  for (const side of ['Left', 'Right']) {
    const c = chans.find((x) => x.node === O(`${side}Arm`) && x.path === 'rotation');
    const fa = chans.find((x) => x.node === O(`${side}ForeArm`) && x.path === 'rotation');
    const theta = c.times.map((t) => {
      poseAt(chans, t);
      const s = wp(O(`${side}Arm`)), e = wp(O(`${side}ForeArm`));
      return (Math.atan2(e.z - s.z, s.y - e.y) * 180) / Math.PI;
    });
    const lo = Math.min(...theta), hi = Math.max(...theta), mean = (lo + hi) / 2, half = Math.max(0.5, (hi - lo) / 2);
    const k = sw.amp / half;
    // a turn about +x moves a hanging arm backward, so forward = −
    writeRot(c, c.vals.map((v, i) => {
      const want = sw.mid + (theta[i] - mean) * k;
      const A = new THREE.Quaternion().setFromAxisAngle(hinge[side].lat, THREE.MathUtils.degToRad(-(want - theta[i])));
      return A.multiply(new THREE.Quaternion().fromArray(v)).normalize();
    }));
    const E = new THREE.Quaternion().setFromAxisAngle(hinge[side].elbow, THREE.MathUtils.degToRad(sw.elbow));
    if (fa) writeRot(fa, fa.vals.map((v) => new THREE.Quaternion().fromArray(v).multiply(E).normalize()));
    console.log(`swing ${anim.getName()} ${side}: was ${lo.toFixed(0)}..${hi.toFixed(0)}°, now ${(sw.mid - sw.amp).toFixed(0)}..${(sw.mid + sw.amp).toFixed(0)}°, elbow +${sw.elbow}°`);
  }
}
for (const a of root.listAccessors()) if (a.listParents().every((p) => p.propertyType === 'Root')) a.dispose();
await io.write(out, doc);
console.log('wrote', out, nodeOf('Hips') ? '' : '(no Hips?)');

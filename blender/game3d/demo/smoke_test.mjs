// Brauzersiz smoke test: fizika formulalari, o'yinchi harakati, devorlar, sumkalar, astronaut.glb.
//
//   cd ~/dev/oy-karvonsaroyi-3d/game3d
//   node demo/smoke_test.mjs                       # faqat fizika (three kerak emas)
//   THREE_DIR=/path/to/node_modules/three node demo/smoke_test.mjs   # + level, GLB, animatsiya
//
// three@0.170.0 ni vaqtinchalik o'rnatish:  npm i --prefix "$TMPDIR/t" three@0.170.0
//   va THREE_DIR="$TMPDIR/t/node_modules/three"
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let failed = 0, passed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  ok  ', msg); } else { failed++; console.log('  FAIL', msg); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ------------------------------------------------------------------ 1. pure physics
const P = await import('./physics.js');
console.log('physics.js');
ok(P.GRAVITY.moon === 1.62 && P.GRAVITY.earth === 9.81 && P.GRAVITY.mars === 3.71, 'gravity Moon 1.62 / Earth 9.81 / Mars 3.71 m/s²');
ok(P.BODY.suitKg === 145, 'EMU suit 145 kg');
const hMoon = P.jumpHeight(1.2, 1.62), hEarth = P.jumpHeight(1.2, 9.81);
ok(near(hMoon, 0.4444, 1e-3), `jump height Moon h = v²/2g = ${hMoon.toFixed(4)} m (v0 1.2 m/s)`);
ok(near(hEarth, 0.0734, 1e-3), `jump height Earth = ${hEarth.toFixed(4)} m`);
ok(near(hMoon / hEarth, 9.81 / 1.62, 1e-9) && near(hMoon / hEarth, 6.06, 0.01), `Moon jump ${(hMoon / hEarth).toFixed(2)}× higher`);
ok(near(P.airTime(1.2, 1.62), 1.4815, 1e-3), `air time Moon 2v/g = ${P.airTime(1.2, 1.62).toFixed(3)} s`);
ok(P.totalMass(27) === 247, 'total mass 75 + 145 + 27 = 247 kg');
ok(near(P.carryFactor(27), 220 / 247, 1e-12), `carry factor M/(M+m) = ${P.carryFactor(27).toFixed(3)}`);
ok(near(P.jumpSpeed(27), 1.2 * Math.sqrt(220 / 247), 1e-12), 'jump speed with bag = v0·sqrt(M/(M+m))');
ok(near(P.weightN(220, 1.62), 356.4, 1e-6), 'weight in suit on the Moon 356 N');
const R = P.readout(27, 1.62);
ok(near(R.ratio, 6.0556, 1e-3) && near(R.jumpH / R.jumpHEarth, R.ratio, 1e-9), 'readout ratio = g_earth / g');

// ray / point vs OBB
const box = P.makeOBB([0, 1, 0], [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [1, 1, 1]);
ok(near(P.rayVsOBB([-5, 1, 0], [1, 0, 0], box), 4, 1e-9), 'rayVsOBB hits the near face at t=4');
ok(P.rayVsOBB([-5, 3, 0], [1, 0, 0], box) === null, 'rayVsOBB misses above the box');
ok(P.rayVsOBB([0, 1, 0], [1, 0, 0], box) === null, 'rayVsOBB: origin inside -> null');
ok(P.pointInOBB([0.9, 1.9, -0.9], box) && !P.pointInOBB([1.1, 1, 0], box), 'pointInOBB');

// simulated jump on flat ground (120 Hz) must match the formula
function simJump(g, bagKg = 0) {
  const b = new P.PlayerBody([0, 0, 0]);
  b.bagKg = bagKg;
  const world = { g, groundHeight: () => 0, colliders: [], bounds: 100 };
  const dt = 1 / 120;
  for (let i = 0; i < 10; i++) b.step(dt, { x: 0, z: 0, run: false, jump: false }, world);
  b.step(dt, { x: 0, z: 0, run: false, jump: true }, world);
  let peak = 0, t = 0, air = 0, left = false;
  for (let i = 0; i < 2000; i++) {
    b.step(dt, { x: 0, z: 0, run: false, jump: false }, world);
    t += dt;
    if (!b.onGround) { left = true; air += dt; }
    peak = Math.max(peak, b.pos[1]);
    if (left && b.onGround) break;
  }
  return { peak, air, v: b.lastJumpV };
}
for (const [k, g] of Object.entries(P.GRAVITY)) {
  const s = simJump(g);
  const want = P.jumpHeight(s.v, g);
  ok(near(s.peak, want, want * 0.03 + 0.002), `simulated ${k} jump peak ${s.peak.toFixed(3)} m ≈ ${want.toFixed(3)} m, air ${s.air.toFixed(2)} s ≈ ${P.airTime(s.v, g).toFixed(2)} s`);
}
const sb = simJump(1.62, 27);
ok(sb.peak < simJump(1.62).peak, `carrying 27 kg lowers the Moon jump (${sb.peak.toFixed(3)} m)`);

// walking into a wall: never passes through
{
  const wall = P.makeOBB([3, 1.5, 0], [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [0.5, 1.5, 3], 'COL_wall');
  const b = new P.PlayerBody([0, 0, 0]);
  const world = { g: 1.62, groundHeight: () => 0, colliders: [wall], bounds: 100 };
  let maxX = -1;
  for (let i = 0; i < 600; i++) {
    b.step(1 / 120, { x: 1, z: 0, run: true, jump: i === 200 }, world);
    maxX = Math.max(maxX, b.pos[0]);
  }
  ok(maxX <= 2.5 - P.BODY.radius + 0.01, `capsule stops at the wall (max x ${maxX.toFixed(3)}, face 2.5, r ${P.BODY.radius})`);
  const top = new P.PlayerBody([3, 3.5, 0]);
  for (let i = 0; i < 400; i++) top.step(1 / 120, { x: 0, z: 0, run: false, jump: false }, world);
  ok(near(top.pos[1], 3.0, 0.02) && top.onGround, `player lands and stands on top of a box (y ${top.pos[1].toFixed(3)})`);
}
// walking speed with and without a bag
{
  const run = (bagKg) => {
    const b = new P.PlayerBody([0, 0, 0]);
    b.bagKg = bagKg;
    const world = { g: 1.62, groundHeight: () => 0, colliders: [], bounds: 1000 };
    for (let i = 0; i < 600; i++) b.step(1 / 120, { x: 0, z: 1, run: false, jump: false }, world);
    return b.horizontalSpeed();
  };
  const v0 = run(0), v1 = run(27);
  ok(near(v0, P.MOVE.walk, 1e-6) && near(v1, P.MOVE.walk * 220 / 247, 1e-6), `walk ${v0.toFixed(2)} m/s, with 27 kg bag ${v1.toFixed(2)} m/s`);
}

// ------------------------------------------------------------------ 2. three.js parts (optional)
const candidates = [process.env.THREE_DIR, path.join(HERE, 'node_modules', 'three'), path.join(HERE, '..', 'node_modules', 'three')]
  .filter(Boolean);
const THREE_DIR = candidates.find((d) => existsSync(path.join(d, 'build', 'three.module.js')));
if (!THREE_DIR) {
  console.log('\n(three not found: set THREE_DIR to test world.js / game.js / astronaut.glb)');
} else {
  const ver = JSON.parse(readFileSync(path.join(THREE_DIR, 'package.json'), 'utf8')).version;
  console.log(`\nthree ${ver} from ${THREE_DIR}`);
  registerHooks({
    resolve(spec, ctx, next) {
      if (spec === 'three') return { url: pathToFileURL(path.join(THREE_DIR, 'build', 'three.module.js')).href, shortCircuit: true };
      if (spec.startsWith('three/addons/')) {
        return { url: pathToFileURL(path.join(THREE_DIR, 'examples', 'jsm', spec.slice('three/addons/'.length))).href, shortCircuit: true };
      }
      return next(spec, ctx);
    },
  });
  const THREE = await import('three');
  const W = await import('./world.js');
  const G = await import('./game.js');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

  // --- astronaut.glb
  console.log('astronaut.glb');
  const glbPath = path.join(HERE, '..', 'characters', 'astronaut.glb');
  const buf = readFileSync(glbPath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;   // GLTFLoader uses self.URL
  const origErr = console.error, origWarn = console.warn;
  const muted = [];
  console.error = (...a) => muted.push(a.join(' '));   // textures cannot decode without a DOM
  console.warn = (...a) => muted.push(a.join(' '));
  const gltf = await new GLTFLoader().parseAsync(ab, '');
  console.error = origErr; console.warn = origWarn;
  if (muted.length) console.log(`  (muted ${muted.length} texture message(s): no image decoder in Node)`);
  const ch = W.setupCharacter(gltf);
  const bones = [];
  ch.model.traverse((o) => { if (o.isBone) bones.push(o.name); });
  const need = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
    'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
    'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', 'BagSocket'];
  ok(bones.length === 23 && need.every((n) => bones.includes(n)), `23 bones with Mixamo-style names (${bones.length})`);
  ok(!!ch.socket, 'BagSocket bone found');
  const want = { Idle: 2.0, Walk: 1.2, Run: 0.8, Jump: 1.2, Carry: 1.4, Pour: 2.0 };
  for (const [n, d] of Object.entries(want)) ok(ch.clips[n] && near(ch.clips[n].duration, d, 0.02), `clip ${n} ${ch.clips[n] ? ch.clips[n].duration.toFixed(3) : 'missing'} s`);
  let skinned = null, tris = 0;
  ch.model.traverse((o) => {
    if (o.isSkinnedMesh) skinned = o;
    if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  });
  ok(!!skinned && tris <= 15000, `skinned mesh, ${tris} triangles (<= 15k)`);
  ch.model.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(ch.model);
  ok(near(bb.max.y - bb.min.y, 1.85, 0.02) && near(bb.min.y, 0, 0.01), `height ${(bb.max.y - bb.min.y).toFixed(3)} m, soles at y=${bb.min.y.toFixed(3)}`);
  ok(near((bb.min.x + bb.max.x) / 2, 0, 0.02) && near((bb.min.z + bb.max.z) / 2, 0, 0.05), 'origin between the feet');
  const head = ch.model.getObjectByName('Head').getWorldPosition(new THREE.Vector3());
  const hips = ch.model.getObjectByName('Hips').getWorldPosition(new THREE.Vector3());
  const lh = ch.model.getObjectByName('LeftHand').getWorldPosition(new THREE.Vector3());
  ok(head.y > 1.4 && hips.y > 0.7 && hips.y < 1.1, `Head y ${head.y.toFixed(2)} m, Hips y ${hips.y.toFixed(2)} m`);
  ok(lh.x > 0.4, `LeftHand on +X (character's left when facing +Z): x ${lh.x.toFixed(2)}`);
  // facing +Z: the BagSocket (in front of the chest) must be at +Z after the Carry pose
  const mixer = new THREE.AnimationMixer(ch.model);
  mixer.clipAction(ch.clips.Carry).play();
  mixer.update(0.3);
  ch.model.updateMatrixWorld(true);
  const sock = ch.socket.getWorldPosition(new THREE.Vector3());
  ok(sock.z > 0.2 && sock.y > 0.8 && sock.y < 1.4, `Carry: BagSocket in front of the chest (z ${sock.z.toFixed(2)}, y ${sock.y.toFixed(2)}) -> faces +Z`);
  mixer.stopAllAction();

  // --- fallback level + game logic
  console.log('fallback level + game.js');
  const root = W.buildFallbackLevel();
  const game = new G.Game({ levelRoot: root, character: ch, manifest: { gravity: { moon: { value: 1.62 } } } });
  ok(game.g === 1.62, 'gravity from manifest {moon:{value:1.62}}');
  ok(game.bags.length === 4 && game.colliders.length >= 7, `level: ${game.bags.length} bags, ${game.colliders.length} colliders, ground ${game.level.groundSource}`);
  ok(near(game.groundHeight(1.234, -5.6), 0, 1e-6), 'ground height 0 on the flat plane');
  ok(game.spawn.pos[2] === 4, 'spawn from SPAWN_player');
  const step = (sec, c) => { for (let t = 0; t < sec; t += 1 / 60) game.update(1 / 60, c); };
  step(0.5, {});
  ok(game.anim.state === 'Idle', 'standing -> Idle');
  // walk toward the HDU (at z = -12): camera yaw 0 means "forward" = -Z
  step(1.5, { fwd: 1, camYaw: 0 });
  ok(game.anim.state === 'Walk' && near(game.body.horizontalSpeed(), P.MOVE.walk, 0.05), `W -> Walk at ${game.body.horizontalSpeed().toFixed(2)} m/s, facing ${(game.facing * 180 / Math.PI).toFixed(0)}°`);
  step(1.0, { fwd: 1, run: true, camYaw: 0 });
  ok(game.anim.state === 'Run', `Shift -> Run at ${game.body.horizontalSpeed().toFixed(2)} m/s`);
  step(10, { fwd: 1, run: true, camYaw: 0 });
  ok(game.body.pos[2] >= -12 + 2.6 + P.BODY.radius - 0.02, `capsule outside the HDU box (z ${game.body.pos[2].toFixed(2)} >= ${(-12 + 2.6 + P.BODY.radius).toFixed(2)})`);
  const cam = game.cameraPose(Math.PI, 0.2, 4.5);   // camera on the HDU side -> must be pulled in
  ok(cam.dist < 4.5, `camera pulled in front of the HDU wall (${cam.dist.toFixed(2)} m)`);
  // jump
  game.respawn();
  step(0.5, {});
  game.update(1 / 60, { jump: true });
  let maxY = 0, sawJump = false;
  for (let t = 0; t < 3; t += 1 / 60) {
    game.update(1 / 60, {});
    maxY = Math.max(maxY, game.body.pos[1]);
    if (game.anim.state === 'Jump') sawJump = true;
  }
  ok(sawJump && near(maxY, P.jumpHeight(P.MOVE.jumpV0, 1.62), 0.02), `Space -> Jump, peak ${maxY.toFixed(3)} m (formula ${P.jumpHeight(P.MOVE.jumpV0, 1.62).toFixed(3)})`);
  ok(near(game.lastJumpPeak, maxY, 0.01), `HUD "last jump" ${game.lastJumpPeak.toFixed(3)} m`);
  // bags: walk to BAG_01 at (2.5, 0, 2) and pick it up
  game.body.pos = [2.5, 0, 3.0];
  game.facing = Math.PI;   // facing -Z, the bag is 1 m in front
  step(0.2, {});
  game.update(1 / 60, { use: true });
  ok(!!game.carried && game.body.bagKg === 27, `E -> picked up ${game.carried && game.carried.name} (${game.body.bagKg} kg)`);
  ok(game.carried && game.carried.parent === ch.socket, 'bag is parented to BagSocket');
  step(2, { fwd: 1, camYaw: Math.PI / 2 });
  ok(game.anim.state === 'Carry' && near(game.body.horizontalSpeed(), P.MOVE.walk * 220 / 247, 0.05), `carrying -> Carry at ${game.body.horizontalSpeed().toFixed(2)} m/s (×${(220 / 247).toFixed(2)})`);
  step(0.5, {});
  game.update(1 / 60, { pour: true });
  ok(game.anim.state === 'Pour', 'F while carrying -> Pour');
  step(0.5, {});
  const n0 = game.colliders.length;
  game.update(1 / 60, { use: true });
  ok(!game.carried && game.body.bagKg === 0 && game.colliders.length === n0, 'E again -> bag put down, collider replaced');
  // stacked bags: BAG_04 sits on BAG_03; take BAG_03 from under it -> BAG_04 falls to the ground
  const b3 = root.getObjectByName('BAG_03'), b4 = root.getObjectByName('BAG_04');
  const y4 = game.bagCentre(b4).y;
  game.body.pos = [-2.8, 0, 2.3];
  game.facing = Math.PI;
  game.bags.splice(game.bags.indexOf(b4), 1);         // force picking the bottom one
  game.update(1 / 60, { use: true });
  game.bags.push(b4);
  game.settleBags();
  ok(game.carried === b3 && game.bagCentre(b4).y < y4 - 0.2, `stack: lower bag taken, upper bag settles (${y4.toFixed(3)} -> ${game.bagCentre(b4).y.toFixed(3)} m)`);
  // drop into the SEV must be refused
  game.body.pos = [6.7, 0, -3];
  game.facing = Math.PI / 2;   // facing +X toward the SEV
  for (let i = 0; i < 30; i++) game.update(1 / 60, { fwd: 0 });
  const before = game.carried;
  game.update(1 / 60, { use: true });
  ok(game.carried === before && before.parent === ch.socket, `drop into the SEV refused (player x ${game.body.pos[0].toFixed(2)})`);
  // gravity switch
  game.cycleGravity();
  ok(game.gravityKey === 'earth' && game.g === 9.81, 'G -> Earth gravity 9.81');
  const hud = game.hud();
  ok(near(hud.jumpH, P.jumpHeight(P.jumpSpeed(hud.bagKg), 9.81), 1e-9), `HUD jump height on Earth ${hud.jumpH.toFixed(3)} m`);

  // --- a synthetic "oy_level.glb" scene graph: the naming contract for the future level
  console.log('synthetic level (COL_ground slope, COL_ boxes via extras, BAG_, ICE_, SPAWN_player)');
  const lv = new THREE.Group();
  const slope = new THREE.Mesh(new THREE.PlaneGeometry(40, 40, 8, 8));
  slope.rotation.x = -Math.PI / 2;
  slope.rotation.y = Math.atan(0.1);         // 10 % slope rising toward -X
  slope.name = 'COL_ground';
  lv.add(slope);
  const vis = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial());
  vis.name = 'regolith';
  lv.add(vis);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));   // geometry is ignored: extras win
  crate.name = 'COL_crate';
  crate.userData.boxes = JSON.stringify([[0, 0.5, 0, 1.2, 1.0, 1.2]]);
  crate.position.set(4, 0, -4);
  lv.add(crate);
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.5).translate(0, 0.125, 0));
  bag.name = 'BAG_shelf';
  bag.userData.mass_kg = 19;
  bag.position.set(4, 3, -4);                 // floating: must settle on the crate top (y = 1.0 + ground)
  lv.add(bag);
  const ice = new THREE.Object3D();
  ice.name = 'ICE_01';
  ice.position.set(0, 0, -1.5);
  lv.add(ice);
  const sp = new THREE.Object3D();
  sp.name = 'SPAWN_player';
  sp.position.set(0, 5, 0);
  sp.rotation.y = Math.PI / 2;                // face +X
  lv.add(sp);
  const g2 = new G.Game({ levelRoot: lv, character: W.setupCharacter(gltf), manifest: null });
  const gAt = (x, z) => g2.groundHeight(x, z);
  ok(g2.level.groundSource === 'COL_ground' && !slope.visible, 'COL_ground used for height and hidden');
  ok(near(g2.spawn.pos[1], 5, 1e-6) && near(g2.spawn.yaw, Math.PI / 2, 1e-6), `SPAWN_player position + yaw (${(g2.spawn.yaw * 180 / Math.PI).toFixed(0)}°)`);
  ok(g2.colliders.some((c) => c.name === 'COL_crate' && near(c.e[0], 0.6, 1e-6) && near(c.c[0], 4, 1e-6)), 'COL_ box from userData.boxes (assets convention)');
  const crateTop = 1.0 + 0;  // the crate sits at y = 0 in its own frame
  ok(near(g2.bagCentre(bag).y - 0.125, crateTop, 0.01), `floating BAG_ settles on the crate top (bottom y ${(g2.bagCentre(bag).y - 0.125).toFixed(3)})`);
  ok(g2.bagMass(bag) === 19, 'bag mass from glTF extras mass_kg');
  for (let t = 0; t < 3; t += 1 / 60) g2.update(1 / 60, {});
  ok(g2.nearIce(3) === ice, 'ICE_ object found near the player');
  ok(g2.body.onGround && near(g2.body.pos[1], gAt(g2.body.pos[0], g2.body.pos[2]), 0.01), `spawned in the air, landed on the slope (y ${g2.body.pos[1].toFixed(3)})`);
  let maxGap = 0;
  for (let t = 0; t < 4; t += 1 / 60) {
    g2.update(1 / 60, { fwd: 1, camYaw: Math.PI / 2 });   // camera yaw 90° -> forward = -X, uphill
    if (g2.body.onGround) maxGap = Math.max(maxGap, Math.abs(g2.body.pos[1] - gAt(g2.body.pos[0], g2.body.pos[2])));
  }
  ok(g2.body.pos[0] < -4 && Math.abs(g2.body.pos[1]) > 0.3 && maxGap < 0.01,
    `walks on the sloped COL_ground, feet stay on it (x ${g2.body.pos[0].toFixed(2)}, y ${g2.body.pos[1].toFixed(2)}, max gap ${maxGap.toFixed(4)} m)`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

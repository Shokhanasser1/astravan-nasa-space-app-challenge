// Oy karvonsaroyi — 3D test demo (brauzer qismi): renderer, osmon, level, personaj, kamera, HUD.
// O'yin mantig'i game.js da, fizika physics.js da, level/animatsiya yordamchilari world.js da.
//
// Ishga tushirish:  npm run dev -> http://localhost:5173/oy/demo/  (Vite page oy/demo/index.html; three.js from npm)
// URL parametrlari:  ?g=earth|mars|moon   ?level=none (oy_level.glb bo'lsa ham placeholder)   ?props=0   ?debug=1
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { BODY, GRAVITY, GRAVITY_NAMES, jumpHeight } from './physics.js';
import { buildFallbackLevel, setupCharacter, localBox } from './world.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { createLook } from '../look/index.js';   // real LOLA ground, rocks, prints, post (?look=0 = off)

// Assets stay in public/oy/ (GLBs, skies, manifest); the page is /oy/demo/, so they are one folder up.
const BASE = new URL('../', location.href);
const at = (p) => new URL(p, BASE).href;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEG = Math.PI / 180;

const loadText = (t) => { const el = $('loadText'); if (el) el.textContent = t; };

async function exists(p) {
  try {
    const r = await fetch(at(p), { method: 'HEAD', cache: 'no-cache' });
    return r.ok;
  } catch (_) {
    return false;
  }
}
async function getJSON(p) {
  try {
    const r = await fetch(at(p), { cache: 'no-cache' });
    return r.ok ? await r.json() : null;
  } catch (_) {
    return null;
  }
}

// Draco decoder from our own server (public/draco, copied from three.js by scripts/copy-decoders.mjs), never a CDN.
const draco = new DRACOLoader().setDecoderPath(new URL('../../draco/', location.href).href);
const loader = new GLTFLoader().setDRACOLoader(draco);
async function loadGLB(p) {
  if (!(await exists(p))) return null;
  loadText('Yuklanmoqda / Loading: ' + p);
  try {
    return await loader.loadAsync(at(p));
  } catch (e) {
    console.warn('GLB load failed', p, e);
    return null;
  }
}

/** sky.json convention: azimuth 0° = +X, 90° = +Z, elevation 0° = horizon (Three.js, Y up). */
function skyDir(azDeg, elDeg) {
  const a = azDeg * DEG, e = elDeg * DEG;
  return new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a));
}

// ---------------------------------------------------------------------------- renderer + scene
const canvas = $('c');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  fatal('WebGL ishlamadi / WebGL is not available: ' + e.message);
  throw e;
}
const touchFirst = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(devicePixelRatio, touchFirst ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;          // Moon shadows are hard
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 3000);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const env = {
  sunDir: skyDir(118, 10.5),        // low hard sun (same as oy_sky)
  earthDir: skyDir(213, 25),        // Earth ~25° up, ~1.9° across
  earthDiam: 1.9,
  stars: null,
  earth: null,
  skyFrom: '',
};
let sun, hemi;

function makeStars() {
  const n = 2600, R = 1500;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const z = rnd() * 1.15 - 0.15, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    pos.set([Math.cos(a) * r * R, z * R, Math.sin(a) * r * R], i * 3);
    const b = 0.35 + 0.65 * rnd() ** 3;
    col.set([b, b, b * (0.9 + 0.1 * rnd())], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false, fog: false });
  const pts = new THREE.Points(g, m);
  pts.renderOrder = -10;
  pts.frustumCulled = false;
  return pts;
}

async function makeEarth() {
  const g = await loadGLB('assets/earth-globe.glb');     // radius 1 m (assets convention)
  const holder = new THREE.Group();
  if (g) {
    holder.add(g.scene);
  } else {
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a6fd8, roughness: 0.75, emissive: 0x050a18 });
    holder.add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat));
  }
  holder.traverse((o) => {
    if ((o.name || '').startsWith('COL_')) o.visible = false;      // asset collider box: never draw it
    if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; }
  });
  return holder;
}

async function setupSky() {
  const cat = await getJSON('sky/sky.json');
  const cfg = cat && cat.skies && cat.skies.oy_sky;
  let sunColor = '#fff6e9', sunI = 3.2;
  let h = { sky: '#171b24', ground: '#232323', i: 0.25 };
  if (cfg) {
    if (cfg.sun) {
      env.sunDir = skyDir(cfg.sun.azimuth_deg, cfg.sun.elevation_deg);
      sunColor = cfg.sun.color || sunColor;
      sunI = cfg.sun.intensity || sunI;
    }
    if (cfg.hemisphere) h = { sky: cfg.hemisphere.sky_color, ground: cfg.hemisphere.ground_color, i: cfg.hemisphere.intensity };
    if (cfg.earth) {
      env.earthDir = skyDir(cfg.earth.azimuth_deg, cfg.earth.elevation_deg);
      env.earthDiam = cfg.earth.angular_diameter_deg || env.earthDiam;
    }
    const big = Math.max(screen.width, screen.height) * devicePixelRatio > 2200 && !touchFirst;
    const file = (big && cfg.file_4k) || cfg.file_2k || cfg.file_4k;
    if (file) {
      try {
        loadText('Yuklanmoqda / Loading: sky/' + file);
        const tex = await new THREE.TextureLoader().loadAsync(at('sky/' + file));
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        scene.background = tex;
        scene.backgroundRotation.set(0, 0, 0);       // sky.json directions assume no rotation
        env.skyFrom = 'sky/' + file;
      } catch (e) {
        console.warn('sky panorama failed', e);
      }
    }
  }
  if (!env.skyFrom) {
    // no panorama yet: black sky, stars and a small Earth (sun direction as in the Moon scene)
    scene.background = new THREE.Color(0x000000);
    env.stars = makeStars();
    env.earth = await makeEarth();
    scene.add(env.stars, env.earth);
    env.skyFrom = 'stars (sky.json yo\'q)';
  }
  sun = new THREE.DirectionalLight(sunColor, sunI);
  sun.castShadow = true;
  const sm = touchFirst ? 1024 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 160 });
  sun.shadow.camera.updateProjectionMatrix();          // three does not do this for directional shadows
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  // a bit more fill than sky.json suggests, so kids can still see the shadow side of the suit
  hemi = new THREE.HemisphereLight(h.sky, h.ground, Math.max(h.i, 0.55));
  scene.add(hemi);
}

// ---------------------------------------------------------------------------- level
const SCENERY = [
  // id = game3d/assets/<id>.glb (real scale, metres; COL_<id> boxes inside). Replaces the placeholder + its COL boxes.
  // hdu-1 (shell) and hdu-2 (deck, porch ramp) share one NASA frame -> same transform; ramp turned toward the spawn.
  { id: 'hdu-1', replace: ['HDU_placeholder', 'COL_hdu_a', 'COL_hdu_b'], pos: [0, 0, -14], yaw: Math.PI },
  { id: 'hdu-2', replace: [], pos: [0, 0, -14], yaw: Math.PI },
  { id: 'sev', replace: ['SEV_placeholder', 'COL_sev'], pos: [9, 0, -2], yaw: 0.5 },
  { id: 'rassor', replace: [], pos: [-5, 0, -1], yaw: 0.9 },
];
const usedAssets = [];

/** Put optional NASA props from ../assets into the placeholder level. Missing files are simply skipped. */
async function decorateFallback(root) {
  for (const s of SCENERY) {
    const g = await loadGLB(`assets/${s.id}.glb`);
    if (!g) continue;
    const obj = g.scene;
    obj.name = 'ASSET_' + s.id;
    obj.position.fromArray(s.pos);
    obj.rotation.y = s.yaw;
    for (const n of s.replace) {
      const o = root.getObjectByName(n);
      if (o) o.removeFromParent();
    }
    let hasCol = false;
    obj.traverse((o) => { if ((o.name || '').startsWith('COL_')) hasCol = true; });
    if (!hasCol) {
      const lb = localBox(obj);
      const size = lb.getSize(new THREE.Vector3());
      const col = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z));
      col.position.copy(lb.getCenter(new THREE.Vector3()));
      col.name = 'COL_' + s.id + '_auto';
      obj.add(col);
    }
    root.add(obj);
    usedAssets.push(s.id);
  }
  // crew-lock bag look-alike for the BAG_ placeholders
  const bagG = await loadGLB('assets/crew-lock-bag.glb');
  if (bagG) {
    const bags = root.children.filter((o) => (o.name || '').startsWith('BAG_'))
      .sort((a, b) => a.position.y - b.position.y);
    const placed = [];
    for (const bag of bags) {
      const v = bagG.scene.clone(true);
      const lb = localBox(v);
      const size = lb.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const s = maxDim > 0.2 && maxDim < 1.2 ? 1 : 0.502 / Math.max(maxDim, 1e-3);   // CTB 50.2 cm
      v.scale.setScalar(s);
      const c = lb.getCenter(new THREE.Vector3());
      v.position.set(-c.x * s, -lb.min.y * s, -c.z * s);
      bag.clear();
      bag.add(v);
      // re-stack: the real bag has another height than the placeholder box
      let y = 0;
      for (const o of placed) {
        if (Math.hypot(o.position.x - bag.position.x, o.position.z - bag.position.z) < 0.3) y = Math.max(y, o.position.y + o.userData.h);
      }
      bag.position.y = y;
      bag.userData.h = size.y * s;
      placed.push(bag);
    }
    usedAssets.push('crew-lock-bag');
  }
}

function fallbackCharacter() {
  // capsule stand-in if astronaut.glb is missing
  const g = new THREE.Group();
  g.name = 'player_capsule';
  const mat = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(BODY.radius, BODY.height - 2 * BODY.radius, 6, 16), mat);
  body.position.y = BODY.height / 2;
  body.castShadow = true;
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8), new THREE.MeshStandardMaterial({ color: 0xc89b3c, metalness: 0.6, roughness: 0.25 }));
  visor.position.set(0, 1.6, 0.25);
  const socket = new THREE.Object3D();
  socket.name = 'BagSocket';
  socket.position.set(0, 1.05, 0.5);
  g.add(body, visor, socket);
  return { model: g, socket, clips: {} };
}

// ---------------------------------------------------------------------------- debug view of the hitboxes
const debug = new THREE.Group();
debug.visible = params.has('debug');
scene.add(debug);
const unitEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
const matCol = new THREE.LineBasicMaterial({ color: 0xff8a00 });
const matBag = new THREE.LineBasicMaterial({ color: 0x38a0ff });
const capsuleDbg = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.CapsuleGeometry(BODY.radius, BODY.height - 2 * BODY.radius, 3, 12)),
  new THREE.LineBasicMaterial({ color: 0x40ff70 }));
let debugT = 0;
function rebuildDebug(game) {
  debug.clear();
  for (const c of game.colliders) {
    if (!c.enabled) continue;
    const m = new THREE.LineSegments(unitEdges, c.bag ? matBag : matCol);
    const M = new THREE.Matrix4().makeBasis(
      new THREE.Vector3().fromArray(c.u[0]), new THREE.Vector3().fromArray(c.u[1]), new THREE.Vector3().fromArray(c.u[2]));
    M.scale(new THREE.Vector3(2 * c.e[0], 2 * c.e[1], 2 * c.e[2]));
    M.setPosition(c.c[0], c.c[1], c.c[2]);
    m.matrixAutoUpdate = false;
    m.matrix.copy(M);
    debug.add(m);
  }
  debug.add(capsuleDbg);
}

// ---------------------------------------------------------------------------- HUD
const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—');
function updateHud(game, levelFrom) {
  const h = game.hud();
  const gn = GRAVITY_NAMES[h.gravityKey] || { uz: '?', en: '?' };
  $('hSpeed').textContent = fmt(h.speed);
  $('hG').textContent = fmt(h.g);
  $('hGName').textContent = `${gn.uz} · ${gn.en}`;
  $('hBag').textContent = `${h.bagKg} kg`;
  $('hMass').textContent = `${h.personKg} + ${h.suitKg} + ${h.bagKg} = ${h.totalKg} kg`;
  $('hFactor').textContent = `×${fmt(h.factor)}  (${fmt(h.walk, 1)} / ${fmt(h.run, 1)} m/s)`;
  $('hJump').textContent = `${fmt(h.jumpH)} m`;
  $('hFormula').textContent = `h = v²/2g = ${fmt(h.v0)}² / (2 × ${fmt(h.g)})`;
  if (h.gravityKey === 'earth') {
    const hm = jumpHeight(h.v0, GRAVITY.moon);
    $('hCompare').textContent = `Oyda / on the Moon: ${fmt(hm)} m (${fmt(hm / h.jumpH, 1)}× baland)`;
  } else {
    $('hCompare').textContent = `Yerda / on Earth: ${fmt(h.jumpHEarth)} m → bu yerda ${fmt(h.ratio, 1)}× baland`;
  }
  $('hLast').textContent = h.lastJumpPeak > 0 ? `${fmt(h.lastJumpPeak)} m` : '—';
  $('hWeight').textContent = h.gravityKey === 'earth'
    ? `${Math.round(h.weightN)} N  (Oyda ${Math.round(h.totalKg * GRAVITY.moon)} N)`
    : `${Math.round(h.weightN)} N  (Yerda ${Math.round(h.weightNEarth)} N)`;
  let prompt = '';
  if (game.messageT > 0) prompt = game.message;
  else if (h.pouring) prompt = 'Suv quyilmoqda… · Pouring water';
  else if (h.nearBag) prompt = `E — sumkani olish (${game.bagMass(h.nearBag)} kg) · pick up the bag`;
  else if (h.carrying) prompt = "E — sumkani qo'yish · F — suv quyish  ·  drop / pour";
  else if (game.nearIce()) prompt = 'Muz (ICE) — suv manbai · water ice';
  const pe = $('prompt');
  pe.textContent = prompt;
  pe.style.opacity = prompt ? '1' : '0';
  $('status').textContent = `Level: ${levelFrom} · Osmon/Sky: ${env.skyFrom}` +
    (usedAssets.length ? ` · Assets: ${usedAssets.join(', ')}` : '');
}

function fatal(msg) {
  const el = $('loading');
  if (el) {
    el.classList.add('error');
    el.style.display = 'flex';
  }
  loadText(msg);
}

// ---------------------------------------------------------------------------- main
async function main() {
  loadText('Yuklanmoqda / Loading…');
  const [manifest] = await Promise.all([getJSON('manifest.json'), setupSky()]);
  let look = null;
  if (params.get('look') !== '0') {
    try {
      const terrainUrl = new URL('../../data/terrain/site.json', location.href).href;
      look = await createLook({ renderer, scene, camera, sun, hemi, env, params, touchFirst, terrainUrl });
    } catch (e) {
      console.warn('look: plain scene', e);
    }
  }

  let levelRoot = null, levelFrom = 'placeholder (oy_level.glb hali yo\'q)';
  if (params.get('level') !== 'none') {
    const lv = await loadGLB('levels/oy_level.glb');
    if (lv) {
      levelRoot = lv.scene;
      levelFrom = 'levels/oy_level.glb';
    }
  }
  if (!levelRoot) {
    levelRoot = buildFallbackLevel();
    if (params.get('props') !== '0') await decorateFallback(levelRoot);   // ?props=0: boxes only (weak tablets)
  }
  if (look) {
    loadText('Yuklanmoqda / Loading: Oy relyefi (NASA LRO LOLA)…');
    await new Promise((r) => setTimeout(r, 0));
    look.dressLevel(levelRoot);
  }
  scene.add(levelRoot);

  const cg = await loadGLB('characters/astronaut.glb');
  const character = cg ? setupCharacter(cg) : fallbackCharacter();
  scene.add(character.model);

  const gKey = ['moon', 'earth', 'mars'].includes(params.get('g')) ? params.get('g') : 'moon';
  const game = new Game({ levelRoot, character, manifest, gravityKey: gKey });
  if (look) look.attach(game);

  const input = new Input(canvas, {
    stick: $('stick'), knob: $('knob'),
    btnJump: $('btnJump'), btnUse: $('btnUse'), btnRun: $('btnRun'), btnPour: $('btnPour'),
    onLock: (on) => document.body.classList.toggle('locked', on),
  });
  input.yaw = game.facing + Math.PI;          // start behind the player
  if (debug.visible) rebuildDebug(game);

  $('loading').style.display = 'none';
  if (!cg) game.say("astronaut.glb topilmadi — kapsula ishlatildi · character missing", 6);

  const clock = new THREE.Clock();
  let camDist = input.dist, hudT = 0;
  const tgt = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (input.consume('gravity')) game.cycleGravity();
    if (input.consume('respawn')) game.respawn();
    if (input.consume('help')) document.body.classList.toggle('nohelp');
    if (input.consume('debug')) {
      debug.visible = !debug.visible;
      if (debug.visible) rebuildDebug(game);
    }

    game.update(dt, input.controls());

    // camera: zoom in at once when blocked, ease back out
    const want = game.cameraPose(input.yaw, input.pitch, input.dist).dist;
    camDist = want < camDist ? want : camDist + (want - camDist) * (1 - Math.exp(-4 * dt));
    const pose = game.cameraPose(input.yaw, input.pitch, camDist);
    camera.position.fromArray(pose.position);
    camera.lookAt(tgt.fromArray(pose.target));

    // sun + shadow box follow the player
    const p = game.body.pos;
    sun.target.position.set(p[0], p[1], p[2]);
    sun.position.set(p[0], p[1], p[2]).addScaledVector(env.sunDir, 70);
    if (env.stars) env.stars.position.copy(camera.position);
    if (env.earth) {
      const D = 900;
      env.earth.position.copy(camera.position).addScaledVector(env.earthDir, D);
      env.earth.scale.setScalar(D * Math.tan(env.earthDiam * DEG / 2));
    }
    if (debug.visible) {
      capsuleDbg.position.set(p[0], p[1] + BODY.height / 2, p[2]);
      if ((debugT -= dt) < 0) { debugT = 0.5; rebuildDebug(game); }
    }

    if ((hudT -= dt) < 0) {
      hudT = 0.1;
      updateHud(game, levelFrom);
    }
    if (look) {
      look.frame(dt);
      look.render();
    } else {
      renderer.render(scene, camera);
    }
  });
  window.__game = game;   // for poking around in the browser console
  window.__demo = { renderer, scene, camera, game, input };   // scripts/shot-demo.mjs reads renderer.info
}

main().catch((e) => {
  console.error(e);
  fatal('Xato / Error: ' + (e && e.message ? e.message : e));
});

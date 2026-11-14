// The demo's look: real LOLA ground and skyline, rocks, boot prints, dust, reflections, the Sun's glare,
// a colour grade, and quality that steps down on slow phones. demo.js calls it; ?look=0 turns it all off.
//
//   const look = await createLook({ renderer, scene, camera, sun, hemi, env, params, touchFirst, at });
//   look.dressLevel(levelRoot)   before new Game(): ground, rocks, collision boxes (placeholder level only)
//   look.attach(game)            after new Game(): boot prints and dust follow the player
//   look.frame(dt)               every frame, after the Sun has been moved to the player
//   look.render()                instead of renderer.render(scene, camera)
import * as THREE from 'three';
import { Heights, NEAR_R, PLAY, buildNear, buildCollider, buildFar, regolithMaterial, updateRegolith } from './terrain.js';
import { buildRocks } from './rocks.js';
import { regolithTextures, glareTexture } from './textures.js';
import { GroundFx } from './fx.js';

const TIERS = {
  // phones and tablets: no post-processing, coarser ground, fewer rocks
  low: { step: 4, azStep: 2, big: 40, boulders: 110, pebbles: 300, tex: 256, composer: false, shadow: 1024, maxRatio: 1.5 },
  high: { step: 3, azStep: 1, big: 70, boulders: 200, pebbles: 650, tex: 512, composer: true, shadow: 2048, maxRatio: 2 },
};

async function loadJSON(url) {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    return r.ok ? await r.json() : null;
  } catch (_) {
    return null;
  }
}

/** A small sky for reflections: black space, the Sun, and the bright sunlit ground below the horizon. */
function reflectionEnvironment(renderer, sunDir) {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    const ground = THREE.MathUtils.smoothstep(-y, -0.02, 0.12);          // below the horizon: lit regolith
    const v = 0.003 + ground * 0.32;
    col.set([v, v * 0.98, v * 0.94], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(40, 39, 37) }));
  sunBall.position.copy(sunDir).multiplyScalar(9);
  s.add(sunBall);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(s, 0.02);
  pmrem.dispose();
  return rt.texture;
}

const GRADE = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.32 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
uniform sampler2D tDiffuse; uniform float uVignette; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  c.rgb = mix(c.rgb, c.rgb * vec3(0.94, 0.98, 1.06), 1.0 - smoothstep(0.0, 0.45, l));   // cool shadows
  c.rgb = mix(c.rgb, c.rgb * vec3(1.04, 1.01, 0.96), smoothstep(0.55, 1.0, l));         // warm sunlit white
  vec2 d = vUv - 0.5; d.x *= 1.2;
  c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(d));
  gl_FragColor = c;
}`,
};

export async function createLook({ renderer, scene, camera, sun, hemi, env, params, touchFirst, at }) {
  const tierName = TIERS[params.get('q')] ? params.get('q') : touchFirst ? 'low' : 'high';
  const tier = { ...TIERS[tierName] };
  const site = await loadJSON(at('terrain/site.json'));
  const H = new Heights(site);
  const sunDir = env.sunDir.clone().normalize();

  renderer.autoClear = false;
  renderer.setPixelRatio(Math.min(devicePixelRatio, tier.maxRatio));
  sun.shadow.mapSize.set(tier.shadow, tier.shadow);

  // reflections and the ground's bounce light (the shadow side of a suit on the Moon is lit from below)
  const envMap = reflectionEnvironment(renderer, sunDir);
  scene.environment = envMap;
  scene.environmentIntensity = 0.55;
  hemi.intensity = Math.min(hemi.intensity, 0.4);

  // ---------------------------------------------------------------- far layer: sky, skyline, Sun
  // Drawn first with its own near/far planes (60 m … 120 km), then the depth is cleared for the near scene.
  const far = new THREE.Scene();
  far.background = scene.background;
  far.backgroundRotation.copy(scene.backgroundRotation);
  scene.background = null;
  far.environment = envMap;
  far.environmentIntensity = 0.55;
  const farCam = new THREE.PerspectiveCamera(camera.fov, camera.aspect, 60, 130000);
  const farSun = new THREE.DirectionalLight(sun.color, sun.intensity);
  farSun.position.copy(sunDir);
  far.add(farSun, hemi.clone());
  // below the real skyline there is no grey ground in the panorama: there is black sky
  const skirt = new THREE.Mesh(
    new THREE.SphereGeometry(110000, 48, 12, 0, Math.PI * 2, Math.PI / 2 + 0.002, Math.PI / 2 - 0.002),
    new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, depthWrite: false, fog: false }));
  skirt.renderOrder = -5;
  far.add(skirt);
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glareTexture(), color: new THREE.Color(6, 6, 6), blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  const GLARE_D = 100000;
  glare.scale.setScalar(GLARE_D * Math.tan(THREE.MathUtils.degToRad(4.5)) * 2);
  far.add(glare);

  const regolithFar = regolithMaterial({ surge: 0.35 });
  const farMesh = new THREE.Mesh(buildFar(H, { azStep: tier.azStep, sun: sunDir }), regolithFar);
  farMesh.name = 'look_far_terrain';
  far.add(farMesh);

  // ---------------------------------------------------------------- near ground, rocks, prints
  const tex = regolithTextures(renderer, tier.tex);
  const regolithNear = regolithMaterial({ detail: tex.albedo, detailNormal: tex.slope, surge: 0.5 });
  let fx = null;
  let ownGround = false;
  let noShadow = [];   // ground and pebbles: their shadows are baked (sunVis) or too small to matter

  function dressLevel(root) {
    if (root.name !== 'fallback_level') return;   // a real level GLB keeps its own ground
    ownGround = true;
    for (const o of [...root.children]) {
      const isOldGround = o.name === 'ground' || o.name === 'COL_ground';
      const isOldRock = o.isMesh && o.geometry && o.geometry.type === 'DodecahedronGeometry';
      if (isOldGround || isOldRock) o.removeFromParent();
    }
    const near = new THREE.Mesh(buildNear(H, { step: tier.step, radius: NEAR_R, sun: sunDir }), regolithNear);
    near.name = 'ground';                       // parseLevel's fallback would also find it by this name
    near.receiveShadow = true;
    root.add(near);
    const col = new THREE.Mesh(buildCollider(H, { step: tier.step, half: PLAY }));
    col.name = 'COL_ground';
    col.visible = false;
    root.add(col);
    const rocks = buildRocks(H, { big: tier.big, boulders: tier.boulders, pebbles: tier.pebbles, play: PLAY - 1 });
    root.add(rocks.big, rocks.boulders, rocks.pebbles);
    noShadow = [near, rocks.pebbles];
    rocks.colliders.forEach((c, i) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(c.sx, c.sy, c.sz));
      box.position.set(c.x, c.y, c.z);
      box.rotation.y = c.yaw;
      box.name = 'COL_rock_' + i;
      box.visible = false;
      root.add(box);
    });
  }

  function attach(game) {
    for (const o of noShadow) o.castShadow = false;   // parseLevel turned every visible mesh on
    if (ownGround) fx = new GroundFx(scene, renderer);
    look.game = game;
  }

  // ---------------------------------------------------------------- counts (camera passes only, like scripts/shot.mjs:
  // three resets renderer.info after the shadow pass, so shadows are not in these numbers)
  let calls = 0, triangles = 0;
  const tally = () => {
    calls += renderer.info.render.calls;
    triangles += renderer.info.render.triangles;
  };
  const count = (pass) => {
    const draw = pass.render.bind(pass);
    pass.render = (...a) => {
      draw(...a);
      tally();
    };
    return pass;
  };

  // ---------------------------------------------------------------- post-processing (desktop)
  let composer = null;
  const vignette = document.createElement('div');
  vignette.style.cssText = 'position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.42) 100%)';
  async function setupComposer() {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { ShaderPass }] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
      import('three/addons/postprocessing/OutputPass.js'),
      import('three/addons/postprocessing/ShaderPass.js'),
    ]);
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(renderer, target);
    const farPass = new RenderPass(far, farCam);
    const nearPass = new RenderPass(scene, camera);
    nearPass.clear = false;
    nearPass.clearDepth = true;
    c.addPass(count(farPass));
    c.addPass(count(nearPass));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.22, 0.4, 1.6));
    c.addPass(new OutputPass());
    c.addPass(new ShaderPass(GRADE));
    return c;
  }
  if (tier.composer) {
    try {
      composer = await setupComposer();
    } catch (e) {
      console.warn('post-processing unavailable', e);
    }
  }
  if (!composer) document.body.appendChild(vignette);
  const resize = () => {
    if (!composer) return;
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------- quality steps on slow devices
  let warm = 0, acc = 0, frames = 0, fps = 0, steps = 0;
  function adapt(dt) {
    warm += dt;
    if (warm < 4) return;
    acc += dt;
    frames++;
    if (acc < 2) return;
    fps = frames / acc;
    acc = 0;
    frames = 0;
    if (fps >= 28 || steps >= 4) return;
    steps++;
    if (composer) {                              // first drop the post-processing
      composer = null;
      document.body.appendChild(vignette);
    } else if (renderer.getPixelRatio() > 0.8) {
      renderer.setPixelRatio(Math.max(0.75, renderer.getPixelRatio() - 0.35));
    } else if (renderer.shadowMap.enabled && sun.shadow.mapSize.x > 1024) {
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  }

  // ---------------------------------------------------------------- per frame
  const R = new THREE.Vector3(), U = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  /** Shadows that do not shimmer: move the shadow box in whole shadow-map texels. */
  function snapShadow() {
    const cam = sun.shadow.camera;
    const texel = (cam.right - cam.left) / sun.shadow.mapSize.x;
    R.crossVectors(UP, sunDir).normalize();
    U.crossVectors(sunDir, R);
    const t = sun.target.position;
    const a = t.dot(R), b = t.dot(U);
    t.addScaledVector(R, Math.round(a / texel) * texel - a).addScaledVector(U, Math.round(b / texel) * texel - b);
    sun.position.copy(t).addScaledVector(sunDir, 70);
  }

  const look = {
    tier: tierName,
    game: null,
    dressLevel,
    attach,
    frame(dt) {
      adapt(dt);
      snapShadow();
      farCam.fov = camera.fov;
      farCam.aspect = camera.aspect;
      farCam.updateProjectionMatrix();
      farCam.position.copy(camera.position);
      farCam.quaternion.copy(camera.quaternion);
      farCam.updateMatrixWorld();
      skirt.position.copy(camera.position);
      glare.position.copy(camera.position).addScaledVector(sunDir, GLARE_D);
      camera.updateMatrixWorld();
      updateRegolith(regolithNear, sunDir, camera);
      updateRegolith(regolithFar, sunDir, farCam);
      if (fx && look.game) fx.update(dt, look.game);
    },
    render() {
      calls = 0;
      triangles = 0;
      if (composer) {
        composer.render();
      } else {
        renderer.clear(true, true, true);
        renderer.render(far, farCam);
        tally();
        renderer.clearDepth();
        renderer.render(scene, camera);
        tally();
      }
    },
    stats() {
      return {
        tier: tierName, post: !!composer, ratio: renderer.getPixelRatio(), fps: Math.round(fps), calls, triangles,
        terrain: site ? 'LOLA' : 'procedural',
      };
    },
  };
  window.__look = look;
  return look;
}

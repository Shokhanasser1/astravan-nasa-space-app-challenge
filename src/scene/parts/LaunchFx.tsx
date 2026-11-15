import { useEffect, useImperativeHandle, useMemo, useRef, type Ref, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { initialTier } from '../quality';
import {
  FX_S,
  GLSL_LIFT,
  IGNITION_S,
  MOON_G,
  blastCount,
  blastLevel,
  flickerAmp,
  makeBlast,
  plumeLevel,
} from '../launchFx';

/**
 * Day 7 liftoff (features.launchFx; the lead, 15 Nov: "no smoke, no fire at liftoff — make it as real as you can,
 * without lag"). Three draw calls while it plays, none before or after:
 *  1. the engine plume — short and wide (a vacuum plume), a white-blue core at the nozzle fading to a translucent
 *     orange and blue fan, shimmering by shader noise; additive, not tone-mapped, so it passes Bloom;
 *  2. a warm glow on the ground under the nozzle, strongest on the pad, gone by ~15 m;
 *  3. the regolith blast — thousands of grains in one THREE.Points, each computed on the GPU from its own row of a
 *     fixed table and the time (p = p0 + v·t + ½·g·t², src/scene/launchFx.ts): flat fast sheets, slower arcs that
 *     land where they fall, a little low haze and a few bright foil flecks. The CPU writes four uniforms a frame.
 * No light is added (a new light recompiles every shader), no camera shake, the shimmer stays small and slow-ish
 * (seizure safety; calmer with prefers-reduced-motion). The materials are drawn (invisibly) in the first frames
 * after mount, so their shaders are compiled long before the launch; then they are hidden until it.
 * Positions are in the lander's own frame (Lander.tsx's outer group: on the ground, not turned).
 */

export interface LaunchFxApi {
  /**
   * One frame, from Lander's useFrame: `t` = s since the lander started to move (negative before), `h` = its height,
   * `on` = the launch is playing. Returns true while the effect still needs frames (call invalidate()).
   */
  update(t: number, h: number, on: boolean): boolean;
}

const reduced = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
/** Frames drawn with everything at zero right after mount: the shaders compile then, not at liftoff. */
const WARM_FRAMES = 3;
const buf = new THREE.Vector2();
const box = new THREE.Box3();

/** Periodic value noise (period `p` along x, so the plume has no seam where its surface closes). */
const GLSL_NOISE = /* glsl */ `
float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float pnoise(vec2 q, float p) {
  vec2 i = floor(q), f = fract(q);
  f = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, p), x1 = mod(i.x + 1.0, p);
  return mix(mix(hash(vec2(x0, i.y)), hash(vec2(x1, i.y)), f.x), mix(hash(vec2(x0, i.y + 1.0)), hash(vec2(x1, i.y + 1.0)), f.x), f.y);
}
`;

const PLUME_VERT = /* glsl */ `
attribute float aCore;
varying vec2 vUv;
varying float vCore;
varying vec3 vN;
varying vec3 vV;
varying float vWy;
void main() {
  vUv = uv;
  vCore = aCore;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWy = wp.y;
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const PLUME_FRAG = /* glsl */ `
uniform float uTime;
uniform float uLevel;
uniform float uFlick;
uniform float uGroundY;
varying vec2 vUv;
varying float vCore;
varying vec3 vN;
varying vec3 vV;
varying float vWy;
${GLSL_NOISE}
void main() {
  // (clamped: pow() of a negative number is NaN, and one NaN pixel turns the whole Bloom frame black)
  float s = clamp(vUv.y, 0.0, 1.0); // 0 at the nozzle, 1 at the plume's far end
  float face = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0); // 1 = the plume's middle as seen, 0 = its outline
  float streak = pnoise(vec2(vUv.x * 20.0, s * 5.0 - uTime * 6.0), 20.0);
  float shimmer = pnoise(vec2(vUv.x * 4.0, uTime * 7.0), 4.0) - 0.5;
  vec3 col;
  if (vCore > 0.5) {
    float a = pow(1.0 - s, 2.2) * pow(face, 0.6);
    col = vec3(2.4, 2.7, 3.4) * a * (1.0 + uFlick * 0.5 * shimmer);
  } else {
    float a = pow(1.0 - s, 1.7) * pow(face, 1.6) * (0.65 + 0.7 * streak);
    vec3 hot = vec3(1.1, 1.15, 1.5);
    vec3 warm = vec3(1.0, 0.42, 0.13);
    vec3 cool = vec3(0.22, 0.32, 0.95);
    col = mix(hot, warm, smoothstep(0.03, 0.4, s));
    col = mix(col, cool, 0.55 * smoothstep(0.45, 0.95, s));
    col *= a * 0.6 * (1.0 + uFlick * shimmer);
  }
  // soft where the plume meets the ground: no hard cut line
  col *= smoothstep(uGroundY, uGroundY + 0.7, vWy);
  gl_FragColor = vec4(col * uLevel, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const GLOW_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GLOW_FRAG = /* glsl */ `
uniform float uLevel;
uniform float uSigma;
varying vec2 vP;
void main() {
  float r2 = dot(vP, vP);
  float s2 = uSigma * uSigma;
  float a = exp(-r2 / (2.0 * s2)) + 0.22 * exp(-r2 / (18.0 * s2));
  a *= 1.0 - smoothstep(20.0, 42.0, r2); // the plane is 14 m wide: fade well inside its edge
  vec3 col = mix(vec3(1.0, 0.42, 0.14), vec3(1.7, 1.45, 1.15), exp(-r2 / (0.6 * s2)));
  gl_FragColor = vec4(col * a * uLevel, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const DUST_VERT = /* glsl */ `
attribute vec4 aA; // birth t, azimuth, speed, elevation
attribute vec4 aB; // size, kind, start height, random
uniform float uT;
uniform float uOn;
uniform float uPx;
uniform float uNozzleY;
uniform float uPlume;
uniform float uTwinkle;
uniform vec3 uDust;
uniform vec3 uFire;
varying vec4 vCol;
${GLSL_LIFT}
const float G = ${MOON_G.toFixed(2)};
void main() {
  float age = uT - aA.x;
  if (uOn < 0.5 || age < 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vCol = vec4(0.0);
    return;
  }
  float kind = aB.y, rnd = aB.w, y0 = aB.z;
  float hb = liftHeight(aA.x);
  // how hard the plume hit the ground when this grain was thrown: the ignition ramp, then the lander's height
  float s = blastLevel(hb) * mix(0.3, 1.0, clamp((aA.x + ${IGNITION_S.toFixed(2)}) / ${IGNITION_S.toFixed(2)}, 0.0, 1.0));
  float v = aA.z * mix(0.45, 1.0, s);
  float vh = v * cos(aA.w), vy = v * sin(aA.w);
  float tl = (vy + sqrt(vy * vy + 2.0 * G * y0)) / G; // back on the ground: it stays where it fell
  float ta = min(age, tl);
  vec2 dir = vec2(cos(aA.y), sin(aA.y));
  float r = 0.35 + 0.4 * hb + vh * ta; // thrown from the plume's footprint, which widens as the lander rises
  vec3 p = vec3(dir.x * r, max(0.02, y0 + vy * ta - 0.5 * G * ta * ta), dir.y * r);

  float a, size = aB.x, settle;
  vec3 col = uDust * (0.7 + 0.6 * rnd);
  if (kind < 0.5) { // sheet
    a = 0.32; settle = 0.5;
    size *= 1.0 + 0.5 * ta;
    a *= 1.0 - smoothstep(1.8, 3.2, age);
  } else if (kind < 1.5) { // arc
    a = 0.5; settle = 0.7;
    size *= 1.0 + 0.2 * ta;
  } else if (kind < 2.5) { // haze
    a = 0.14; settle = 3.0;
    size *= 1.0 + 0.5 * age;
  } else { // foil fleck: tumbles (≤ 2 Hz, tiny), gold
    a = 1.0; settle = 1.5;
    col = vec3(1.7, 1.25, 0.45) * (1.0 - uTwinkle * 0.6 * (0.5 + 0.5 * sin(age * 12.566 + rnd * 6.283)));
  }
  a *= 1.0 - smoothstep(tl, tl + settle, age);
  a *= pow(s, 0.7);
  a *= 1.0 - smoothstep(15.0, 27.0, r);
  // lit by the flame while close to it
  vec3 noz = vec3(0.0, uNozzleY + liftHeight(uT), 0.0);
  vec3 dn = p - noz;
  col += uFire * uPlume * exp(-dot(dn, dn) / 4.0);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = max(0.1, -mv.z);
  float px = size * uPx * projectionMatrix[1][1] / depth;
  a *= smoothstep(1.2, 4.0, depth);   // not in the camera's face
  a *= clamp(px, 0.0, 1.0);           // smaller than a pixel: fainter, not flickering
  gl_PointSize = clamp(px, 1.0, 72.0);
  gl_Position = projectionMatrix * mv;
  vCol = vec4(col, a);
}
`;

const DUST_FRAG = /* glsl */ `
varying vec4 vCol;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0 || vCol.a <= 0.002) discard;
  float k = 1.0 - r2;
  gl_FragColor = vec4(vCol.rgb, vCol.a * k * k);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** The plume's two shells (outer fan, inner core) as one geometry: one draw call. Points down from y = 0. */
function plumeGeometry(): THREE.BufferGeometry {
  const shell = (len: number, r0: number, r1: number, expo: number, core: number) => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const s = i / 12;
      pts.push(new THREE.Vector2(r0 + (r1 - r0) * s ** expo, -len * s));
    }
    const g = new THREE.LatheGeometry(pts, 28);
    g.setAttribute('aCore', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(core), 1));
    return g;
  };
  const outer = shell(3.4, 0.46, 2.7, 0.6, 0);
  const core = shell(1.4, 0.36, 0.62, 1, 1);
  const g = mergeGeometries([outer, core]) ?? outer;
  if (g !== outer) outer.dispose();
  core.dispose();
  return g;
}

export function LaunchFx({ ref, nozzleY, top }: { ref?: Ref<LaunchFxApi>; nozzleY: number; top?: RefObject<THREE.Object3D | null> }) {
  const plume = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const dust = useRef<THREE.Points>(null);
  const st = useRef({ frames: 0, nozzle: Number.NaN }).current;
  const gl = useThree((s) => s.gl);

  const parts = useMemo(() => {
    const n = blastCount(initialTier());
    const { a, b } = makeBlast(n);
    const dustGeo = new THREE.BufferGeometry();
    // (positions are computed in the shader from aA/aB; `position` only gives three.js the count)
    dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    dustGeo.setAttribute('aA', new THREE.BufferAttribute(a, 4));
    dustGeo.setAttribute('aB', new THREE.BufferAttribute(b, 4));
    const dustMat = new THREE.ShaderMaterial({
      name: 'launchFx-dust',
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      uniforms: {
        uT: { value: 0 },
        uOn: { value: 0 },
        uPx: { value: 400 },
        uNozzleY: { value: nozzleY },
        uPlume: { value: 0 },
        uTwinkle: { value: reduced ? 0 : 1 },
        uDust: { value: new THREE.Color(0.12, 0.115, 0.106) },
        uFire: { value: new THREE.Color(0.55, 0.24, 0.08) },
      },
      transparent: true,
      depthWrite: false,
    });
    const plumeGeo = plumeGeometry();
    const plumeMat = new THREE.ShaderMaterial({
      name: 'launchFx-plume',
      vertexShader: PLUME_VERT,
      fragmentShader: PLUME_FRAG,
      uniforms: { uTime: { value: 0 }, uLevel: { value: 0 }, uFlick: { value: flickerAmp(reduced) }, uGroundY: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const glowGeo = new THREE.PlaneGeometry(14, 14);
    const glowMat = new THREE.ShaderMaterial({
      name: 'launchFx-glow',
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: { uLevel: { value: 0 }, uSigma: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    return { dustGeo, dustMat, plumeGeo, plumeMat, glowGeo, glowMat };
  }, [nozzleY]);

  useEffect(
    () => () => {
      for (const o of Object.values(parts)) o.dispose();
    },
    [parts],
  );

  useImperativeHandle(
    ref,
    () => ({
      update(t, h, on) {
        const p = plume.current, g = glow.current, d = dust.current;
        if (!p || !g || !d) return false;
        st.frames++;
        const tau = t + IGNITION_S;
        const lit = on && tau > 0;
        const flame = lit && h < 400; // the plume: as long as the lander is in the sky (Lander.tsx hides it at 400 m)
        const blastOn = lit && tau < FX_S; // the grains, until the last have landed and faded
        const glowOn = blastOn && h < 40; // the ground glow (blastLevel(40) ≈ 0.015)
        const warm = st.frames <= WARM_FRAMES;
        p.visible = flame || warm;
        g.visible = glowOn || warm;
        d.visible = blastOn || warm;
        const U = parts.dustMat.uniforms;
        if (!lit) {
          parts.plumeMat.uniforms.uLevel.value = 0;
          parts.glowMat.uniforms.uLevel.value = 0;
          U.uOn.value = 0;
          return false;
        }
        // NASA model: the ascent stage lifts off its descent stage — the flame comes from the stage's underside
        const lm = top?.current;
        if (lm && Number.isNaN(st.nozzle)) st.nozzle = box.setFromObject(lm).min.y - h;
        const ny = lm && !Number.isNaN(st.nozzle) ? st.nozzle : nozzleY;
        const level = plumeLevel(t);
        const ign = Math.min(1, tau / IGNITION_S);
        p.position.y = ny + h;
        p.scale.set(0.8 + 0.2 * ign, 0.4 + 0.6 * ign, 0.8 + 0.2 * ign);
        parts.plumeMat.uniforms.uLevel.value = level;
        parts.plumeMat.uniforms.uTime.value = reduced ? tau * 0.4 : tau;
        const blast = blastLevel(h);
        parts.glowMat.uniforms.uLevel.value = 1.3 * level * blast;
        parts.glowMat.uniforms.uSigma.value = 0.9 + 0.3 * h;
        U.uOn.value = 1;
        U.uT.value = t;
        U.uNozzleY.value = ny;
        U.uPlume.value = Math.min(1, level);
        // half the drawing buffer's height in pixels; × projection[1][1] / depth = pixels per metre
        U.uPx.value = 0.5 * gl.getDrawingBufferSize(buf).y;
        return flame || blastOn;
      },
    }),
    [parts, nozzleY, top, st, gl],
  );

  return (
    <>
      <mesh ref={plume} geometry={parts.plumeGeo} material={parts.plumeMat} frustumCulled={false} renderOrder={2} />
      <mesh
        ref={glow}
        geometry={parts.glowGeo}
        material={parts.glowMat}
        position={[0, 0.06, 0]}
        rotation-x={-Math.PI / 2}
        frustumCulled={false}
        renderOrder={1}
      />
      <points ref={dust} geometry={parts.dustGeo} material={parts.dustMat} frustumCulled={false} renderOrder={1} />
    </>
  );
}

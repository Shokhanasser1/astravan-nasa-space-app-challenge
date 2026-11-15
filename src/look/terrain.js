// Real ground of the base site: NASA LRO LOLA heights (public/data/terrain/site.json, built by
// scripts/data/moon_terrain.py) + small craters and bumps the 5 m grid cannot show + the graded base pad.
// Near: a disc of ground around the base (walkable, takes shadows). Far: rings out to 60 km, the real skyline.
// Used by src/scene/ground.ts and Terrain.tsx.
import * as THREE from 'three';
import { rng, fbm, noise, smoothstep } from './noise.js';

/** Default flat graded pad (the game passes its own, src/scene/ground.ts). */
export const PAD = { x: 0, z: 0, rx: 20, rz: 20, blend: 14 };
export const NEAR_R = 150;      // radius of the near ground disc, m

const REGOLITH = '#8d8a84';   // mature lunar soil, slightly warm grey (sRGB)

/**
 * site: public/data/terrain/site.json (or null: made-up ground). Options, all for the main game (the demo uses none):
 *   pad     the flat graded area { x, z, rx, rz, blend } (default: the demo's base pad)
 *   extra   (x, z) => metres added on top of the real ground (a game's own hill or crater)
 *   frame   [a, b, c, d]: scene (x, z) -> the file's frame (a·x + b·z, c·x + d·z); default identity
 *   color   soil colour (sRGB)
 */
export class Heights {
  /**
   * @param {any} site
   * @param {number} [seed]
   * @param {{ pad?: { x: number, z: number, rx: number, rz: number, blend: number },
   *   extra?: ((x: number, z: number) => number) | null, frame?: number[] | null, color?: string }} [opts]
   */
  constructor(site, seed = 2026, { pad = PAD, extra = null, frame = null, color = REGOLITH } = {}) {
    this.site = site;
    this.pad = pad;
    this.extra = extra;
    this.frame = frame;
    this.color = new THREE.Color(color);
    if (site) {
      const n = site.near, f = site.far;
      this.nn = n.n;
      this.nh = Float32Array.from(n.h, (v) => v / 100);
      this.nhalf = n.half_m;
      this.nstep = n.step_m;
      this.radii = f.radii_m;
      this.azn = f.az_n;
      this.fh = Float32Array.from(f.h, (v) => v / 10);
      this.ringK = Math.log(this.radii[1] / this.radii[0]);
    }
    // craters of 2–11 m radius (the 5 m grid already has the bigger ones); none on the pad
    const r = rng(seed);
    this.craters = [];
    for (let i = 0; i < 600 && this.craters.length < 110; i++) {
      const R = 2 + 9 * Math.pow(r(), 2.4);
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (NEAR_R + 6);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.padDist(x, z) < 1 + (R + 3) / pad.rx) continue;
      const fresh = r();
      this.craters.push({ x, z, R, depth: R * (0.06 + 0.16 * fresh), fresh });
    }
    this.cell = 12;
    this.grid = new Map();
    for (const c of this.craters) {
      const reach = c.R * 1.8;
      for (let gx = Math.floor((c.x - reach) / this.cell); gx <= Math.floor((c.x + reach) / this.cell); gx++)
        for (let gz = Math.floor((c.z - reach) / this.cell); gz <= Math.floor((c.z + reach) / this.cell); gz++) {
          const k = gx * 4096 + gz;
          if (!this.grid.has(k)) this.grid.set(k, []);
          this.grid.get(k).push(c);
        }
    }
  }

  /** Elliptic distance to the pad centre, 1 = pad edge. */
  padDist(x, z) {
    const p = this.pad;
    return Math.hypot((x - p.x) / p.rx, (z - p.z) / p.rz);
  }
  /** 1 on the pad, 0 outside its blend zone. */
  padWeight(x, z) {
    return 1 - smoothstep(1, 1 + this.pad.blend / this.pad.rx, this.padDist(x, z));
  }

  /** Real heights (m, scene frame): the 5 m grid inside its square, the far rings outside. */
  dem(x0, z0) {
    const f = this.frame;
    const x = f ? f[0] * x0 + f[1] * z0 : x0, z = f ? f[2] * x0 + f[3] * z0 : z0;
    if (!this.site) return 2.5 * fbm(x / 140, z / 140, 3, 3) + 0.8 * fbm(x / 35, z / 35, 5, 3);
    const s = this.nstep, n = this.nn;
    const fx = (x + this.nhalf) / s, fz = (z + this.nhalf) / s;
    if (fx >= 0 && fz >= 0 && fx < n - 1 && fz < n - 1) {
      const j = Math.floor(fx), i = Math.floor(fz), tx = fx - j, tz = fz - i, h = this.nh, k = i * n + j;
      return (h[k] * (1 - tx) + h[k + 1] * tx) * (1 - tz) + (h[k + n] * (1 - tx) + h[k + n + 1] * tx) * tz;
    }
    return this.far(x, z);
  }

  far(x, z) {
    const r = Math.hypot(x, z);
    const radii = this.radii, az = this.azn, h = this.fh;
    let fr = Math.log(Math.max(r, radii[0]) / radii[0]) / this.ringK;
    fr = Math.min(fr, radii.length - 1.0001);
    const i = Math.floor(fr), tr = fr - i;
    let fa = (Math.atan2(z, x) / (Math.PI * 2)) * az;
    if (fa < 0) fa += az;
    const a0 = Math.floor(fa) % az, a1 = (a0 + 1) % az, ta = fa - Math.floor(fa);
    const v0 = h[i * az + a0] * (1 - ta) + h[i * az + a1] * ta;
    const v1 = h[(i + 1) * az + a0] * (1 - ta) + h[(i + 1) * az + a1] * ta;
    return v0 * (1 - tr) + v1 * tr;
  }

  /** Small relief: craters and gentle bumps (m). */
  detail(x, z) {
    let y = 0.22 * fbm(x / 9, z / 9, 11, 3) + 0.05 * noise(x / 1.7, z / 1.7, 13);
    const list = this.grid.get(Math.floor(x / this.cell) * 4096 + Math.floor(z / this.cell));
    if (list) {
      for (const c of list) {
        const q = Math.hypot(x - c.x, z - c.z) / c.R;
        if (q > 1.8) continue;
        if (q < 1) y += c.depth * (q * q - 1);
        const t = (q - 1) / (0.22 + 0.1 * (1 - c.fresh));
        y += c.depth * 0.32 * Math.exp(-t * t);
      }
    }
    return y;
  }

  /** The ground the player walks on. */
  height(x, z) {
    const w = this.padWeight(x, z);
    if (w >= 1) return 0;
    return (this.dem(x, z) + this.detail(x, z) + (this.extra ? this.extra(x, z) : 0)) * (1 - w);
  }

  /** Albedo multiplier: fresh crater ejecta brighter, the trodden pad darker, broad patches. */
  tint(x, z) {
    let k = 1 + 0.07 * fbm(x / 30, z / 30, 21, 3) + 0.04 * noise(x / 4, z / 4, 23);
    const list = this.grid.get(Math.floor(x / this.cell) * 4096 + Math.floor(z / this.cell));
    if (list) {
      for (const c of list) {
        const q = Math.hypot(x - c.x, z - c.z) / c.R;
        if (q > 2.6) continue;
        if (c.fresh > 0.6) k += (c.fresh - 0.6) * 0.9 * smoothstep(2.6, 1.0, q);
        if (q < 0.8) k -= 0.05;
      }
    }
    return k * (1 - 0.1 * this.padWeight(x, z));
  }
}

// ------------------------------------------------------------------------------------------- sunlight
/**
 * How much of the Sun a point sees (0..1): a ray toward the Sun over the real heights, with the soft edge
 * of a 0.53° wide Sun. Mountains kilometres away shade the ground, as at the real south pole.
 */
export function sunVisibility(H, x, z, y, sun, maxDist, useDetail) {
  const hl = Math.hypot(sun.x, sun.z);
  if (hl < 1e-6) return 1;
  const dx = sun.x / hl, dz = sun.z / hl, rise = sun.y / hl;
  let d = 1.5, vis = 1;
  while (d < maxDist) {
    const px = x + dx * d, pz = z + dz * d;
    const g = useDetail && d < NEAR_R ? H.height(px, pz) : H.dem(px, pz);
    const clear = y + 0.05 + rise * d - g;
    const pen = d * 0.0093 + 0.04;
    if (clear < -pen) return 0;
    vis = Math.min(vis, (clear + pen) / (2 * pen));
    d += Math.max(1.5, d * 0.07);
  }
  return Math.max(0, Math.min(1, vis));
}

// ------------------------------------------------------------------------------------------- geometry
/** The near disc's lattice as drawn (set by buildNear): marks on the ground sit on these flat triangles. */
let lattice = null;

/**
 * The height of the ground as it is drawn: the near disc is flat triangles between lattice points metres apart,
 * so on a bump the smooth H.height can be centimetres above or below the drawn surface. A print or a track laid on
 * H.height then sinks into the triangles and breaks up (uphill most). Same split as buildNear: (a, d, b), (b, d, f).
 */
export function surfaceHeight(H, x, z) {
  const L = lattice;
  if (!L || L.H !== H || Math.hypot(x, z) > L.radius) return H.height(x, z);
  const fx = (x + L.half) / L.step, fz = (z + L.half) / L.step;
  const j = Math.floor(fx), i = Math.floor(fz);
  const u = fx - j, v = fz - i;
  const p = (ii, jj) => H.height(-L.half + jj * L.step, -L.half + ii * L.step);
  const a = p(i, j), b = p(i, j + 1), d = p(i + 1, j), f = p(i + 1, j + 1);
  return u + v <= 1 ? a + (b - a) * u + (d - a) * v : f + (d - f) * (1 - u) + (b - f) * (1 - v);
}

/** Ground disc around the base: a square lattice (same as the collider's) cut to a circle. */
export function buildNear(H, { step, radius, sun }) {
  const n = Math.round((2 * radius) / step);
  const half = (n * step) / 2;
  lattice = { H, step, half, radius };
  const verts = (n + 1) * (n + 1);
  const pos = new Float32Array(verts * 3), nor = new Float32Array(verts * 3), col = new Float32Array(verts * 3);
  const vis = new Float32Array(verts), pad = new Float32Array(verts);
  const c = new THREE.Color();
  const e = step * 0.5;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const k = i * (n + 1) + j;
      const x = -half + j * step, z = -half + i * step;
      const inside = Math.hypot(x, z) <= radius + step * 1.5;
      const y = inside ? H.height(x, z) : 0;
      pos.set([x, y, z], k * 3);
      if (!inside) continue;
      const nx = H.height(x - e, z) - H.height(x + e, z), nz = H.height(x, z - e) - H.height(x, z + e);
      const l = Math.hypot(nx, 2 * e, nz);
      nor.set([nx / l, (2 * e) / l, nz / l], k * 3);
      c.copy(H.color).multiplyScalar(H.tint(x, z));
      col.set([c.r, c.g, c.b], k * 3);
      vis[k] = sunVisibility(H, x, z, y, sun, 3000, true);
      pad[k] = H.padWeight(x, z);
    }
  }
  const idx = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = -half + (j + 0.5) * step, z = -half + (i + 0.5) * step;
      if (Math.hypot(x, z) > radius) continue;
      const a = i * (n + 1) + j, b = a + 1, d = a + n + 1, f = d + 1;
      idx.push(a, d, b, b, d, f);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('sunVis', new THREE.BufferAttribute(vis, 1));
  g.setAttribute('padW', new THREE.BufferAttribute(pad, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/**
 * Rings from the edge of the near disc to the real skyline (60 km), heights from LOLA.
 * compress { from, to }: for a scene with one camera and a near far-plane (the R3F game), everything beyond `from`
 * metres is pulled toward the origin into from…to, along the line of sight from the base: seen from the base the
 * skyline keeps its exact angles. Normals and Sun visibility use the real positions (kept in userData.real).
 */
/**
 * @param {Heights} H
 * @param {{ azStep?: number, sun: THREE.Vector3, compress?: { from: number, to: number } | null }} opts
 */
export function buildFar(H, { azStep = 1, sun, compress = null }) {
  const radii = H.site ? H.radii : [NEAR_R, 300, 600, 1200, 2500, 5000];
  const azn = H.site ? H.azn : 128;
  const useAz = [];
  for (let a = 0; a < azn; a += azStep) useAz.push(a);
  const rings = [NEAR_R - 3];
  for (const r of radii) if (r > NEAR_R + 8) rings.push(r);
  const A = useAz.length, Rn = rings.length;
  const pos = new Float32Array(Rn * A * 3), col = new Float32Array(Rn * A * 3), vis = new Float32Array(Rn * A);
  const c = new THREE.Color();
  for (let ri = 0; ri < Rn; ri++) {
    const r = rings[ri];
    for (let ai = 0; ai < A; ai++) {
      const th = (useAz[ai] / azn) * Math.PI * 2;
      const x = r * Math.cos(th), z = r * Math.sin(th);
      // inner ring: the near ground's own height, a hand below it, so the seam is hidden under the disc
      const y = ri === 0 ? H.height(x, z) - 0.25 : H.dem(x, z);
      const k = ri * A + ai;
      pos.set([x, y, z], k * 3);
      c.copy(H.color).multiplyScalar(1 + 0.08 * fbm(x / 900, z / 900, 31, 3));
      col.set([c.r, c.g, c.b], k * 3);
      vis[k] = sunVisibility(H, x, z, y, sun, 25000, false);
    }
  }
  const idx = [];
  for (let ri = 0; ri < Rn - 1; ri++)
    for (let ai = 0; ai < A; ai++) {
      const a = ri * A + ai, b = ri * A + ((ai + 1) % A), d = a + A, f = b + A;
      idx.push(a, b, d, b, f, d);          // counter-clockwise seen from above: faces up
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('sunVis', new THREE.BufferAttribute(vis, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (compress) {
    g.userData.real = pos.slice();
    const { from, to } = compress, k = 15000;
    for (let i = 0; i < pos.length; i += 3) {
      const r = Math.hypot(pos[i], pos[i + 2]);
      if (r <= from) continue;
      const s = (from + (to - from) * (1 - Math.exp(-(r - from) / k))) / r;
      pos[i] *= s;
      pos[i + 1] *= s;
      pos[i + 2] *= s;
    }
  }
  g.computeBoundingSphere();
  return g;
}

/**
 * Bake the Sun visibility again for a new Sun direction (the game's Sun moves 12° a day), a slice at a time so a
 * phone does not freeze. Returns false when cancelled (cancelled() true) before the end.
 */
export async function bakeSunVis(geo, H, sun, { maxDist, useDetail, slice = 1500, cancelled = () => false }) {
  const p = geo.userData.real || geo.attributes.position.array;
  const vis = geo.attributes.sunVis;
  const out = new Float32Array(vis.count);
  for (let i = 0; i < vis.count; i++) {
    out[i] = sunVisibility(H, p[i * 3], p[i * 3 + 2], p[i * 3 + 1], sun, maxDist, useDetail);
    if (i % slice === slice - 1) {
      await new Promise((r) => setTimeout(r, 0));
      if (cancelled()) return false;
    }
  }
  vis.array.set(out);
  vis.needsUpdate = true;
  return true;
}

// ------------------------------------------------------------------------------------------- material
/**
 * Regolith: the vertex colour, a fine detail texture at two scales (no visible tiling), baked Sun visibility
 * (mountain shadows) on the sunlight only, and the opposition surge — the bright glow around your own
 * shadow that every Apollo photo shows.
 */
/**
 * Albedo gain on top of the vertex colour (sRGB, multiplies it): real regolith reflects only ~12 % of sunlight, a
 * dark, slightly warm grey; the soil colours passed in are lighter and cooler, so on their own the ground read as
 * snow or concrete. This darkens and warms them, so the white base and the astronaut stand out.
 */
const ALBEDO_GAIN = '#b3ada5';

/** @param {{ detail?: THREE.Texture | null, detailNormal?: THREE.Texture | null, surge?: number }} [opts] */
export function regolithMaterial({ detail = null, detailNormal = null, surge = 0.5 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: ALBEDO_GAIN, vertexColors: true, roughness: 1, metalness: 0 });
  const uniforms = {
    uDetail: { value: detail },
    uDetailN: { value: detailNormal },
    // the second, coarser layer (one tile ≈ 14 m); the same texture unless a macro texture is swapped in
    // (features.hfGround: craterlets, ejecta and stones, src/scene/hfAssets.ts)
    uMacro: { value: detail },
    uMacroN: { value: detailNormal },
    uSunView: { value: new THREE.Vector3(0, 1, 0) },
    uSurge: { value: surge },
  };
  mat.userData.uniforms = uniforms;
  const useDetail = !!detail;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float sunVis;
attribute float padW;
varying float vSunVis;
varying float vPad;
varying vec2 vWXZ;
varying vec3 vNW;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vSunVis = sunVis;
vPad = padW;
vWXZ = (modelMatrix * vec4(position, 1.0)).xz;
vNW = normalize(mat3(modelMatrix) * normal);`);
    const lights = THREE.ShaderChunk.lights_fragment_begin.replace(
      'getDirectionalLightInfo( directionalLight, directLight );',
      'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= vSunVis;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uDetail;
uniform sampler2D uDetailN;
uniform sampler2D uMacro;
uniform sampler2D uMacroN;
uniform vec3 uSunView;
uniform float uSurge;
varying float vSunVis;
varying float vPad;
varying vec2 vWXZ;
varying vec3 vNW;`)
      .replace('#include <map_fragment>', useDetail ? `
vec3 dA = texture2D(uDetail, vWXZ * 0.37).rgb;
vec3 dB = texture2D(uMacro, vWXZ * 0.071 + 0.31).rgb;
diffuseColor.rgb *= mix((dA * 0.62 + dB * 0.38) * 2.0, vec3(1.0), 0.45 * vPad);   // the graded pad is smoother` : '')
      .replace('#include <normal_fragment_maps>', useDetail ? `
vec2 sA = texture2D(uDetailN, vWXZ * 0.37).rg * 2.0 - 1.0;
vec2 sB = texture2D(uMacroN, vWXZ * 0.071 + 0.31).rg * 2.0 - 1.0;
vec2 sl = (sA * 0.5 + sB * 0.18) * (1.0 - 0.6 * vPad);
vec3 nW = normalize(vNW + vec3(sl.x, 0.0, sl.y));
normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);` : '')
      .replace('#include <lights_fragment_begin>', lights)
      .replace('#include <opaque_fragment>', `
float phase = max(dot(normalize(vViewPosition), uSunView), 0.0);
outgoingLight *= 1.0 + uSurge * (0.25 * pow(phase, 6.0) + 0.75 * pow(phase, 90.0));
#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'regolith' + (useDetail ? 'D' : '');
  return mat;
}

/** Keep the surge pointed at the Sun as the camera turns. */
export function updateRegolith(mat, sunDirWorld, camera) {
  const u = mat.userData.uniforms;
  if (u) u.uSunView.value.copy(sunDirWorld).transformDirection(camera.matrixWorldInverse);
}

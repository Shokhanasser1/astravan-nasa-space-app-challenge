// Textures made in code at load time (no files to download): regolith detail, a boot print, the Sun's glare.
import * as THREE from 'three';
import { rng } from './noise.js';

/** Periodic value noise on an N-pixel tile (wraps, so the texture repeats without seams). */
function tileNoise(N, cells, seed) {
  const r = rng(seed);
  const g = new Float32Array(cells * cells).map(() => r() * 2 - 1);
  const out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    const fy = (y / N) * cells, iy = Math.floor(fy), ty = fy - iy, v = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < N; x++) {
      const fx = (x / N) * cells, ix = Math.floor(fx), tx = fx - ix, u = tx * tx * (3 - 2 * tx);
      const x0 = ix % cells, x1 = (ix + 1) % cells, y0 = iy % cells, y1 = (iy + 1) % cells;
      const a = g[y0 * cells + x0], b = g[y0 * cells + x1], c = g[y1 * cells + x0], d = g[y1 * cells + x1];
      out[y * N + x] = (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
    }
  }
  return out;
}

function dataTexture(rgba, N, renderer) {
  const t = new THREE.DataTexture(rgba, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * Regolith close up (one tile ≈ 2.7 m): fine grains, craterlets a hand wide, pebbles.
 * Returns { albedo (mean 0.5, the shader doubles it), slope (RG = surface tilt) }.
 */
export function regolithTextures(renderer, N = 512) {
  const h = new Float32Array(N * N);
  const alb = new Float32Array(N * N).fill(0.5);
  const octs = [[4, 0.5], [8, 0.3], [16, 0.18], [32, 0.1], [64, 0.06]];
  for (const [cells, amp] of octs) {
    const n = tileNoise(N, cells, cells * 7 + 1);
    for (let i = 0; i < h.length; i++) h[i] += n[i] * amp;
  }
  const r = rng(77);
  for (let i = 0; i < h.length; i++) {
    const grain = r() - 0.5;
    h[i] += grain * 0.05;
    alb[i] += grain * 0.06;
  }
  const wrap = (v) => ((v % N) + N) % N;
  // craterlets: bowl + rim, a little darker inside
  for (let k = 0; k < 22; k++) {
    const cx = r() * N, cy = r() * N, R = 3 + 18 * Math.pow(r(), 2.6), dep = R * (0.02 + 0.03 * r());
    for (let y = Math.floor(cy - R * 1.6); y <= cy + R * 1.6; y++)
      for (let x = Math.floor(cx - R * 1.6); x <= cx + R * 1.6; x++) {
        const q = Math.hypot(x - cx, y - cy) / R;
        if (q > 1.6) continue;
        const i = wrap(y) * N + wrap(x);
        if (q < 1) {
          h[i] += dep * (q * q - 1);
          alb[i] -= 0.03 * (1 - q);
        }
        const t = (q - 1) / 0.25;
        h[i] += dep * 0.3 * Math.exp(-t * t);
      }
  }
  // pebbles: small sharp bumps, slightly brighter
  for (let k = 0; k < 260; k++) {
    const cx = r() * N, cy = r() * N, R = 1.2 + 5 * Math.pow(r(), 3), top = R * (0.4 + 0.4 * r());
    const b = 0.04 + 0.08 * r();
    for (let y = Math.floor(cy - R - 1); y <= cy + R + 1; y++)
      for (let x = Math.floor(cx - R - 1); x <= cx + R + 1; x++) {
        const q = Math.hypot(x - cx, y - cy) / R;
        if (q > 1) continue;
        const i = wrap(y) * N + wrap(x);
        h[i] += top * Math.sqrt(1 - q * q) * 0.06;
        alb[i] += b * (1 - q * 0.5);
      }
  }
  const albedo = new Uint8Array(N * N * 4), slope = new Uint8Array(N * N * 4);
  const k = 1.5;   // tilt strength
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const dx = h[y * N + wrap(x + 1)] - h[y * N + wrap(x - 1)];
      const dy = h[wrap(y + 1) * N + x] - h[wrap(y - 1) * N + x];
      const a = Math.max(0, Math.min(1, alb[i] + h[i] * 0.04)) * 255;
      albedo.set([a, a, a, 255], i * 4);
      slope.set([Math.max(0, Math.min(255, 128 - dx * k * 128)), Math.max(0, Math.min(255, 128 - dy * k * 128)), 128, 255], i * 4);
    }
  return { albedo: dataTexture(albedo, N, renderer), slope: dataTexture(slope, N, renderer) };
}

/** A boot print (Apollo-style ribbed sole), 64×128: colour+alpha map and a normal map. */
export function bootPrint(renderer) {
  const W = 64, H = 128;
  const depth = new Float32Array(W * H);
  const mask = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W - 0.5, v = (y + 0.5) / H - 0.5;
      // sole outline: wider toe, narrower heel
      const halfW = 0.36 - 0.07 * (v + 0.5) + 0.05 * Math.cos(v * 6.0);
      const edge = Math.min(halfW - Math.abs(u), 0.47 - Math.abs(v));
      const m = Math.max(0, Math.min(1, edge * 18));
      mask[y * W + x] = m;
      const ribs = Math.sin((v + 0.5) * Math.PI * 20) > 0.15 ? 1 : 0;   // the ribs across the sole
      depth[y * W + x] = m * (0.7 + 0.3 * ribs);
    }
  const col = new Uint8Array(W * H * 4), nor = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const dx = depth[y * W + Math.min(W - 1, x + 1)] - depth[y * W + Math.max(0, x - 1)];
      const dy = depth[Math.min(H - 1, y + 1) * W + x] - depth[Math.max(0, y - 1) * W + x];
      const tone = 168 - depth[i] * 34;   // trodden soil is a little darker; the ribs show by their shading
      col.set([tone, tone * 0.98, tone * 0.95, Math.min(255, mask[i] * 175)], i * 4);
      // a pressed-in print: the walls face inward
      const nx = dx * 2.2, ny = -dy * 2.2, l = Math.hypot(nx, ny, 1);
      nor.set([(nx / l * 0.5 + 0.5) * 255, (ny / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255, 255], i * 4);
    }
  const make = (data, srgb) => {
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    t.needsUpdate = true;
    return t;
  };
  return { map: make(col, true), normal: make(nor, false) };
}

/** Soft white glare for the Sun (no air on the Moon: a hard white disc, the glow is the eye's / lens's). */
export function glareTexture(N = 128) {
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / (N / 2);
      const core = d < 0.09 ? 1 : 0;
      const halo = Math.exp(-d * 7) * 0.55 + Math.exp(-d * 2.5) * 0.12;
      const v = Math.min(1, core + halo) * (d < 1 ? 1 : 0);
      data.set([255, 250, 240, v * 255], (y * N + x) * 4);
    }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

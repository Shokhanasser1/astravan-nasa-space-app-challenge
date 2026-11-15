// Boot prints and kicked-up dust. On the Moon a print stays (no wind) and dust flies in clean arcs and drops
// straight back (no air to hold it up): g = 1.62 m/s², no drag (concept dust arcs). Other gravities get air drag.
// update(dt, game): game = { body: { pos: [x, y, z], onGround }, facing, g, gravityKey, groundHeight(x, z) }.
import * as THREE from 'three';
import { bootPrint, wheelTrack } from './textures.js';
import { rng } from './noise.js';

// Marks on the ground (boot prints, wheel tracks) are capped so a plain laptop carries them: each kind is one draw
// call of at most CAP quads. Near the cap the oldest marks fade out, a few at a time, from the start of the trail;
// when it is full the faded oldest one is reused for the next. Kept at module level, so marks outlive a component (a
// phase, a room, a remount), and stored compactly (x, z, heading: 6 bytes a mark) so they come back after a reload.
const PRINTS = 1000, DUST = 360;   // 1 000 prints ≈ 700 m of walking, 64 KB of matrices
const FOOT_GAP = 0.14;           // m between the left and the right foot

/** A ring of marks: matrices for the GPU, a fade per mark, and (x, z, heading) to store. */
export class MarkRing {
  constructor(n) {
    this.n = n;
    this.fadeN = Math.round(n * 0.15);   // the oldest 15 % fade out as the ring fills
    this.m = new Float32Array(n * 16);
    this.fade = new Float32Array(n).fill(1);
    this.rec = new Float32Array(n * 3);
    this.next = 0;
    this.count = 0;
    this.dirty = false;
    this.restored = false;
  }

  push(matrix, x, z, yaw) {
    matrix.toArray(this.m, this.next * 16);
    this.rec.set([x, z, yaw], this.next * 3);
    this.fade[this.next] = 1;
    this.next = (this.next + 1) % this.n;
    this.count = Math.min(this.n, this.count + 1);
    this.dirty = true;
  }

  /** Ages the oldest marks: none fade until the ring is 85 % full; full, they ramp from 0 (oldest) to 1. */
  applyFade() {
    const F = this.fadeN, n = this.n;
    if (this.count <= n - F) return false;
    const p = (this.count - (n - F)) / F;
    const oldest = this.count < n ? 0 : this.next;
    for (let k = 0; k < F; k++) this.fade[(oldest + k) % n] = Math.max(0, Math.min(1, k / F + 1 - p));
    return true;
  }

  /** Oldest first, quantised: x and z in 2 cm (±655 m), the heading in 1/10 000 of π. Base64 for storage. */
  serialize() {
    const a = new Int16Array(this.count * 3);
    const oldest = this.count < this.n ? 0 : this.next;
    for (let k = 0; k < this.count; k++) {
      const i = ((oldest + k) % this.n) * 3;
      a[k * 3] = Math.round(this.rec[i] * 50);
      a[k * 3 + 1] = Math.round(this.rec[i + 1] * 50);
      a[k * 3 + 2] = Math.round((this.rec[i + 2] / Math.PI) * 10000);
    }
    let s = '';
    const b = new Uint8Array(a.buffer);
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    this.dirty = false;
    return btoa(s);
  }

  /** The stored marks as [x, z, yaw] triples, oldest first (empty if the text is missing or broken). */
  static parse(text) {
    try {
      if (!text) return [];
      const s = atob(text);
      const b = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
      const a = new Int16Array(b.buffer, 0, Math.floor(b.length / 6) * 3);
      const out = [];
      for (let k = 0; k + 2 < a.length; k += 3) out.push([a[k] / 50, a[k + 1] / 50, (a[k + 2] / 10000) * Math.PI]);
      return out;
    } catch {
      return [];
    }
  }
}

/** Each mark's own fade (an instanced attribute) multiplies the material's alpha. */
function fadeMaterial(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float fade;\nvarying float vFade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = fade;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFade;')
      .replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vFade;');
  };
  return mat;
}

/** An instanced mesh drawing a ring: its matrices and fades are the ring's own arrays (shared by every copy). */
function ringMesh(geo, mat, ring, name) {
  geo.setAttribute('fade', new THREE.InstancedBufferAttribute(ring.fade, 1));
  const mesh = new THREE.InstancedMesh(geo, fadeMaterial(mat), ring.n);
  mesh.instanceMatrix = new THREE.InstancedBufferAttribute(ring.m, 16);
  mesh.count = ring.count;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = name;
  return mesh;
}

/** After marks were laid: upload the matrices (and the fades when they changed). */
function refresh(mesh, ring) {
  mesh.count = ring.count;
  mesh.instanceMatrix.needsUpdate = true;
  ring.applyFade();
  mesh.geometry.attributes.fade.needsUpdate = true;
}

export const marks = { prints: new MarkRing(PRINTS), tracks: null };
export const parseMarks = (text) => MarkRing.parse(text);

export class GroundFx {
  constructor(renderer) {
    const tex = bootPrint(renderer);
    const mat = new THREE.MeshStandardMaterial({
      map: tex.map, normalMap: tex.normal, normalScale: new THREE.Vector2(2, 2), roughness: 1,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    // the size of the EVA boot's sole as it touches the ground: ~0.35 m by ~0.14 m (the astronaut's ankle to toe joint is
    // 0.19 m, heel and toe cap beyond); the sole shape fills ~75 % of the width and 94 % of the length of this quad
    const geo = new THREE.PlaneGeometry(0.19, 0.37).rotateX(-Math.PI / 2);
    this.prints = ringMesh(geo, mat, marks.prints, 'look_prints');

    this.pos = new Float32Array(DUST * 3).fill(-1e4);
    this.vel = new Float32Array(DUST * 3);
    this.life = new Float32Array(DUST);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0x9a968f, size: 0.035, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false,
    }));
    this.dust.frustumCulled = false;
    this.dust.name = 'look_dust';
    this.dustNext = 0;
    // (added to the scene by attach(): from an effect, so React StrictMode's extra mount cannot leave a dead copy)

    this.r = rng(99);
    this.dist = 0;
    this.side = 1;
    this.last = null;
    this.wasGround = true;
    this.air = 0;              // seconds off the ground: only a real jump leaves a landing mark
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.up = new THREE.Vector3();
    this.v = new THREE.Vector3();
    this.one = new THREE.Vector3(1, 1, 1);
    this.Y = new THREE.Vector3(0, 1, 0);
    this.qy = new THREE.Quaternion();
  }

  /** Put the prints and the dust into the scene (call from an effect; dispose() takes them out again). */
  attach(scene) {
    refresh(this.prints, marks.prints);
    scene.add(this.prints, this.dust);
  }

  /** Lay the stored prints again (once per page; [x, z, yaw] oldest first) on the ground h(x, z). */
  restore(list, h) {
    const ring = marks.prints;
    if (ring.restored) return;
    ring.restored = true;
    const game = { surfaceHeight: h, groundHeight: h };
    for (const [x, z, yaw] of list) this.place(game, x, z, yaw);
    ring.dirty = false;
    refresh(this.prints, ring);
  }

  /**
   * Take the prints and the dust out of the scene and free their GPU memory (the prints' places stay stored; after
   * attach() again three uploads them anew).
   */
  dispose() {
    for (const o of [this.prints, this.dust]) {
      o.removeFromParent();
      o.geometry.dispose();
      const m = o.material;
      m.map?.dispose();
      m.normalMap?.dispose();
      m.dispose();
    }
  }

  /** Ground normal from three height samples. */
  normalAt(game, x, z) {
    const e = 0.2;
    const h = game.surfaceHeight ?? game.groundHeight;
    const h0 = h(x, z), hx = h(x + e, z), hz = h(x, z + e);
    if (h0 === null || hx === null || hz === null) return this.up.set(0, 1, 0);
    return this.up.set(h0 - hx, e, h0 - hz).normalize();
  }

  stamp(game, x, z, yaw, side) {
    const fx = x + Math.cos(yaw) * FOOT_GAP * 0.5 * side, fz = z - Math.sin(yaw) * FOOT_GAP * 0.5 * side;
    if (this.place(game, fx, fz, yaw)) refresh(this.prints, marks.prints);
  }

  /** One print centred at (x, z), heading yaw, lying on the ground; into the ring. */
  place(game, x, z, yaw) {
    const y = (game.surfaceHeight ?? game.groundHeight)(x, z);
    if (y === null) return false;
    this.q.setFromUnitVectors(this.Y, this.normalAt(game, x, z));
    this.qy.setFromAxisAngle(this.Y, yaw);
    this.q.multiply(this.qy);
    this.v.set(x, y + 0.004, z);
    this.m.compose(this.v, this.q, this.one);
    marks.prints.push(this.m, x, z, yaw);
    return true;
  }

  kick(x, y, z, dirX, dirZ, n, speed) {
    const r = this.r;
    for (let i = 0; i < n; i++) {
      const k = this.dustNext;
      this.dustNext = (this.dustNext + 1) % DUST;
      const a = Math.atan2(dirZ, dirX) + (r() - 0.5) * (dirX || dirZ ? 1.4 : Math.PI * 2);
      const s = speed * (0.4 + 0.8 * r());
      this.pos.set([x + (r() - 0.5) * 0.12, y + 0.03, z + (r() - 0.5) * 0.12], k * 3);
      this.vel.set([Math.cos(a) * s, s * (0.5 + 0.9 * r()), Math.sin(a) * s], k * 3);
      this.life[k] = 4;
    }
  }

  /**
   * game: { body: { pos, onGround }, facing, g, gravityKey, groundHeight, footfalls? }.
   * footfalls (from the astronaut's AnimController): [{ x, z, yaw, side, run, landing }] where a boot is flat on the
   * ground — the print goes exactly under the boot. Without it, prints are spaced by distance walked (fallback).
   */
  update(dt, game) {
    const b = game.body;
    const p = b.pos;
    const ground = b.onGround;
    const events = game.footfalls;
    const d = this.last ? Math.hypot(p[0] - this.last[0], p[2] - this.last[2]) : 0;
    const speed = d / Math.max(dt, 1e-3);
    if (events) {
      for (const e of events) {
        this.stamp(game, e.x, e.z, e.yaw, 0);
        const y = game.groundHeight(e.x, e.z) ?? p[1];
        if (!e.landing) {
          this.kick(e.x, y, e.z, Math.sin(e.yaw), Math.cos(e.yaw), e.run ? 7 : 3, 0.35 + speed * 0.25);
        }
      }
      events.length = 0;
    } else if (this.last && ground) {
      const dx = p[0] - this.last[0], dz = p[2] - this.last[2];
      this.dist += d;
      const stride = speed > 2.2 ? 1.25 : 0.72;
      if (this.dist > stride && d > 0) {
        this.dist = 0;
        this.side = -this.side;
        this.stamp(game, p[0], p[2], game.facing, this.side);
        this.kick(p[0], p[1], p[2], dx / d, dz / d, speed > 2.2 ? 7 : 3, 0.35 + speed * 0.25);
      }
    }
    this.air = ground ? this.air : this.air + dt;
    if (ground && !this.wasGround && this.air > 0.3) {   // landing from a jump: both feet and a ring of dust
      if (!events) {
        this.stamp(game, p[0], p[2], game.facing, 1);
        this.stamp(game, p[0], p[2], game.facing, -1);
      }
      this.kick(p[0], p[1], p[2], 0, 0, 22, 0.9);
      this.dist = 0;
    }
    if (ground) this.air = 0;
    this.wasGround = ground;
    this.last = this.last || [0, 0, 0];
    this.last[0] = p[0];
    this.last[1] = p[1];
    this.last[2] = p[2];

    const g = game.g || 1.62;
    const drag = game.gravityKey === 'moon' ? 0 : game.gravityKey === 'mars' ? 1.5 : 4;
    const keep = Math.exp(-drag * dt);
    const P = this.pos, V = this.vel;
    let moving = false;
    for (let k = 0; k < DUST; k++) {
      if (this.life[k] <= 0) continue;
      moving = true;
      const i = k * 3;
      V[i + 1] -= g * dt;
      V[i] *= keep;
      V[i + 1] *= keep;
      V[i + 2] *= keep;
      P[i] += V[i] * dt;
      P[i + 1] += V[i + 1] * dt;
      P[i + 2] += V[i + 2] * dt;
      this.life[k] -= dt;
      const gy = game.groundHeight(P[i], P[i + 2]);
      if ((gy !== null && P[i + 1] < gy && V[i + 1] < 0) || this.life[k] <= 0) {
        this.life[k] = 0;
        P[i + 1] = -1e4;            // landed: lunar dust does not hang in the air
      }
    }
    if (moving) this.dust.geometry.attributes.position.needsUpdate = true;
  }
}

// Rover wheel tracks: every tyre leaves its own track. The crew rover has six wheels, each a pair of tyres, so
// twelve tracks: on a straight line the front, middle and rear pairs run in the same ruts, in a turn (the rear wheels
// steer the other way) they spread apart. Each tyre lays tiles end to end along its own path, one tile per TRACK_TILE
// metres measured along the ground (uphill too, so no gaps), on the ground as drawn (surfaceHeight: the tile never
// sinks into the terrain triangles). Like the prints they stay (no wind), capped and fading like them: 8 000 tiles,
// about 200 m of driving (12 tyres × a tile per 0.3 m), 16 000 triangles and 512 KB of matrices, one draw call.
const TRACKS = 8000;
export const TRACK_TILE = 0.3;   // m along the path per tile (four chevrons)
marks.tracks = new MarkRing(TRACKS);
/** Each tyre's last place and how far it has rolled since its last tile (by tyre name). */
const tyreState = new Map();

export class WheelTracks {
  /** tyreWidth: m, one tyre's tread width. */
  constructor(renderer, tyreWidth) {
    const tex = wheelTrack(renderer);
    const mat = new THREE.MeshStandardMaterial({
      map: tex.map, normalMap: tex.normal, normalScale: new THREE.Vector2(2, 2), roughness: 1,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    const geo = new THREE.PlaneGeometry(tyreWidth, TRACK_TILE).rotateX(-Math.PI / 2);
    this.mesh = ringMesh(geo, mat, marks.tracks, 'look_tracks');
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.qy = new THREE.Quaternion();
    this.up = new THREE.Vector3();
    this.v = new THREE.Vector3();
    this.one = new THREE.Vector3(1, 1, 1);
    this.Y = new THREE.Vector3(0, 1, 0);
  }

  /** Into the scene with every tile laid so far (call from an effect; dispose() takes it out again). */
  attach(scene) {
    refresh(this.mesh, marks.tracks);
    scene.add(this.mesh);
  }

  /** Lay the stored tiles again (once per page; [x, z, yaw] oldest first) on the ground h(x, z). */
  restore(list, h) {
    const ring = marks.tracks;
    if (ring.restored) return;
    ring.restored = true;
    for (const [x, z, yaw] of list) this.tile(x, z, yaw, h);
    ring.dirty = false;
    refresh(this.mesh, ring);
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.map?.dispose();
    this.mesh.material.normalMap?.dispose();
    this.mesh.material.dispose();
  }

  /** One tile centred at (x, z), its length along yaw, lying on the drawn ground (height h(x, z)). */
  tile(x, z, yaw, h) {
    const y = h(x, z);
    const sx = Math.sin(yaw) * 0.15, sz = Math.cos(yaw) * 0.15;   // along the track
    const lx = sz, lz = -sx;                                         // across it
    // the tile's slope from its own ends and sides, so it lies along the ground it covers
    const ahead = h(x + sx, z + sz) - h(x - sx, z - sz);
    const side = h(x + lx, z + lz) - h(x - lx, z - lz);
    const t = this.v.set(sx * 2, ahead, sz * 2);
    const s = this.up.set(lx * 2, side, lz * 2);
    const n = s.cross(t).normalize();
    if (n.y < 0) n.negate();
    this.q.setFromUnitVectors(this.Y, n);
    this.qy.setFromAxisAngle(this.Y, yaw);
    this.q.multiply(this.qy);
    this.m.compose(this.v.set(x, y + 0.006, z), this.q, this.one);
    marks.tracks.push(this.m, x, z, yaw);
  }

  /**
   * tyres: [{ id, x, z }], where each tyre touches the ground this frame (world). h(x, z): the drawn ground height.
   * Each tyre lays a tile at every TRACK_TILE metres it has rolled, on the path between the frames, turned along its
   * own direction of travel. True when tiles were laid (draw a frame).
   */
  update(tyres, h) {
    let laid = false;
    for (const w of tyres) {
      const s = tyreState.get(w.id);
      const y = h(w.x, w.z);
      if (!s) {
        tyreState.set(w.id, { x: w.x, y, z: w.z, dist: 0 });
        continue;
      }
      const dx = w.x - s.x, dz = w.z - s.z, dy = y - s.y;
      const flat = Math.hypot(dx, dz);
      if (flat > 8) {                 // the rover was placed, not driven: a new track starts here
        Object.assign(s, { x: w.x, y, z: w.z, dist: 0 });
        continue;
      }
      if (flat < 1e-5) continue;
      const d = Math.hypot(flat, dy);  // along the ground, so uphill gets as many tiles as it is long
      const yaw = Math.atan2(dx, dz);
      let done = 0;
      while (s.dist + (d - done) >= TRACK_TILE) {
        done += TRACK_TILE - s.dist;
        s.dist = 0;
        const k = (done - TRACK_TILE / 2) / d;   // the tile's centre, half a tile back from where it ends
        this.tile(s.x + dx * k, s.z + dz * k, yaw, h);
        laid = true;
      }
      s.dist += d - done;
      s.x = w.x;
      s.y = y;
      s.z = w.z;
    }
    if (laid) refresh(this.mesh, marks.tracks);
    return laid;
  }
}

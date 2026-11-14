// Boot prints and kicked-up dust. On the Moon a print stays (no wind) and dust flies in clean arcs and drops
// straight back (no air to hold it up): g = 1.62 m/s², no drag (concept dust arcs). Other gravities get air drag.
// update(dt, game): game = { body: { pos: [x, y, z], onGround }, facing, g, gravityKey, groundHeight(x, z) }.
import * as THREE from 'three';
import { bootPrint } from './textures.js';
import { rng } from './noise.js';

const PRINTS = 320, DUST = 360;
const FOOT_GAP = 0.14;           // m between the left and the right foot

export class GroundFx {
  constructor(scene, renderer) {
    const tex = bootPrint(renderer);
    const mat = new THREE.MeshStandardMaterial({
      map: tex.map, normalMap: tex.normal, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 1,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    const geo = new THREE.PlaneGeometry(0.15, 0.32).rotateX(-Math.PI / 2);
    this.prints = new THREE.InstancedMesh(geo, mat, PRINTS);
    this.prints.count = 0;
    this.prints.receiveShadow = true;
    this.prints.frustumCulled = false;
    this.prints.name = 'look_prints';
    this.next = 0;
    scene.add(this.prints);

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
    scene.add(this.dust);

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

  /** Take the prints and the dust out of the scene and free their GPU memory. */
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
    const h0 = game.groundHeight(x, z), hx = game.groundHeight(x + e, z), hz = game.groundHeight(x, z + e);
    if (h0 === null || hx === null || hz === null) return this.up.set(0, 1, 0);
    return this.up.set(h0 - hx, e, h0 - hz).normalize();
  }

  stamp(game, x, z, yaw, side) {
    const fx = x + Math.cos(yaw) * FOOT_GAP * 0.5 * side, fz = z - Math.sin(yaw) * FOOT_GAP * 0.5 * side;
    const y = game.groundHeight(fx, fz);
    if (y === null) return;
    this.q.setFromUnitVectors(this.Y, this.normalAt(game, fx, fz));
    this.qy.setFromAxisAngle(this.Y, yaw);
    this.q.multiply(this.qy);
    this.v.set(fx, y + 0.004, fz);
    this.m.compose(this.v, this.q, this.one);
    this.prints.setMatrixAt(this.next, this.m);
    this.next = (this.next + 1) % PRINTS;
    this.prints.count = Math.min(PRINTS, this.prints.count + 1);
    this.prints.instanceMatrix.needsUpdate = true;
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

  /** game: the demo's Game (body, facing, g, gravityKey, groundHeight). */
  update(dt, game) {
    const b = game.body;
    const p = b.pos;
    const ground = b.onGround;
    if (this.last && ground) {
      const dx = p[0] - this.last[0], dz = p[2] - this.last[2];
      const d = Math.hypot(dx, dz);
      this.dist += d;
      const speed = d / Math.max(dt, 1e-3);
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
      this.stamp(game, p[0], p[2], game.facing, 1);
      this.stamp(game, p[0], p[2], game.facing, -1);
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

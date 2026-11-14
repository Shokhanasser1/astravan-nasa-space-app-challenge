// Oy karvonsaroyi — o'yin mantig'i (DOM yo'q): o'yinchi, sumkalar, kamera to'qnashuvi, animatsiya.
// demo.js buni brauzerda ishlatadi; smoke_test.mjs esa Node'da xuddi shu kodni sinaydi.
import * as THREE from 'three';
import {
  GRAVITY, GRAVITY_NAMES, BODY, MOVE, PlayerBody, carryFactor, jumpSpeed,
  pointInOBB, rayVsOBB, readout,
} from './physics.js';
import { parseLevel, AnimController, attachBag, dropBag, localBox } from './world.js';

export const GRAVITY_ORDER = ['moon', 'earth', 'mars'];
export const PICK_RANGE = 1.3;       // m, horizontal reach from the capsule edge to a bag
export const CAM = { height: 1.55, minDist: 0.9, pad: 0.25, groundClear: 0.3 };

const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return a + d * t;
};

/** Gravity value for a body from manifest.json ("gravity": {moon: 1.62} or {moon: {value: 1.62}}). */
export function gravityFromManifest(manifest, key) {
  const v = manifest && manifest.gravity ? manifest.gravity[key] : undefined;
  if (typeof v === 'number' && v > 0) return v;
  if (v && typeof v === 'object') {
    for (const k of ['value', 'm_s2', 'ms2', 'g', 'gravity', 'surface_gravity']) {
      if (typeof v[k] === 'number' && v[k] > 0) return v[k];
    }
    const n = Object.values(v).find((x) => typeof x === 'number' && x > 0);
    if (n) return n;
  }
  return GRAVITY[key];
}

/** mass_kg of an asset from manifest.json (array or object of assets, keyed by id). */
export function assetMassFromManifest(manifest, id) {
  if (!manifest) return null;
  const list = Array.isArray(manifest.assets) ? manifest.assets
    : manifest.assets && typeof manifest.assets === 'object' ? Object.entries(manifest.assets).map(([k, v]) => ({ id: k, ...v }))
      : [];
  const a = list.find((x) => x && x.id === id);
  return a && typeof a.mass_kg === 'number' ? a.mass_kg : null;
}

export class Game {
  /**
   * levelRoot: THREE.Object3D with COL_ground, COL_*, BAG_*, ICE_*, SPAWN_player (see world.parseLevel)
   * character: { model, socket, clips } from world.setupCharacter (or a stand-in with a socket)
   */
  constructor({ levelRoot, character, manifest = null, gravityKey = 'moon' }) {
    this.levelRoot = levelRoot;
    this.manifest = manifest;
    this.level = parseLevel(levelRoot);
    this.colliders = this.level.colliders;          // the array the physics reads (mutated in place)
    this.bags = this.level.bags;
    this.bagKgDefault = assetMassFromManifest(manifest, 'crew-lock-bag') || BODY.bagKgDefault;
    const spawn = this.level.spawn || { pos: [0, 0, 0], yaw: 0 };
    const gy = this.groundHeight(spawn.pos[0], spawn.pos[2]);
    this.spawn = { pos: [spawn.pos[0], gy === null ? spawn.pos[1] : Math.max(gy, spawn.pos[1]), spawn.pos[2]], yaw: spawn.yaw };
    this.body = new PlayerBody(this.spawn.pos);
    this.facing = spawn.yaw;
    this.carried = null;
    this.pouring = false;
    this.running = false;
    this.lastJumpPeak = 0;
    this.message = '';
    this.messageT = 0;
    this.setGravity(gravityKey);
    const gb = this.level.ground.bounds;
    this.bounds = gb.isEmpty() ? 100
      : Math.max(5, Math.min(-gb.min.x, gb.max.x, -gb.min.z, gb.max.z) - 1);
    this.world = {
      g: this.g,
      groundHeight: (x, z) => this.groundHeight(x, z),
      colliders: this.colliders,
      bounds: this.bounds,
    };
    this.character = character;
    this.anim = character && character.clips && Object.keys(character.clips).length
      ? new AnimController(character.model, character.clips) : null;
    this.settleBags();                                       // floating bags in a level drop onto their support
    if (character) {
      character.model.position.fromArray(this.body.pos);
      character.model.rotation.y = this.facing;
    }
  }

  // ------------------------------------------------------------ world queries
  groundHeight(x, z) {
    return this.level.ground.heightAt(x, z);
  }

  /**
   * Highest surface under (x, z) that is not above maxY: the ground, the top of a bag (stacking)
   * or the top of an upright box (a shelf / crate). Used to put bags down and to let them settle.
   */
  supportHeight(x, z, exceptBag = null, maxY = Infinity) {
    let y = this.groundHeight(x, z);
    for (const c of this.colliders) {
      if (!c.enabled || (c.bag && c.bag === exceptBag)) continue;
      if (Math.abs(c.u[1][1]) < 0.95) continue;               // only level (upright) tops
      if (!pointInOBB([x, c.c[1], z], c)) continue;
      const top = c.c[1] + c.e[1];
      if (top > maxY) continue;
      if (y === null || top > y) y = top;
    }
    return y;
  }

  setGravity(key) {
    this.gravityKey = GRAVITY[key] ? key : 'moon';
    this.g = gravityFromManifest(this.manifest, this.gravityKey);
    if (this.world) this.world.g = this.g;
    return this.g;
  }

  cycleGravity() {
    const i = GRAVITY_ORDER.indexOf(this.gravityKey);
    this.setGravity(GRAVITY_ORDER[(i + 1) % GRAVITY_ORDER.length]);
    const n = GRAVITY_NAMES[this.gravityKey];
    this.say(`Tortishish: ${n.uz} ${this.g.toFixed(2)} m/s²  ·  Gravity: ${n.en}`);
  }

  say(text, t = 2.5) {
    this.message = text;
    this.messageT = t;
  }

  bagMass(bag) {
    const u = bag.userData || {};
    for (const k of ['mass_kg', 'massKg', 'mass']) if (typeof u[k] === 'number' && u[k] > 0) return u[k];
    return this.bagKgDefault;
  }

  bagCentre(bag) {
    const lb = bag.userData.localBox || (bag.userData.localBox = localBox(bag));
    bag.updateWorldMatrix(true, false);
    return lb.getCenter(new THREE.Vector3()).applyMatrix4(bag.matrixWorld);
  }

  // ------------------------------------------------------------ bags
  nearestBag() {
    const p = this.body.pos;
    const fx = Math.sin(this.facing), fz = Math.cos(this.facing);
    let best = null, bestScore = Infinity;
    for (const bag of this.bags) {
      if (bag === this.carried) continue;
      const c = this.bagCentre(bag);
      const dx = c.x - p[0], dz = c.z - p[2], dy = c.y - p[1];
      const d = Math.hypot(dx, dz);
      const half = 0.5 * Math.max(...bag.userData.localBox.getSize(new THREE.Vector3()).toArray().filter((_, i) => i !== 1));
      if (d > BODY.radius + PICK_RANGE + half || dy < -0.6 || dy > 1.9) continue;
      const front = d > 1e-3 ? (dx * fx + dz * fz) / d : 1;
      const score = d - 0.5 * front - 0.1 * dy;      // closest, in front, top of a stack first
      if (score < bestScore) { bestScore = score; best = bag; }
    }
    return best;
  }

  /** E key: pick up the nearest bag, or put the carried one down in front. */
  useBag() {
    if (this.carried) return this.dropCarried();
    if (!this.body.onGround) return false;
    const bag = this.nearestBag();
    if (!bag) {
      this.say("Yaqinda sumka yo'q  ·  No bag nearby");
      return false;
    }
    const socket = this.character && this.character.socket;
    if (!socket) return false;
    attachBag(bag, socket);
    this.carried = bag;
    this.body.bagKg = this.bagMass(bag);
    this.settleBags();
    const r = readout(this.body.bagKg, this.g);
    this.say(`Sumka olindi: ${this.body.bagKg} kg → tezlik ×${r.factor.toFixed(2)}  ·  Bag picked up`);
    return true;
  }

  dropCarried() {
    const bag = this.carried;
    if (!bag) return false;
    if (!this.body.onGround) return false;
    const before = { parent: bag.parent, pos: bag.position.clone(), quat: bag.quaternion.clone(),
      scale: bag.scale.clone(), cols: bag.userData.colliders };
    const reach = this.body.pos[1] + 1.2;                    // can put it on a low crate, not on a roof
    const box = dropBag(bag, this.levelRoot, this.body.pos, this.facing, (x, z) => this.supportHeight(x, z, bag, reach));
    // refuse to drop into a wall / vehicle
    const blocked = this.colliders.some((c) => c.enabled && !c.bag && obbOverlapApprox(box, c));
    if (blocked) {
      before.parent.add(bag);
      bag.position.copy(before.pos);
      bag.quaternion.copy(before.quat);
      bag.scale.copy(before.scale);
      bag.userData.colliders = before.cols;
      this.say("Bu yerga qo'yib bo'lmaydi  ·  Can't put it here");
      return false;
    }
    for (let i = this.colliders.length - 1; i >= 0; i--) if (this.colliders[i].bag === bag) this.colliders.splice(i, 1);
    this.colliders.push(box);
    this.carried = null;
    this.body.bagKg = 0;
    this.say("Sumka qo'yildi  ·  Bag put down");
    return true;
  }

  /** Bags that lost their support (the one below was taken) fall straight down (instantly). */
  settleBags() {
    const free = this.bags.filter((b) => b !== this.carried && b.userData.colliders && b.userData.colliders.length);
    const bottom = (b) => Math.min(...b.userData.colliders.map((c) => c.c[1] - c.e[1]));
    free.sort((a, b) => bottom(a) - bottom(b));
    for (const bag of free) {
      const c = this.bagCentre(bag);
      const low = bottom(bag);
      const support = this.supportHeight(c.x, c.z, bag, low + 0.02);
      if (support === null) continue;
      const dy = support - low;
      if (dy < -0.01) {
        const wp = bag.getWorldPosition(new THREE.Vector3());
        wp.y += dy;
        bag.position.copy(bag.parent.worldToLocal(wp));
        bag.updateMatrixWorld(true);
        for (const col of bag.userData.colliders) col.c[1] += dy;
      }
    }
  }

  // ------------------------------------------------------------ per-frame
  /**
   * controls: { fwd, right (-1..1), run, jump (edge), use (edge), pour (held), camYaw }
   * Runs the fixed-step physics (120 Hz) and the animation.
   */
  update(dt, controls, fixed = 1 / 120) {
    if (controls.use) this.useBag();
    const b = this.body;
    this.pouring = !!(this.carried && controls.pour && b.onGround && b.windup < 0);
    let mx = 0, mz = 0;
    if (!this.pouring) {
      const yaw = controls.camYaw || 0;
      const f = controls.fwd || 0, r = controls.right || 0;
      mx = -Math.sin(yaw) * f + Math.cos(yaw) * r;
      mz = -Math.cos(yaw) * f - Math.sin(yaw) * r;
      const m = Math.hypot(mx, mz);
      if (m > 1) { mx /= m; mz /= m; }
    }
    this.running = !!controls.run;
    let jump = !!controls.jump && !this.pouring;
    this.acc = (this.acc || 0) + Math.min(dt, 0.1);
    let steps = 0;
    while (this.acc >= fixed && steps < 24) {
      const wasAir = !b.onGround;
      b.step(fixed, { x: mx, z: mz, run: this.running, jump }, this.world);
      if (wasAir && b.onGround && b.maxHeightThisJump > 0.01) this.lastJumpPeak = b.maxHeightThisJump;
      jump = false;
      this.acc -= fixed;
      steps++;
    }
    if (b.pos[1] < -50) this.respawn();

    // face the walking direction
    const sp = b.horizontalSpeed();
    if (sp > 0.15) this.facing = lerpAngle(this.facing, Math.atan2(b.vel[0], b.vel[2]), 1 - Math.exp(-10 * dt));
    if (this.character) {
      this.character.model.position.fromArray(b.pos);
      this.character.model.rotation.y = this.facing;
    }
    if (this.anim) {
      this.anim.update(dt, {
        onGround: b.onGround, windup: b.windup, vy: b.vel[1], v0: b.lastJumpV || jumpSpeed(b.bagKg),
        speed: sp, carrying: !!this.carried, pouring: this.pouring, running: this.running,
        k: carryFactor(b.bagKg),
      });
    }
    if (this.messageT > 0) this.messageT -= dt;
  }

  respawn() {
    this.body.pos = this.spawn.pos.slice();
    this.body.vel = [0, 0, 0];
    this.facing = this.spawn.yaw;
  }

  /** Third-person camera: orbit around the head, pulled in front of walls / boxes, kept above ground. */
  cameraPose(yaw, pitch, dist) {
    const t = [this.body.pos[0], this.body.pos[1] + CAM.height, this.body.pos[2]];
    const d = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    let free = dist;
    for (const c of this.colliders) {
      if (!c.enabled) continue;
      const hit = rayVsOBB(t, d, c);
      if (hit !== null && hit < free + CAM.pad) free = Math.max(CAM.minDist, hit - CAM.pad);
    }
    const p = [t[0] + d[0] * free, t[1] + d[1] * free, t[2] + d[2] * free];
    const gy = this.groundHeight(p[0], p[2]);
    if (gy !== null && p[1] < gy + CAM.groundClear) p[1] = gy + CAM.groundClear;
    return { target: t, position: p, dist: free };
  }

  /** Nearest ICE_* object within `range` metres (for the HUD hint). */
  nearIce(range = 3) {
    const p = new THREE.Vector3().fromArray(this.body.pos);
    for (const ice of this.level.ice) {
      if (ice.getWorldPosition(new THREE.Vector3()).distanceTo(p) < range) return ice;
    }
    return null;
  }

  hud() {
    const b = this.body;
    return {
      speed: b.horizontalSpeed(),
      g: this.g,
      gravityKey: this.gravityKey,
      onGround: b.onGround,
      carrying: !!this.carried,
      pouring: this.pouring,
      lastJumpPeak: this.lastJumpPeak,
      nearBag: this.carried ? null : this.nearestBag(),
      ...readout(b.bagKg, this.g),
    };
  }
}

/** Conservative OBB overlap: centre or any corner of `a` inside `b`. Good enough for small bags. */
export function obbOverlapApprox(a, b) {
  if (pointInOBB(a.c, b, -0.02)) return true;
  for (const sx of [-1, 1]) for (const sy of [-0.8, 0.8]) for (const sz of [-1, 1]) {
    const p = [0, 1, 2].map((k) => a.c[k] + a.u[0][k] * a.e[0] * sx + a.u[1][k] * a.e[1] * sy + a.u[2][k] * a.e[2] * sz);
    if (pointInOBB(p, b, -0.02)) return true;
  }
  return false;
}

export { GRAVITY, GRAVITY_NAMES, MOVE, BODY };

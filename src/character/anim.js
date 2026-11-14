// The astronaut's animation state machine (made by Samandar for the Moon demo, moved here when the demo's
// character joined the game, 15 Nov). Clips in public/models/astronaut/astronaut.glb: Idle, Walk, Run, Carry, Pour,
// Jump, JumpStart, JumpAir, JumpLand — made in Blender with planted boots (blender/game3d/characters/anim/).
import * as THREE from 'three';
import { MOVE } from './physics.js';

/**
 * Ground speed (m/s) each clip's boots are planted for (game3d/characters/anim/clips/*.py, 15 Nov). The clips
 * are in place; playing them at timeScale = speed / CLIP_SPEED keeps a planted boot still on the ground.
 * Run is an Apollo-style alternate-foot lope. An older astronaut.glb without JumpStart uses LEGACY_SPEED.
 */
export const CLIP_SPEED = { Walk: 1.0, Run: 2.0, Carry: 0.8 };
const LEGACY_SPEED = { Walk: MOVE.walk, Run: MOVE.run, Carry: MOVE.walk };

/**
 * When each boot is flat and planted, as a fraction of the clip (Walk/Carry: left heel strike at 0, right at 0.5,
 * duty 0.6; Run lope: left lands at 5/40, right at 25/40, flat ~5 frames later). A footfall is reported there, at
 * the boot's real position, so boot prints land exactly under the boots.
 */
export const STANCE = { Walk: [[0.2, 'L'], [0.7, 'R']], Carry: [[0.2, 'L'], [0.7, 'R']], Run: [[0.25, 'L'], [0.75, 'R']] };
const BOOT_CENTRE = 0.58;   // the sole's centre lies 58 % of the way from the ankle to the toe joint
const SIDE = { L: 'Left', R: 'Right' };

/**
 * Animation state machine with cross-fades: Idle / Walk / Run / Carry (+ CarryIdle, Pour) and the jump in three
 * parts: JumpStart (scrubbed by the wind-up), JumpAir (scrubbed by flight progress), JumpLand (played once).
 * Falls back to the single Jump clip when the GLB has no JumpStart/JumpAir.
 */
export class AnimController {
  constructor(model, clips) {
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const name of ['Idle', 'Walk', 'Run', 'Jump', 'Carry', 'Pour', 'JumpStart', 'JumpAir', 'JumpLand']) {
      if (clips[name]) this.actions[name] = this.mixer.clipAction(clips[name]);
    }
    if (clips.Pour) {
      const hold = clips.Pour.clone();
      hold.name = 'CarryIdle';
      this.actions.CarryIdle = this.mixer.clipAction(hold);   // Pour frame 0 = standing with the bag
    }
    for (const n of ['Jump', 'JumpStart', 'JumpAir', 'JumpLand']) {
      const a = this.actions[n];
      if (a) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
    }
    this.split = !!(this.actions.JumpStart && this.actions.JumpAir);
    this.speeds = this.split ? CLIP_SPEED : LEGACY_SPEED;
    this.k = 1;          // carry factor from the last update
    this.landing = 0;    // s left of JumpLand
    this.wasAir = false;
    this.airTime = 0;
    this.current = null;
    this.state = '';
    /** Footfalls since the last read: { x, z, yaw, side: 'L' | 'R', run } in world space. The reader empties it. */
    this.footfalls = [];
    this.boots = {};
    for (const k of ['L', 'R']) {
      const foot = model.getObjectByName(SIDE[k] + 'Foot');
      const toe = model.getObjectByName(SIDE[k] + 'ToeBase');
      if (foot && toe) this.boots[k] = { foot, toe };
    }
    this.phase = -1;
    this.phaseOf = '';
    this.va = new THREE.Vector3();
    this.vb = new THREE.Vector3();
    this.play('Idle', 0);
  }

  /** World position and heading of boot k's sole centre (call after the mixer has posed the bones). */
  bootOnGround(k) {
    const b = this.boots[k];
    if (!b) return null;
    b.toe.updateWorldMatrix(true, false);
    b.foot.getWorldPosition(this.va);
    b.toe.getWorldPosition(this.vb);
    const dx = this.vb.x - this.va.x, dz = this.vb.z - this.va.z;
    return { x: this.va.x + dx * BOOT_CENTRE, z: this.va.z + dz * BOOT_CENTRE, yaw: Math.atan2(dx, dz) };
  }

  /** Report a footfall when the playing locomotion clip passes a boot's mid-stance. */
  trackFootfalls() {
    const st = STANCE[this.state];
    const a = this.current;
    if (!st || !a || !this.split || a.getEffectiveWeight() < 0.5) {
      this.phaseOf = '';
      return;
    }
    const d = a.getClip().duration;
    const ph = (((a.time % d) + d) % d) / d;
    if (this.phaseOf === this.state) {
      for (const [at, k] of st) {
        const crossed = this.phase <= ph ? this.phase < at && at <= ph : this.phase < at || at <= ph;
        if (crossed) {
          const p = this.bootOnGround(k);
          if (p) this.footfalls.push({ ...p, side: k, run: this.state === 'Run' });
        }
      }
    }
    this.phase = ph;
    this.phaseOf = this.state;
  }

  /** Both boots at once (landing from a jump). */
  bothFeet() {
    for (const k of ['L', 'R']) {
      const p = this.bootOnGround(k);
      if (p) this.footfalls.push({ ...p, side: k, run: false, landing: true });
    }
  }

  /** timeScale that keeps the planted boot of clip `name` still at ground speed `speed`. */
  scaleFor(name, speed, lo = 0.4, hi = 2.0) {
    const planted = (this.speeds[name] || 1) * (this.split ? 1 : this.k);   // legacy clips: MOVE.walk * k
    return THREE.MathUtils.clamp(speed / planted, lo, hi);
  }

  play(name, fade = 0.25) {
    const next = this.actions[name];
    if (!next || this.current === next) return;
    next.reset();
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.paused = false;
    if (this.current && fade > 0) {
      next.fadeIn(fade);
      this.current.fadeOut(fade);
    } else if (this.current) {
      this.current.stop();
    }
    next.play();
    this.current = next;
    this.state = name;
  }

  /** s: { onGround, windup, vy, v0, speed, carrying, pouring, running, k } */
  update(dt, s) {
    this.k = s.k || 1;
    const landed = this.split && this.wasAir && s.onGround && this.airTime > 0.3;
    if (this.split) this.updateSplit(dt, s);
    else this.updateLegacy(dt, s);
    this.mixer.update(dt);
    this.trackFootfalls();
    if (landed) this.bothFeet();
  }

  updateSplit(dt, s) {
    const A = this.actions;
    const air = !s.onGround;
    if (s.windup >= 0) {
      // crouch and push: JumpStart scrubbed by wind-up progress (its last frame = take-off pose)
      this.play('JumpStart', 0.15);
      const d = A.JumpStart.getClip().duration;
      A.JumpStart.paused = true;
      A.JumpStart.time = Math.min(d - 0.001, (s.windup / Math.max(MOVE.windup, 1e-3)) * d);
    } else if (air) {
      // flight: JumpAir scrubbed by progress u (0 take-off, 0.5 apex, 1 touch-down); walking off a ledge starts at u = 0.5
      this.play('JumpAir', this.state === 'JumpStart' ? 0.06 : 0.25);
      const v0 = Math.max(s.v0 || 1.0, 0.3);
      const u = THREE.MathUtils.clamp((v0 - s.vy) / (2 * v0), 0, 1);
      A.JumpAir.paused = true;
      A.JumpAir.time = u * (A.JumpAir.getClip().duration - 0.001);
    } else if (this.wasAir && this.airTime > 0.3 && A.JumpLand && !s.pouring) {
      // touch-down after a real flight (not a step off a box): knees absorb, then back to Idle
      this.play('JumpLand', 0.06);
      this.landing = A.JumpLand.getClip().duration;
    } else if (this.landing > 0 && this.state === 'JumpLand' && s.speed < 0.6 && !s.pouring) {
      this.landing -= dt;      // let the knees absorb, unless the player is already moving on
    } else {
      this.landing = 0;
      this.locomotion(s);
    }
    this.airTime = air ? this.airTime + dt : 0;
    this.wasAir = air;
  }

  locomotion(s) {
    const A = this.actions;
    if (s.carrying) {
      if (s.pouring && A.Pour) {
        this.play('Pour', 0.3);
      } else if (s.speed > 0.15) {
        this.play('Carry', 0.25);
        A.Carry.timeScale = this.scaleFor('Carry', s.speed);
      } else {
        this.play('CarryIdle', 0.3);
        A.CarryIdle.paused = true;
        A.CarryIdle.time = 0;
      }
    } else if (s.speed > 0.15) {
      if (s.running && s.speed > 0.5 * (MOVE.walk + MOVE.run) * s.k) {
        this.play('Run', 0.25);
        A.Run.timeScale = this.scaleFor('Run', s.speed, 0.6, 2.0);
      } else {
        this.play('Walk', 0.25);
        A.Walk.timeScale = this.scaleFor('Walk', s.speed);
      }
    } else {
      this.play('Idle', 0.3);
    }
  }

  /** Older astronaut.glb (single Jump clip, clips planted for MOVE.walk / MOVE.run). */
  updateLegacy(dt, s) {
    const A = this.actions;
    if (!s.onGround || s.windup >= 0) {
      if (this.state !== 'Jump') {
        this.play('Jump', s.windup >= 0 ? 0.1 : 0.2);
        A.Jump.time = s.windup >= 0 ? 0.06 : 0.55;
      }
      A.Jump.paused = true;
      if (s.windup >= 0) {
        A.Jump.time = Math.min(0.06 + s.windup, 0.24);
      } else {
        const v0 = Math.max(s.v0 || 1.0, 0.3);
        const u = Math.min(1, Math.max(0, (v0 - s.vy) / (2 * v0)));
        A.Jump.time = Math.min(0.24 + u * 0.94, A.Jump.getClip().duration - 0.001);
      }
    } else {
      this.locomotion(s);
    }
  }
}

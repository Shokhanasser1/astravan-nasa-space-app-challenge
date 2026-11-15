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
/** Thigh + shin (m) of the rig the clips were made on (blender/game3d/characters, 1.86 m suit). */
const CLIP_LEG = 0.68;

/** The model's leg length against CLIP_LEG (1 when it is the same rig, or the bones are not found). */
function legScale(model) {
  const up = model.getObjectByName('LeftUpLeg');
  const knee = model.getObjectByName('LeftLeg');
  const ankle = model.getObjectByName('LeftFoot');
  if (!up || !knee || !ankle) return 1;
  model.updateMatrixWorld(true);
  const a = up.getWorldPosition(new THREE.Vector3());
  const b = knee.getWorldPosition(new THREE.Vector3());
  const c = ankle.getWorldPosition(new THREE.Vector3());
  const k = (a.distanceTo(b) + b.distanceTo(c)) / CLIP_LEG;
  return Math.abs(k - 1) < 0.03 ? 1 : k;
}
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
 * One-shot gestures over Idle (Blender: game3d/characters/anim/clips/gesture_*.py), each from and back to the idle
 * pose, boots planted: Insert (a battery from the thigh pocket into a building; played backward = take it out and
 * pocket it), Wrist (check the wrist tablet), LookAround (idle variation: look round the base and up at the sky).
 * Moving, jumping or carrying ends a gesture at once; an older astronaut.glb without them simply skips them.
 */
export const GESTURES = ['Insert', 'Wrist', 'LookAround'];
/** Seconds into Insert while the battery is in the glove (clip meta grab_frame / release_frame at 30 fps). */
export const INSERT_HOLD = { from: 12 / 30, to: 44 / 30 };
/**
 * Climb (Blender: game3d/characters/anim/clips/climb.py, 42 frames): hands and boots on a vertical ladder with
 * 0.30 m rungs, in place, looping; one cycle rises two rungs (meta rise_per_cycle 0.6 m), i.e. CLIMB_RISE m per
 * second of clip. The game moves the body up the habitat's ladder (src/walk/ladder.ts) and scrubs the clip by the
 * height (s.climb = phase 0…1, src/walk/ladder.ts climbPhase), so it runs backward going down and the boots meet
 * the rungs. An older astronaut.glb without it treads in place with Walk at s.climbV / CLIMB_RISE.
 */
export const CLIMB_RISE = 0.6 / 1.4;
/** Idle this long (s, random in the range) → one LookAround. */
export const FIDGET_S = [14, 24];

/**
 * Animation state machine with cross-fades: Idle / Walk / Run / Carry (+ CarryIdle, Pour) and the jump in three
 * parts: JumpStart (scrubbed by the wind-up), JumpAir (scrubbed by flight progress), JumpLand (played once).
 * Falls back to the single Jump clip when the GLB has no JumpStart/JumpAir.
 */
export class AnimController {
  constructor(model, clips) {
    this.mixer = new THREE.AnimationMixer(model);
    /** @type {Record<string, THREE.AnimationAction>} */
    this.actions = {};
    for (const name of ['Idle', 'Walk', 'Run', 'Jump', 'Carry', 'Pour', 'JumpStart', 'JumpAir', 'JumpLand', ...GESTURES, 'Seated', 'SeatedSteer', 'Climb']) {
      if (clips[name]) this.actions[name] = this.mixer.clipAction(clips[name]);
    }
    if (clips.Pour) {
      const hold = clips.Pour.clone();
      hold.name = 'CarryIdle';
      this.actions.CarryIdle = this.mixer.clipAction(hold);   // Pour frame 0 = standing with the bag
    }
    for (const n of ['Jump', 'JumpStart', 'JumpAir', 'JumpLand', ...GESTURES, 'SeatedSteer']) {
      const a = this.actions[n];
      if (a) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
    }
    this.split = !!(this.actions.JumpStart && this.actions.JumpAir);
    this.speeds = this.split ? CLIP_SPEED : LEGACY_SPEED;
    // A rig refitted to shorter legs (the kid astronaut, 15 Nov) takes shorter steps: its clips are planted for ground
    // speeds scaled by its leg length against the rig the clips were made on, so its boots stay planted.
    this.legK = legScale(model);
    if (this.split && this.legK !== 1) {
      this.speeds = Object.fromEntries(Object.entries(CLIP_SPEED).map(([k, v]) => [k, v * this.legK]));
    }
    this.k = 1;          // carry factor from the last update
    this.landing = 0;    // s left of JumpLand
    this.wasAir = false;
    this.airTime = 0;
    this.crouching = false; // in the crouch before a jump (its first frame leaves both boot prints)
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
    /** The playing gesture { name, reverse } or null; one more of the same may wait in `queued`. */
    this.gest = null;
    this.queued = null;
    this.last = null;    // the last update's state (speed, ground…): gestures start only while standing
    this.now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this.idleSince = 0;
    this.fidgetAfter = FIDGET_S[0] + Math.random() * (FIDGET_S[1] - FIDGET_S[0]);
    this.play('Idle', 0);
  }

  /**
   * Play gesture `name` once (backward with reverse = true). Only while standing on the ground and not carrying;
   * the same gesture asked again while it plays waits for it (one at most). Returns true if it plays or waits.
   */
  gesture(name, reverse = false) {
    const a = this.actions[name];
    if (!a || !this.split) return false;
    const s = this.last;
    if (s && (s.speed > 0.15 || !s.onGround || s.windup >= 0 || s.carrying)) return false;
    if (this.gest && this.current === this.actions[this.gest.name]) {
      if (this.gest.name === name) {
        this.queued = { name, reverse };
        return true;
      }
    }
    if (this.current === a) {
      a.stop();               // the same clip clamped at its end (= the idle pose): start it over without a fade
      this.current = null;
    }
    this.play(name, 0.2);
    if (reverse) {
      a.time = a.getClip().duration;
      a.setEffectiveTimeScale(-1);
    }
    this.gest = { name, reverse };
    return true;
  }

  /** Is gesture `name` playing now? */
  gesturing(name) {
    return !!this.gest && (!name || this.gest.name === name) && this.current === this.actions[this.gest.name];
  }

  /** Insert is playing and the battery is in the glove (the scene shows the battery prop). */
  holdingBattery() {
    if (!this.gesturing('Insert')) return false;
    const t = this.actions.Insert.time;
    return t >= INSERT_HOLD.from && t <= INSERT_HOLD.to;
  }

  /** Idle variation: after standing still for a while, look around once. `now` in ms. Returns true if it starts. */
  fidget(now = this.now()) {
    if (this.state !== 'Idle' || this.gest || !this.actions.LookAround) return false;
    if (now - this.idleSince < this.fidgetAfter * 1000) return false;
    this.fidgetAfter = FIDGET_S[0] + Math.random() * (FIDGET_S[1] - FIDGET_S[0]);
    return this.gesture('LookAround');
  }

  /** Keep the gesture going; false once it has ended or the player moves (locomotion takes over). */
  holdGesture(s) {
    const g = this.gest;
    if (!g) return false;
    const a = this.actions[g.name];
    if (this.current !== a || s.speed > 0.15 || s.carrying) {
      this.gest = null;
      this.queued = null;
      return false;
    }
    if (!a.paused) return true;   // LoopOnce + clampWhenFinished pauses on the last (or, backward, first) frame
    this.gest = null;
    const q = this.queued;
    this.queued = null;
    return q ? this.gesture(q.name, q.reverse) : false;
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
    if (name === 'Idle') this.idleSince = this.now();
  }

  /**
   * s: { onGround, windup, vy, v0, speed, carrying, pouring, running, k, seated?, steer? (−1 left … 1 right),
   * climb? (on a ladder: the Climb clip's phase 0…1; null or undefined: not climbing), climbV? (its vertical
   * speed, full-size m/s, negative down) }
   */
  update(dt, s) {
    this.k = s.k || 1;
    this.last = s;
    if (!s.onGround || s.windup >= 0) {
      this.gest = null;   // a jump or a fall ends any gesture
      this.queued = null;
    }
    const landed = this.split && this.wasAir && s.onGround && this.airTime > 0.3;
    // the crouch before a jump: both boots planted where it starts (the body stands still through it, body.ts)
    const crouched = this.split && s.onGround && s.windup >= 0 && !this.crouching;
    this.crouching = s.windup >= 0;
    if (this.split) this.updateSplit(dt, s);
    else this.updateLegacy(dt, s);
    this.mixer.update(dt);
    this.trackFootfalls();
    if (landed || crouched) this.bothFeet();
  }

  updateSplit(dt, s) {
    const A = this.actions;
    if (s.seated && A.SeatedSteer) {
      // at the rover's controls: the steer clip scrubbed by the stick (frame 0 full left, middle straight, end right)
      this.play('SeatedSteer', 0.25);
      const d = A.SeatedSteer.getClip().duration;
      A.SeatedSteer.paused = true;
      A.SeatedSteer.time = Math.min(d - 0.001, Math.max(0, ((s.steer || 0) + 1) / 2) * d);
      this.wasAir = false;
      this.airTime = 0;
      return;
    }
    if (s.climb !== undefined && s.climb !== null) {
      // on the habitat's ladder: Climb at the rise speed (backward going down); no Climb clip: Walk in place
      this.gest = null;
      this.queued = null;
      if (A.Climb) {
        this.play('Climb', 0.2);
        const d = A.Climb.getClip().duration;
        A.Climb.paused = true;
        A.Climb.time = THREE.MathUtils.clamp(s.climb, 0, 1) * (d - 0.001);
      } else {
        this.play('Walk', 0.2);
        A.Walk.timeScale = THREE.MathUtils.clamp(Math.abs(s.climbV || 0) / CLIMB_RISE, 0, 1.2);
      }
      this.wasAir = false;
      this.airTime = 0;
      return;
    }
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
      if (!this.holdGesture(s)) this.locomotion(s);
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

/**
 * The robot arm: Curiosity's robotic arm cut out of NASA's rover model into three moving parts
 * (public/models/curiosity-arm/curiosity-arm.glb: arm_upper -> arm_fore -> arm_turret; the shoulder at the origin, the
 * arm reaching along +Z). By default 1.8x on our own 1 m pedestal (3.7 m tall standing up, ~4 m reach). On the crew
 * rover's roof (15 Nov, Shoxjahon aka: "put it on the car, longer, four claws twice as big") it is 2.4x on a short
 * turret that turns (the `turn` angle), and the roof is its floor. The gripper (ours: Curiosity has a drill and a
 * scoop there, not a hand) has four claws round the tool's axis. Plain three.js; src/scene/RobotArm.tsx places it.
 */
import * as THREE from 'three';
import { clearPose, type ArmShape } from './kin';
import { BEND, LIFT, TURN, WRIST } from './reach';
import { REST, type ArmAngles } from './state';

export const ARM_SCALE = 1.8;
/** m, the shoulder joint above the ground (top of the pedestal). */
export const SHOULDER_H = 1.0;
/** The joints in the model (its own units, before the scale): the elbow from the shoulder, the wrist from the elbow. */
const ELBOW_AT = new THREE.Vector3(0, -0.003, 0.811);
const WRIST_AT = new THREE.Vector3(0, 0.785, 0);
const RAD = Math.PI / 180;
/** Max change per second (deg, deg, deg, 0..1, deg): heavy, not twitchy. */
const SPEED: Required<ArmAngles> = { lift: 70, bend: 90, wrist: 120, open: 2.5, turn: 60 };
/** m: within this of the axis the "ground" is the pedestal's top. */
const PEDESTAL_R = 0.75;
/** Claw angle, degrees (closed: the bent tips meet). */
const JAW = { open: 32, closed: 0 };
/** The claws: how many round the tool's axis, and their size against the first two-jaw gripper. */
const CLAWS = 4;
const CLAW_SIZE = 2;

export interface ArmOptions {
  /** Size of the NASA arm (its model is ~1/1.8 of the pedestal arm). */
  scale?: number;
  /** m, the shoulder above the foot of the mount (the pedestal or the roof turret). */
  shoulder?: number;
  /** A deck the arm stands on (the rover's roof): around the foot, metres back and front along the mount's +Z, and
   * half its width; the arm keeps above it as above the ground. Without one: the pedestal. */
  deck?: { back: number; front: number; halfW: number };
}

const white = new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.7, metalness: 0.15 });
const dark = new THREE.MeshStandardMaterial({ color: 0x5b5f66, roughness: 0.5, metalness: 0.5 });
const gold = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.4, metalness: 0.7 });

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** One claw, `k` times the first gripper's jaw: a hinge at the origin, a finger along +Y bending in (towards −Z). */
function claw(k: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.035 * k, 0.035 * k, 0.1 * k, 12).rotateZ(Math.PI / 2), dark));
  g.add(mesh(new THREE.BoxGeometry(0.08 * k, 0.26 * k, 0.035 * k), white, 0, 0.13 * k, 0));
  const tip = new THREE.Group();
  tip.position.set(0, 0.26 * k, 0);
  tip.rotation.x = -0.3;
  tip.add(mesh(new THREE.BoxGeometry(0.08 * k, 0.12 * k, 0.035 * k), gold, 0, 0.06 * k, 0));
  g.add(tip);
  g.position.z = 0.055 * k;
  return g;
}

export class ArmRig {
  readonly root = new THREE.Group();
  /** Eased towards the target. */
  cur: Required<ArmAngles> = { ...REST, turn: 0 };
  target: Required<ArmAngles> = { ...REST, turn: 0 };
  /** What is drawn: `cur` kept out of the ground. */
  shown: Required<ArmAngles> = { ...REST, turn: 0 };
  private ground: ((x: number, z: number) => number) | null = null;
  private readonly turnTable = new THREE.Group();
  private readonly upper: THREE.Object3D;
  private readonly fore: THREE.Object3D;
  private readonly wrist = new THREE.Group();
  private readonly claws: THREE.Group[] = [];
  private readonly shape: ArmShape;
  private readonly fromModel = new Set<THREE.Mesh>();
  private readonly shoulder: number;
  private readonly deck: ArmOptions['deck'] | null;
  private readonly p = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly d = new THREE.Vector3();
  /** The gripper's centre between the claws (where a lifted thing sits; src/arm/cargo.ts). */
  private readonly grip = new THREE.Object3D();
  private readonly gripScale = new THREE.Vector3();

  constructor(arm: THREE.Object3D, opts: ArmOptions = {}) {
    const scale = opts.scale ?? ARM_SCALE;
    const H = (this.shoulder = opts.shoulder ?? SHOULDER_H);
    this.deck = opts.deck ?? null;
    this.root.name = 'ROBOT_ARM';
    if (this.deck) {
      // on the roof: a low mounting plate and the turret drum
      this.root.add(mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.06, 24), dark, 0, 0.03, 0));
      this.root.add(mesh(new THREE.CylinderGeometry(0.3, 0.36, H - 0.12, 20), white, 0, 0.06 + (H - 0.12) / 2, 0));
    } else {
      // pedestal (ours): base plate, column, a gold ring, the turntable under the shoulder
      this.root.add(mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.1, 24), white, 0, 0.05, 0));
      this.root.add(mesh(new THREE.CylinderGeometry(0.2, 0.26, H - 0.25, 20), white, 0, 0.1 + (H - 0.25) / 2, 0));
      this.root.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24), gold, 0, H - 0.15, 0));
    }
    this.turnTable.position.y = H;
    this.turnTable.add(mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.12, 24), white, 0, -0.06, 0));
    this.turnTable.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.03, 24), gold, 0, -0.01, 0));
    this.root.add(this.turnTable);

    arm.scale.setScalar(scale);
    arm.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        this.fromModel.add(o as THREE.Mesh);
      }
    });
    this.turnTable.add(arm);
    const upper = arm.getObjectByName('arm_upper');
    const fore = arm.getObjectByName('arm_fore');
    const turret = arm.getObjectByName('arm_turret');
    if (!upper || !fore || !turret) throw new Error('curiosity-arm.glb: arm_upper / arm_fore / arm_turret missing');
    this.upper = upper;
    this.fore = fore;
    // The optimiser may move a leaf node's origin (mesh quantization), so the turret turns on a pivot of our own at
    // the wrist joint; the elbow is the fore node's own origin (kept, it has children).
    fore.position.copy(ELBOW_AT);
    this.wrist.position.copy(WRIST_AT);
    fore.add(this.wrist);
    arm.updateMatrixWorld(true);
    this.wrist.attach(turret);

    // gripper (ours) past the tool turret, pointing on along the forearm: four claws round its axis, each on a holder
    // turned a quarter round, all closing on the middle (sizes in the arm model's units: they grow with the arm)
    const k = CLAW_SIZE;
    const hand = new THREE.Group();
    hand.position.set(0, 0.43, -0.1);
    hand.add(mesh(new THREE.BoxGeometry(0.15 * k, 0.07 * k, 0.15 * k), dark, 0, -0.02 * k, 0));
    hand.add(mesh(new THREE.CylinderGeometry(0.06 * k, 0.08 * k, 0.05 * k, 16), gold, 0, -0.07 * k, 0));
    for (let i = 0; i < CLAWS; i++) {
      const holder = new THREE.Group();
      holder.rotation.y = (i * 2 * Math.PI) / CLAWS;
      const c = claw(k);
      holder.add(c);
      hand.add(holder);
      this.claws.push(c);
    }
    this.grip.position.set(0, 0.28 * k, 0); // where the claws' gold tips bend in
    hand.add(this.grip);
    this.wrist.add(hand);

    this.shape = {
      H,
      L1: 0.811 * scale,
      L2: 0.785 * scale,
      T: 0.28 * scale,
      L3: 0.81 * scale + 0.2 * (k - 1),
      clear: { elbow: 0.25, wrist: 0.35, turret: 0.5, tip: 0.1 },
      groundAt: (r) => this.groundRel(r),
    };
    this.apply();
  }

  /** Stand the arm at (x, y, z) facing yaw (its reach along +Z turned by yaw); ground(x, z) -> height. */
  place(x: number, y: number, z: number, yaw: number, ground: (x: number, z: number) => number): void {
    this.root.position.set(x, y, z);
    this.root.rotation.set(0, yaw, 0);
    this.root.updateMatrixWorld(true);
    this.ground = ground;
    this.apply();
  }

  /** The ground to keep clear of (when the arm is carried by something else that sets its place: the rover). */
  setGround(ground: (x: number, z: number) => number): void {
    this.ground = ground;
  }

  /** The mount moved (the rover drove on): keep the arm clear of the ground under its new place. */
  refresh(): void {
    this.apply();
  }

  /**
   * Height of what is under the reach, r metres out (along the turned arm), relative to the mount's foot: the deck
   * (the roof) or the pedestal near the axis, else the ground, wherever the mount stands now (world).
   */
  private groundRel(r: number): number {
    const t = this.cur.turn * RAD;
    const lx = Math.sin(t) * r, lz = Math.cos(t) * r; // in the mount's own frame
    if (this.deck && lz > -this.deck.back && lz < this.deck.front && Math.abs(lx) < this.deck.halfW) return 0;
    let g = -100;
    if (this.ground) {
      this.root.updateWorldMatrix(true, false);
      this.root.getWorldPosition(this.p);
      this.root.getWorldQuaternion(this.q);
      this.d.set(lx, 0, lz).applyQuaternion(this.q);
      g = this.ground(this.p.x + this.d.x, this.p.z + this.d.z) - this.p.y;
    } else g = 0;
    return !this.deck && Math.abs(r) < PEDESTAL_R ? Math.max(g, this.shoulder - 0.05) : g;
  }

  /** New targets (null keeps the old one): lift, bend, wrist and turn in degrees, open 0..1. */
  set(t: Partial<Record<keyof ArmAngles, number | null>>): void {
    const lim = (v: number, r: { min: number; max: number }) => Math.min(r.max, Math.max(r.min, v));
    if (t.lift != null) this.target.lift = lim(t.lift, LIFT);
    if (t.bend != null) this.target.bend = lim(t.bend, BEND);
    if (t.wrist != null) this.target.wrist = lim(t.wrist, WRIST);
    if (t.open != null) this.target.open = Math.min(1, Math.max(0, t.open));
    if (t.turn != null) this.target.turn = lim(t.turn, TURN);
  }

  /** Eases towards the target; returns true while it still moves (the scene keeps drawing frames). */
  update(dt: number): boolean {
    let moving = false;
    for (const k of ['lift', 'bend', 'wrist', 'open', 'turn'] as const) {
      const d = this.target[k] - this.cur[k];
      const step = SPEED[k] * dt;
      if (Math.abs(d) > 1e-4) moving = true;
      this.cur[k] += Math.abs(d) <= step ? d : Math.sign(d) * step;
    }
    if (moving) this.apply();
    return moving;
  }

  /** Frees what was made here (the pedestal and the claws); the GLB's own parts belong to the loader's cache. */
  dispose(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !this.fromModel.has(m)) m.geometry.dispose();
    });
  }

  /** The gripper's centre between the claws, world position and turn, written into pos and quat (no allocation). */
  gripWorld(pos: THREE.Vector3, quat: THREE.Quaternion): void {
    this.grip.updateWorldMatrix(true, false);
    this.grip.matrixWorld.decompose(pos, quat, this.gripScale);
  }

  /** True when the ground or the pedestal holds the arm short of where it is going. */
  held(): boolean {
    const c = this.cur;
    const s = this.shown;
    return Math.abs(c.lift - s.lift) + Math.abs(c.bend - s.bend) + Math.abs(c.wrist - s.wrist) > 3;
  }

  private apply(): void {
    // never into the ground, the pedestal or the roof: each joint turned only as far as it must (kin.ts)
    const s = clearPose(this.cur, this.shape);
    this.shown = { lift: s.lift, bend: s.bend, wrist: s.wrist, open: this.cur.open, turn: this.cur.turn };
    // turn: the whole arm round the vertical axis; lift: the upper arm up from level (a negative X turn raises the +Z
    // reach); bend: the forearm from straight on (+90 deg = straight, as the model rests at 90 deg); wrist: the turret
    // from the forearm's line (+ up)
    this.turnTable.rotation.y = this.cur.turn * RAD;
    this.upper.rotation.x = -s.lift * RAD;
    this.fore.rotation.x = (90 - s.bend) * RAD;
    this.wrist.rotation.x = -s.wrist * RAD;
    const j = (JAW.closed + (JAW.open - JAW.closed) * this.cur.open) * RAD;
    for (const c of this.claws) c.rotation.x = j;
  }
}

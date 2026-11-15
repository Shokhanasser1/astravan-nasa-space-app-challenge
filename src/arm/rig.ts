/**
 * The robot arm: Curiosity's robotic arm cut out of NASA's rover model into three moving parts
 * (public/models/curiosity-arm/curiosity-arm.glb: arm_upper -> arm_fore -> arm_turret; the shoulder at the origin, the
 * arm reaching along +Z), scaled 1.8x on our own pedestal. Standing up it is 3.7 m tall, twice the astronaut (1.85 m);
 * stretched out it reaches about 4 m. The gripper jaws on the tool turret and the pedestal are drawn here (Curiosity
 * has a drill and a scoop there, not a hand). Plain three.js; src/scene/RobotArm.tsx puts it in the scene.
 */
import * as THREE from 'three';
import { clearPose, type ArmShape } from './kin';
import { BEND, LIFT, WRIST } from './reach';
import { REST, type ArmAngles } from './state';

export const ARM_SCALE = 1.8;
/** m, the shoulder joint above the ground (top of the pedestal). */
export const SHOULDER_H = 1.0;
/** The joints in the model (its own units, before ARM_SCALE): the elbow from the shoulder, the wrist from the elbow. */
const ELBOW_AT = new THREE.Vector3(0, -0.003, 0.811);
const WRIST_AT = new THREE.Vector3(0, 0.785, 0);
const RAD = Math.PI / 180;
/** Max change per second (deg, deg, deg, 0..1): heavy, not twitchy. */
const SPEED: ArmAngles = { lift: 70, bend: 90, wrist: 120, open: 2.5 };
/** m: within this of the axis the "ground" is the pedestal's top. */
const PEDESTAL_R = 0.75;
/** Jaw angle, degrees (closed: the bent tips meet). */
const JAW = { open: 32, closed: 0 };
/** Lengths in the arm's plane (m, scaled) and how far each part keeps above the ground (kin.ts). */
const SHAPE = {
  H: SHOULDER_H,
  L1: 0.811 * ARM_SCALE,
  L2: 0.785 * ARM_SCALE,
  T: 0.28 * ARM_SCALE,
  L3: 0.81 * ARM_SCALE,
  clear: { elbow: 0.25, wrist: 0.35, turret: 0.5, tip: 0.1 },
};

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

/** One jaw: a hinge at the origin, a finger along +Y bending inwards (towards -sign Z) at the tip. */
function jaw(sign: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 12).rotateZ(Math.PI / 2), dark));
  g.add(mesh(new THREE.BoxGeometry(0.08, 0.26, 0.035), white, 0, 0.13, 0));
  const tip = new THREE.Group();
  tip.position.set(0, 0.26, 0);
  tip.rotation.x = -sign * 0.3;
  tip.add(mesh(new THREE.BoxGeometry(0.08, 0.12, 0.035), gold, 0, 0.06, 0));
  g.add(tip);
  g.position.z = sign * 0.055;
  return g;
}

export class ArmRig {
  readonly root = new THREE.Group();
  /** Eased towards the target. */
  cur: ArmAngles = { ...REST };
  target: ArmAngles = { ...REST };
  /** What is drawn: `cur` kept out of the ground. */
  shown: ArmAngles = { ...REST };
  private ground: ((x: number, z: number) => number) | null = null;
  private readonly upper: THREE.Object3D;
  private readonly fore: THREE.Object3D;
  private readonly wrist = new THREE.Group();
  private readonly jawA = jaw(1);
  private readonly jawB = jaw(-1);
  private readonly shape: ArmShape;
  private readonly fromModel = new Set<THREE.Mesh>();

  constructor(arm: THREE.Object3D) {
    this.root.name = 'ROBOT_ARM';
    // pedestal (ours): base plate, column, a gold ring, the turntable under the shoulder
    this.root.add(mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.1, 24), white, 0, 0.05, 0));
    this.root.add(mesh(new THREE.CylinderGeometry(0.2, 0.26, SHOULDER_H - 0.25, 20), white, 0, 0.1 + (SHOULDER_H - 0.25) / 2, 0));
    this.root.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24), gold, 0, SHOULDER_H - 0.15, 0));
    const turn = new THREE.Group();
    turn.position.y = SHOULDER_H;
    turn.add(mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.12, 24), white, 0, -0.06, 0));
    this.root.add(turn);

    arm.scale.setScalar(ARM_SCALE);
    arm.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        this.fromModel.add(o as THREE.Mesh);
      }
    });
    turn.add(arm);
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

    // gripper (ours) past the tool turret, pointing on along the forearm; jaws open and close in the arm's plane
    const hand = new THREE.Group();
    hand.position.set(0, 0.43, -0.1);
    hand.add(mesh(new THREE.BoxGeometry(0.16, 0.07, 0.2), dark, 0, -0.02, 0));
    hand.add(this.jawA, this.jawB);
    this.wrist.add(hand);

    this.shape = { ...SHAPE, groundAt: (r) => this.groundRel(r) };
    this.apply();
  }

  /** Stand the arm at (x, y, z) facing yaw (its reach along +Z turned by yaw); ground(x, z) -> height. */
  place(x: number, y: number, z: number, yaw: number, ground: (x: number, z: number) => number): void {
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
    this.root.updateMatrixWorld(true);
    this.ground = ground;
    this.apply();
  }

  /** Ground height r metres along the reach, relative to the pedestal's foot; the pedestal itself near the axis. */
  private groundRel(r: number): number {
    let g = 0;
    if (this.ground) {
      const p = this.root.position;
      const a = this.root.rotation.y;
      g = this.ground(p.x + Math.sin(a) * r, p.z + Math.cos(a) * r) - p.y;
    }
    return Math.abs(r) < PEDESTAL_R ? Math.max(g, SHOULDER_H - 0.05) : g;
  }

  /** New targets (null keeps the old one): lift, bend and wrist in degrees, open 0..1. */
  set(t: Partial<Record<keyof ArmAngles, number | null>>): void {
    const lim = (v: number, r: { min: number; max: number }) => Math.min(r.max, Math.max(r.min, v));
    if (t.lift != null) this.target.lift = lim(t.lift, LIFT);
    if (t.bend != null) this.target.bend = lim(t.bend, BEND);
    if (t.wrist != null) this.target.wrist = lim(t.wrist, WRIST);
    if (t.open != null) this.target.open = Math.min(1, Math.max(0, t.open));
  }

  /** Eases towards the target; returns true while it still moves (the scene keeps drawing frames). */
  update(dt: number): boolean {
    let moving = false;
    for (const k of ['lift', 'bend', 'wrist', 'open'] as const) {
      const d = this.target[k] - this.cur[k];
      const step = SPEED[k] * dt;
      if (Math.abs(d) > 1e-4) moving = true;
      this.cur[k] += Math.abs(d) <= step ? d : Math.sign(d) * step;
    }
    if (moving) this.apply();
    return moving;
  }

  /** Frees what was made here (the pedestal and the jaws); the GLB's own parts belong to the loader's cache. */
  dispose(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !this.fromModel.has(m)) m.geometry.dispose();
    });
  }

  /** True when the ground or the pedestal holds the arm short of where it is going. */
  held(): boolean {
    const c = this.cur;
    const s = this.shown;
    return Math.abs(c.lift - s.lift) + Math.abs(c.bend - s.bend) + Math.abs(c.wrist - s.wrist) > 3;
  }

  private apply(): void {
    // never into the ground or the pedestal: each joint turned only as far as it must (kin.ts)
    const s = clearPose(this.cur, this.shape);
    this.shown = { lift: s.lift, bend: s.bend, wrist: s.wrist, open: this.cur.open };
    // lift: the upper arm up from level (a negative X turn raises the +Z reach); bend: the forearm from straight on
    // (+90 deg = straight, as the model rests at 90 deg); wrist: the turret from the forearm's line (+ up)
    this.upper.rotation.x = -s.lift * RAD;
    this.fore.rotation.x = (90 - s.bend) * RAD;
    this.wrist.rotation.x = -s.wrist * RAD;
    const j = (JAW.closed + (JAW.open - JAW.closed) * this.cur.open) * RAD;
    this.jawA.rotation.x = j;
    this.jawB.rotation.x = -j;
  }
}

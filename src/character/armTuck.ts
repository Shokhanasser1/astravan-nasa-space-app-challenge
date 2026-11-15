import * as THREE from 'three';

/**
 * Arms in by a wall (15 Nov playtest: "inside a building its hands go into the walls"). The kid astronaut's arms hang
 * away from the suit: in Idle its hands are 0.54 m out to the side, walking 0.59 m (measured on
 * public/models/astronaut/astronaut.glb), but the walls stop its body at 0.28 m indoors (src/walk/rooms.ts ROOM_BODY:
 * the rooms' doorways and ladder rail allow no more) and 0.35 m outside. So near a wall each arm turns in at the
 * shoulder, about the body's forward axis, just enough that the hand stays within `maxSide` of the body's middle.
 * Only the two upper-arm bones turn, after the clips have posed the body: the legs, the boots (and so their prints),
 * the jump and the shadow are the clips' own.
 *
 * The rig says how much (`tuckState`, 0 … 1, eased here) and how far out a hand may be, in the model's own metres.
 */
export const tuckState = { want: 0, maxSide: 0.38 };

/** A hand never comes closer to the middle than this (the suit's hips are in the way), model metres. */
const MIN_SIDE = 0.24;

const inv = new THREE.Matrix4();
const s = new THREE.Vector3();
const h = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);
const qLocal = new THREE.Quaternion();
const mq = new THREE.Quaternion();
const mqi = new THREE.Quaternion();
const pq = new THREE.Quaternion();
const pqi = new THREE.Quaternion();
const qw = new THREE.Quaternion();

interface Arm {
  arm: THREE.Object3D;
  hand: THREE.Object3D;
  saved: THREE.Quaternion;
  applied: boolean;
}

export class ArmTuck {
  /** How tucked the arms are now, 0 … 1 (eased towards the rig's wish). */
  amount = 0;
  private arms: Arm[] = [];

  constructor(model: THREE.Object3D) {
    for (const side of ['Left', 'Right']) {
      const arm = model.getObjectByName(`${side}Arm`);
      const hand = model.getObjectByName(`${side}Hand`);
      if (arm && hand) this.arms.push({ arm, hand, saved: new THREE.Quaternion(), applied: false });
    }
  }

  /** Before the clips pose the body: undo last frame's turn (a bone a clip does not key would keep turning). */
  restore(): void {
    for (const a of this.arms) {
      if (!a.applied) continue;
      a.arm.quaternion.copy(a.saved);
      a.applied = false;
    }
  }

  /**
   * After the clips: turn the arms in. Returns true while the amount is still easing (keep drawing frames).
   * `want` 0 … 1; `maxSide` how far out to the side a hand may be (model metres).
   */
  apply(model: THREE.Object3D, want: number, dt: number, maxSide: number): boolean {
    const was = this.amount;
    this.amount += (want - this.amount) * Math.min(1, 8 * dt);
    if (Math.abs(want - this.amount) < 0.005) this.amount = want;
    if (this.amount < 0.005) return was !== this.amount;
    const side0 = Math.max(MIN_SIDE, maxSide);
    model.updateMatrixWorld(true);
    inv.copy(model.matrixWorld).invert();
    model.getWorldQuaternion(mq);
    mqi.copy(mq).invert();
    for (const a of this.arms) {
      s.setFromMatrixPosition(a.arm.matrixWorld).applyMatrix4(inv);
      h.setFromMatrixPosition(a.hand.matrixWorld).applyMatrix4(inv);
      const side = Math.sign(h.x) || 1;
      if (h.x * side <= side0) continue;
      // the arm in the body's front plane: outward and down from the shoulder
      const ax = (h.x - s.x) * side;
      const ay = h.y - s.y;
      const len = Math.hypot(ax, ay);
      if (len < 1e-4) continue;
      const phi = Math.atan2(ax, -ay); // 0 = hanging straight down, + = out to the side
      const target = Math.asin(Math.max(-1, Math.min(1, (side0 - s.x * side) / len)));
      const theta = Math.max(0, phi - target) * this.amount;
      if (theta < 1e-4) continue;
      // turn about the body's forward axis through the shoulder, the hand towards the middle
      qLocal.setFromAxisAngle(Z, -side * theta);
      qw.copy(mq).multiply(qLocal).multiply(mqi); // in the world
      const parent = a.arm.parent;
      if (!parent) continue;
      parent.getWorldQuaternion(pq);
      pqi.copy(pq).invert();
      a.saved.copy(a.arm.quaternion);
      a.applied = true;
      a.arm.quaternion.premultiply(qw.premultiply(pqi).multiply(pq)); // in the arm's parent frame
      a.arm.updateMatrixWorld(true);
    }
    return Math.abs(was - this.amount) > 1e-4;
  }
}

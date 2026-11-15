/**
 * The remote: while the robot arm's scanner is on, the astronaut holds a small handheld controller in the right hand
 * (raised in front, a little out to the side so the camera behind sees it). It has a joystick that leans with the
 * arm, two buttons (the gripper's one lights up when it closes) and a small screen with the arm drawn from the side.
 * Drawn in code. The right arm is posed after the animation mixer (src/scene/Astronaut.tsx calls pose()).
 */
import * as THREE from 'three';
import { armState } from './state';

const RAISE_S = 0.4;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const RAD = Math.PI / 180;

/** Right arm pose in the astronaut's space (+Z forward, +X its left, +Y up). Tuned by eye. */
export const HOLD = {
  upperArm: [-0.32, -0.88, 0.35] as const, // shoulder -> elbow: down, out to the right, a little forward
  forearm: [-0.12, 0.3, 0.95] as const, // elbow -> hand: forward and a little up
  out: [-1, 0, 0] as const, // the arm bones' X hint: away from the body
  grip: [0.12, 0.06, 0.07] as const, // the remote's centre from the hand bone (the hand holds its right end)
  tiltDeg: 50, // the face (screen) tilted up towards the eyes / the camera behind
  size: 1.45, // glove-sized: 0.28 m wide
};
const SCREEN_W = 256;
const SCREEN_H = 160;

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const m4 = new THREE.Matrix4();
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const qAnim = new THREE.Quaternion();
const qWant = new THREE.Quaternion();
const qModel = new THREE.Quaternion();
const qTilt = new THREE.Quaternion();
const X_AXIS = new THREE.Vector3(1, 0, 0);
const dUp = new THREE.Vector3();
const dFore = new THREE.Vector3();
const dOut = new THREE.Vector3();

/** Turns `bone` so its +Y points along `yDir` and its +X towards `xHint` (world space). */
function aim(bone: THREE.Object3D, yDir: THREE.Vector3, xHint: THREE.Vector3) {
  const y = v1.copy(yDir).normalize();
  const x = v2.copy(xHint).addScaledVector(y, -xHint.dot(y)).normalize();
  const z = v3.crossVectors(x, y);
  m4.makeBasis(x, y, z);
  qa.setFromRotationMatrix(m4);
  bone.parent!.getWorldQuaternion(qb);
  bone.quaternion.copy(qb.invert().multiply(qa));
}

export class Remote {
  private k = 0;
  private drawT = 0;
  private readonly group = new THREE.Group();
  private readonly stick = new THREE.Group();
  private readonly btnMat = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.4, emissive: 0x000000 });
  private readonly paint: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private readonly shoulder: THREE.Object3D | undefined;
  private readonly elbow: THREE.Object3D | undefined;
  private readonly hand: THREE.Object3D | undefined;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly model: THREE.Object3D,
  ) {
    this.shoulder = model.getObjectByName('RightArm');
    this.elbow = model.getObjectByName('RightForeArm');
    this.hand = model.getObjectByName('RightHand');

    const canvas = document.createElement('canvas');
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    this.paint = canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    // the controller: body along X (0.19 m), face up (+Y), the holder's side towards -Z
    const g = this.group;
    g.name = 'ArmRemote';
    const shell = new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.6, metalness: 0.1 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.5, metalness: 0.4 });
    const mint = new THREE.MeshStandardMaterial({ color: 0x5cc0a5, roughness: 0.4, emissive: 0x1d5a4a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.03, 0.11), shell);
    const gripL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16), shell);
    const gripR = gripL.clone();
    gripL.position.set(-0.095, 0, 0.02);
    gripR.position.set(0.095, 0, 0.02);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.006, 0.062), dark);
    bezel.position.set(0, 0.017, -0.008);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.082, 0.052),
      new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }),
    );
    screen.rotation.set(-Math.PI / 2, 0, Math.PI); // face up; the picture's top away from the holder (+Z)
    screen.position.set(0, 0.0205, -0.008);
    // joystick on the holder's right, under the thumb: base, stick (leans with the arm), knob
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.006, 16), dark);
    base.position.set(-0.07, 0.018, 0.01);
    this.stick.position.set(-0.07, 0.02, 0.01);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.022, 8), dark);
    rod.position.y = 0.011;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), mint);
    knob.position.y = 0.024;
    this.stick.add(rod, knob);
    // two buttons: the gripper's (lights when it closes) and a second one
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 16), this.btnMat);
    b1.position.set(0.068, 0.018, 0.0);
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.006, 16), mint);
    b2.position.set(0.082, 0.018, 0.024);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.05, 6), dark);
    ant.rotation.x = Math.PI / 2 - 0.3;
    ant.position.set(0.075, 0.02, -0.07);
    g.add(body, gripL, gripR, bezel, screen, base, this.stick, b1, b2, ant);
    g.visible = false;
    scene.add(g);
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.texture.dispose();
  }

  /**
   * After the animation mixer: raise or lower the right arm and place the remote. Returns true while it is moving or
   * shown (the scene keeps drawing frames).
   */
  pose(dt: number, on: boolean): boolean {
    const want = on ? 1 : 0;
    const moving = this.k !== want;
    if (moving) this.k = Math.min(1, Math.max(0, this.k + (on ? 1 : -1) * (dt / RAISE_S)));
    this.group.visible = this.k > 0.02 && !!this.hand;
    if (!this.group.visible || !this.hand) return moving;
    const e = ease(this.k);
    this.model.updateMatrixWorld(true);
    this.model.getWorldQuaternion(qModel);
    if (this.shoulder && this.elbow) {
      dUp.set(...HOLD.upperArm).normalize().applyQuaternion(qModel);
      dFore.set(...HOLD.forearm).normalize().applyQuaternion(qModel);
      dOut.set(...HOLD.out).normalize().applyQuaternion(qModel);
      for (const [bone, y] of [
        [this.shoulder, dUp],
        [this.elbow, dFore],
      ] as const) {
        qAnim.copy(bone.quaternion);
        aim(bone, y, dOut);
        qWant.copy(bone.quaternion);
        bone.quaternion.copy(qAnim).slerp(qWant, e);
        bone.updateMatrixWorld(true);
      }
    }
    // the remote in the hand: at the hand bone, turned with the astronaut, face tilted up towards the eyes
    this.hand.getWorldPosition(this.group.position);
    this.group.position.add(v1.set(...HOLD.grip).applyQuaternion(qModel));
    qTilt.setFromAxisAngle(X_AXIS, -HOLD.tiltDeg * RAD);
    this.group.quaternion.copy(qModel).multiply(qTilt);
    this.group.scale.setScalar((0.4 + 0.6 * e) * HOLD.size);

    // joystick leans with the arm (forward = lift, sideways = wrist), the grip button lights when it closes
    const a = armState.shown;
    this.stick.rotation.x = THREE.MathUtils.clamp(a.lift / 75, -1, 1) * 0.45;
    this.stick.rotation.z = THREE.MathUtils.clamp(a.wrist / 95, -1, 1) * -0.4;
    this.btnMat.emissive.setHex(a.open < 0.5 ? 0x7a5a10 : 0x000000);
    if ((this.drawT -= dt) <= 0) {
      this.drawT = 0.1;
      this.drawScreen();
    }
    return true;
  }

  /** The screen: the robot arm from the side (pedestal, upper arm, forearm, turret, jaws) and its numbers. */
  private drawScreen(): void {
    const c = this.paint;
    const a = armState.shown;
    c.fillStyle = '#0d1c3c';
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    c.strokeStyle = 'rgba(92,192,165,0.35)';
    c.lineWidth = 1;
    for (let x = 0; x <= SCREEN_W; x += 32) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, SCREEN_H);
      c.stroke();
    }
    for (let y = 0; y <= SCREEN_H; y += 32) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(SCREEN_W, y);
      c.stroke();
    }
    // ground and pedestal (22 px per metre)
    const gx = 62;
    const gy = 138;
    const s = 22;
    c.fillStyle = '#5cc0a5';
    c.fillRect(10, gy, 160, 3);
    c.fillStyle = '#e6e3dc';
    c.fillRect(gx - 5, gy - s, 10, s);
    // upper arm, forearm, turret (screen y up = minus)
    const l1 = a.lift * RAD;
    const l2 = (a.lift + a.bend) * RAD;
    const l3 = (a.lift + a.bend + a.wrist) * RAD;
    const sx = gx;
    const sy = gy - s;
    const ex = sx + Math.cos(l1) * 1.46 * s;
    const ey = sy - Math.sin(l1) * 1.46 * s;
    const wx = ex + Math.cos(l2) * 1.41 * s;
    const wy = ey - Math.sin(l2) * 1.41 * s;
    const tx = wx + Math.cos(l3) * 0.9 * s;
    const ty = wy - Math.sin(l3) * 0.9 * s;
    c.lineCap = 'round';
    c.strokeStyle = '#ffffff';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(ex, ey);
    c.lineTo(wx, wy);
    c.stroke();
    c.strokeStyle = '#9fd8c8';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(wx, wy);
    c.lineTo(tx, ty);
    c.stroke();
    const j = (a.open * 32 + 4) * RAD;
    c.strokeStyle = '#ffd166';
    c.lineWidth = 4;
    for (const sgn of [1, -1]) {
      const ang = l3 + sgn * j;
      c.beginPath();
      c.moveTo(tx, ty);
      c.lineTo(tx + Math.cos(ang) * 14, ty - Math.sin(ang) * 14);
      c.stroke();
    }
    c.fillStyle = '#ffd166';
    for (const [x, y] of [
      [sx, sy],
      [ex, ey],
      [wx, wy],
    ]) {
      c.beginPath();
      c.arc(x, y, 4.5, 0, Math.PI * 2);
      c.fill();
    }
    // numbers on the right: lift, elbow, wrist, grip (degrees and two universal words, drawn into the 3D screen)
    c.fillStyle = '#ffffff';
    c.font = 'bold 20px system-ui, sans-serif';
    c.fillText(`${Math.round(a.lift)}°`, 182, 34);
    c.fillText(`${Math.round(a.bend)}°`, 182, 64);
    c.fillText(`${Math.round(a.wrist)}°`, 182, 94);
    c.fillStyle = a.open < 0.5 ? '#ffd166' : '#5cc0a5';
    c.fillRect(182, 110, 60, 24);
    c.fillStyle = '#0d1c3c';
    c.beginPath();
    // the grip state as a shape, not a word: two bars together (closed) or apart (open)
    const gap = a.open < 0.5 ? 2 : 12;
    c.fillRect(212 - gap / 2 - 6, 114, 6, 16);
    c.fillRect(212 + gap / 2, 114, 6, 16);
    this.texture.needsUpdate = true;
  }
}

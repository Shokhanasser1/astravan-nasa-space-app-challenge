import * as THREE from 'three';
import { t, type Lang } from '../../i18n/t';
import { load } from '../../lib/storage';

/**
 * The suit tablet on the kid astronaut's left forearm (15 Nov, Shoxjahon aka: "a tablet on the arm, this time only
 * for the suit: oxygen, radiation, whether it is intact; the hologram's background like the reference sheet").
 * - The tablet: a small slab strapped on top of the forearm (the LeftForeArm bone), its screen three bars.
 * - The hologram: standing still a moment, the astronaut checks the wrist (the model's Wrist clip) and a panel of
 *   light rises above the tablet, drawn like the "Interface menu" reference: corners cut on a diagonal, a lit tab,
 *   three status dots, a grid, a hatched square; it turns to the camera and fades out as soon as the astronaut moves.
 * Every number comes from the View (the engine): oxygen = the base's air and water reserve the suit is filled from
 * (game rule), radiation = today's measured dose ratio and level (LRO CRaTER), the seal = intact (nothing in the game
 * damages a suit; no invented percentage). Text through t() keys (scene.suit.*). Canvases are redrawn only when the
 * numbers or the language change; the scene asks for frames only while the hologram fades.
 */
/** known: false on an alert day before it is lived (the HUD shows "?"; 15 Nov playtest: the suit said "Quiet"). */
export type SuitData = { air: number; airMax: number; level: number; ratio: number | undefined; known?: boolean };

const CYAN = '#5ee0ff';
const CYAN_HI = '#a6eeff';
const MINT = '#5fe0c0';
const AMBER = '#ffc23d';
const PERI = '#8fb3ff';

/** The panel of the reference sheet: cut corners (top-left, bottom-right), tab, dots, grid, hatched square. */
function hudFrame(g: CanvasRenderingContext2D, w: number, h: number, cut: number, alpha: number) {
  const path = () => {
    g.beginPath();
    g.moveTo(cut, 1);
    g.lineTo(w - 1, 1);
    g.lineTo(w - 1, h - cut);
    g.lineTo(w - cut, h - 1);
    g.lineTo(1, h - 1);
    g.lineTo(1, cut);
    g.closePath();
  };
  // glass
  path();
  const fill = g.createLinearGradient(0, 0, 0, h);
  fill.addColorStop(0, `rgba(16, 52, 104, ${0.8 * alpha})`);
  fill.addColorStop(1, `rgba(5, 18, 46, ${0.86 * alpha})`);
  g.fillStyle = fill;
  g.fill();
  // grid
  g.save();
  path();
  g.clip();
  g.strokeStyle = 'rgba(94, 224, 255, 0.10)';
  g.lineWidth = 1;
  const step = Math.round(h / 12);
  for (let x = step; x < w; x += step) {
    g.beginPath();
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, h);
    g.stroke();
  }
  for (let y = step; y < h; y += step) {
    g.beginPath();
    g.moveTo(0, y + 0.5);
    g.lineTo(w, y + 0.5);
    g.stroke();
  }
  g.restore();
  // frame
  path();
  g.strokeStyle = CYAN;
  g.lineWidth = 2;
  g.shadowColor = CYAN;
  g.shadowBlur = 8;
  g.stroke();
  g.shadowBlur = 0;
  // lit tab on the top edge, a mark on the bottom edge
  g.fillStyle = CYAN_HI;
  g.fillRect(cut + 10, 0, w * 0.22, 5);
  g.fillStyle = PERI;
  g.fillRect(12, h - 4, w * 0.1, 3);
  // three status dots, top right
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.arc(w - 18 - i * 14, 14, 3.4, 0, Math.PI * 2);
    g.fillStyle = i === 2 ? 'rgba(94, 224, 255, 0.4)' : CYAN;
    g.fill();
  }
  // hatched square, bottom right
  const s = Math.round(h * 0.13), x0 = w - cut - s - 10, y0 = h - s - 10;
  g.fillStyle = 'rgba(94, 224, 255, 0.5)';
  for (let y = 0; y < s; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < s; x += 4) g.fillRect(x0 + x, y0 + y, 2, 2);
}

/** One row: a short name, the value, a bar (fraction 0..1, colour), the data mark. */
function row(g: CanvasRenderingContext2D, x: number, y: number, w: number, name: string, value: string, frac: number, tone: string, mark: string) {
  g.fillStyle = '#eef3ff';
  g.font = '600 28px "Lexend Variable", Lexend, system-ui, sans-serif';
  g.textBaseline = 'alphabetic';
  g.fillText(name, x, y);
  g.fillStyle = tone;
  g.font = '800 31px "Lexend Variable", Lexend, system-ui, sans-serif';
  const vw = g.measureText(value).width;
  g.fillText(value, x + w - vw, y);
  // bar: segments, like the reference's gauges
  const by = y + 12, segs = 20, gap = 3, sw = (w - gap * (segs - 1)) / segs;
  for (let i = 0; i < segs; i++) {
    g.fillStyle = i < Math.round(frac * segs) ? tone : 'rgba(94, 224, 255, 0.14)';
    g.fillRect(x + i * (sw + gap), by, sw, 10);
  }
  g.fillStyle = 'rgba(185, 198, 234, 0.85)';
  g.font = '600 15px "Lexend Variable", Lexend, system-ui, sans-serif';
  g.fillText(mark.toUpperCase(), x, by + 30);
}

/** The slab (m): width across the forearm, thickness, length along it; centre at `at` of the forearm; room above the sleeve. */
const SLAB = { w: 0.08, t: 0.012, l: 0.1, at: 0.62, room: 0.007 };

/**
 * How far the sleeve's top stands above the forearm bone's axis under the slab (m, the bind pose, arms out): the
 * highest skinned vertex over that stretch of the forearm. 0.08 m if the mesh cannot be read.
 */
function sleeveTop(model: THREE.Object3D, bone: THREE.Object3D, hand: THREE.Object3D | null, at: number, span: number): number {
  if (!hand) return 0.08;
  let mesh: THREE.SkinnedMesh | null = null;
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!mesh && m.isSkinnedMesh && m.skeleton?.bones.includes(bone as THREE.Bone)) mesh = m;
  });
  if (!mesh) return 0.08;
  const sm = mesh as THREE.SkinnedMesh;
  const a = bone.getWorldPosition(new THREE.Vector3());
  const axis = hand.getWorldPosition(new THREE.Vector3()).sub(a);
  const len = axis.length();
  axis.normalize();
  const pos = sm.geometry.attributes.position;
  const v = new THREE.Vector3();
  let top = 0;
  for (let i = 0; i < pos.count; i++) {
    sm.getVertexPosition(i, v).applyMatrix4(sm.matrixWorld).sub(a);
    const t = v.dot(axis) / len;
    if (t < at - span / 2 - 0.05 || t > at + span / 2 + 0.05) continue;
    v.addScaledVector(axis, -v.dot(axis));
    if (v.length() > 0.2) continue; // (the body, not the arm)
    top = Math.max(top, v.y);
  }
  return top > 0.02 ? top : 0.08;
}

function texture(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// big enough to read from the follow camera (~5 m behind): about a sixth of a laptop screen wide
const HOLO_W = 1.15; // m
const HOLO_H = 0.8;

export class WristTablet {
  readonly tablet = new THREE.Group();
  readonly holo: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private bone: THREE.Object3D | null;
  private screen = document.createElement('canvas');
  private board = document.createElement('canvas');
  private screenTex: THREE.CanvasTexture;
  private boardTex: THREE.CanvasTexture;
  private key = '';
  private show = 0;
  private v = new THREE.Vector3();
  private right = new THREE.Vector3();
  private toCam = new THREE.Vector3();

  constructor(model: THREE.Object3D) {
    this.bone = model.getObjectByName('LeftForeArm') ?? null;
    this.screen.width = 256;
    this.screen.height = 160;
    this.board.width = 512;
    this.board.height = 356;
    this.screenTex = texture(this.screen);
    this.boardTex = texture(this.board);

    // the slab: sizes in metres, turned into the bone's own units and axes (measured in the bind pose: the arms out)
    const bone = this.bone;
    if (bone) {
      model.updateMatrixWorld(true);
      const q = bone.getWorldQuaternion(new THREE.Quaternion());
      const s = bone.getWorldScale(new THREE.Vector3()).x || 1;
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q.clone().invert()); // the top of the forearm, bone space
      const hand = bone.children.find((c) => /Hand/.test(c.name));
      const along = hand ? hand.position.clone().normalize() : new THREE.Vector3(0, 1, 0);
      const len = hand ? hand.position.length() * s : 0.25;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(SLAB.w, SLAB.t, SLAB.l),
        new THREE.MeshStandardMaterial({ color: '#2a3550', roughness: 0.55, metalness: 0.5 }),
      );
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(SLAB.w - 0.01, SLAB.l - 0.012).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false }),
      );
      face.position.y = SLAB.t / 2 + 0.0005;
      body.castShadow = true;
      this.tablet.add(body, face);
      // the slab's +Y = the forearm's top, its +Z = along the forearm (towards the hand); 60 % down the forearm
      const z = along.clone();
      const y = up.clone().addScaledVector(z, -up.dot(z)).normalize();
      const x = new THREE.Vector3().crossVectors(y, z).normalize();
      this.tablet.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      // on the sleeve, not in it: the sleeve's own top under the slab (measured on the mesh) + half the slab + room
      // for the cloth to swell when the elbow bends (15 Nov: the slab sank ~2.5 cm into the kid suit's thick sleeve and
      // flickered through it as the arm moved)
      const lift = sleeveTop(model, bone, hand ?? null, SLAB.at, SLAB.l / len) + SLAB.t / 2 + SLAB.room;
      this.tablet.position.copy(along).multiplyScalar((len * SLAB.at) / s).addScaledVector(y, lift / s);
      this.tablet.scale.setScalar(1 / s);
      this.tablet.name = 'suit_tablet';
      // (strapped on in attach(): from an effect, so React StrictMode's extra mount leaves no second slab)
    }

    this.holo = new THREE.Mesh(
      new THREE.PlaneGeometry(HOLO_W, HOLO_H),
      new THREE.MeshBasicMaterial({
        map: this.boardTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.NormalBlending, // dark glass like the reference, readable over the bright ground
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    );
    this.holo.name = 'suit_hologram';
    this.holo.visible = false;
    this.holo.renderOrder = 10;
  }

  attach(scene: THREE.Object3D) {
    this.bone?.add(this.tablet);
    scene.add(this.holo);
  }

  dispose() {
    this.holo.removeFromParent();
    this.tablet.removeFromParent();
    this.holo.geometry.dispose();
    this.holo.material.dispose();
    this.screenTex.dispose();
    this.boardTex.dispose();
    this.tablet.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
  }

  /** New numbers (from the View): redraw both screens only when something shown has changed. */
  setData(d: SuitData) {
    const lang = load<Lang>('lang', 'en');
    const known = d.known !== false;
    const key = `${lang}|${d.air}|${d.airMax}|${d.level}|${d.ratio ?? ''}|${known}`;
    if (key === this.key) return false;
    this.key = key;
    const tr = (k: string, vars?: Record<string, string | number>) => t(lang, k, vars);
    const radTone = d.level > 0 || !known ? AMBER : CYAN;
    const airFrac = d.airMax > 0 ? Math.max(0, Math.min(1, d.air / d.airMax)) : 0;
    const radFrac = Math.max(0.05, Math.min(1, d.level / 4));

    // the tablet's own small screen: three bars
    const s = this.screen.getContext('2d')!;
    s.clearRect(0, 0, 256, 160);
    s.fillStyle = '#04122a';
    s.fillRect(0, 0, 256, 160);
    s.strokeStyle = CYAN;
    s.lineWidth = 4;
    s.strokeRect(4, 4, 248, 152);
    // (signs drawn, not typed: no emoji; O₂, a radiation trefoil, a tick)
    const bars: [string, number, string][] = [['o2', airFrac, CYAN], ['rad', radFrac, radTone], ['ok', 1, MINT]];
    bars.forEach(([name, frac, tone], i) => {
      const y = 22 + i * 46;
      s.fillStyle = '#eef3ff';
      s.strokeStyle = '#eef3ff';
      s.font = '700 26px system-ui, sans-serif';
      if (name === 'o2') s.fillText('O₂', 16, y + 22);
      else if (name === 'rad') {
        for (let k = 0; k < 3; k++) {
          const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
          s.beginPath();
          s.moveTo(36, y + 14);
          s.arc(36, y + 14, 14, a - 0.5, a + 0.5);
          s.closePath();
          s.fill();
        }
      } else {
        s.lineWidth = 5;
        s.beginPath();
        s.moveTo(22, y + 14);
        s.lineTo(32, y + 24);
        s.lineTo(50, y + 4);
        s.stroke();
      }
      s.fillStyle = 'rgba(94, 224, 255, 0.18)';
      s.fillRect(70, y + 4, 168, 22);
      s.fillStyle = tone;
      s.fillRect(70, y + 4, 168 * frac, 22);
    });
    this.screenTex.needsUpdate = true;

    // the hologram: the reference's panel with the three rows
    const g = this.board.getContext('2d')!;
    const W = this.board.width, H = this.board.height;
    g.clearRect(0, 0, W, H);
    hudFrame(g, W, H, 34, 1);
    g.fillStyle = CYAN_HI;
    g.font = '800 22px "Lexend Variable", Lexend, system-ui, sans-serif';
    g.fillText(tr('scene.suit.title').toUpperCase(), 44, 50);
    const x = 36, w = W - 72;
    row(g, x, 106, w, `O₂ · ${tr('scene.suit.o2')}`, tr('scene.suit.o2Value', { n: d.air, max: d.airMax }), airFrac, CYAN, tr('ui.label.rule'));
    const rad = !known
      ? `? · ${tr('ui.level.unknown')}`
      : d.ratio !== undefined && d.level > 0
        ? `${tr(`ui.level.${d.level}`)} · ${d.ratio.toFixed(1)}×`
        : tr(`ui.level.${d.level}`);
    row(g, x, 196, w, tr('scene.suit.rad'), rad, known ? radFrac : 0.05, radTone, tr('ui.label.measured'));
    row(g, x, 286, w, tr('scene.suit.seal'), tr('scene.suit.sealOk'), 1, MINT, tr('ui.label.rule'));
    this.boardTex.needsUpdate = true;
    return true;
  }

  /**
   * Each frame: fade the hologram towards `want` and keep it above the tablet, turned to the camera.
   * True while it is still fading (the scene keeps drawing).
   */
  update(dt: number, camera: THREE.Camera, want: boolean, body: { x: number; y: number; z: number }): boolean {
    const target = want ? 1 : 0;
    const before = this.show;
    this.show += Math.sign(target - this.show) * Math.min(Math.abs(target - this.show), dt / 0.35);
    const m = this.holo.material;
    m.opacity = this.show * 0.95;
    this.holo.visible = this.show > 0.01;
    if (this.holo.visible) {
      // beside the astronaut on the screen's left, at head height, a little towards the camera (not over the body)
      this.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      this.toCam.set(0, 0, 1).applyQuaternion(camera.quaternion);
      // (a narrow, upright screen has no room beside: above the head instead)
      const narrow = ((camera as THREE.PerspectiveCamera).aspect ?? 1.5) < 1;
      this.v.set(body.x, body.y + (narrow ? 2.05 : 1.3), body.z).addScaledVector(this.right, narrow ? 0 : -1.05).addScaledVector(this.toCam, 0.35);
      this.holo.position.copy(this.v);
      this.holo.quaternion.copy(camera.quaternion);
      const k = 0.85 + 0.15 * this.show; // rises and grows a little as it appears
      this.holo.scale.setScalar(k);
    }
    return this.show !== before;
  }
}

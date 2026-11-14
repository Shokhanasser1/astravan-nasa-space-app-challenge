// Oy karvonsaroyi — boshqaruv: klaviatura, sichqoncha (pointer lock yoki sudrash), sensorli joystik.
// Natija: input.controls() -> { fwd, right, run, jump, use, pour } va kamera burchaklari yaw/pitch/dist.

const KEYS = {
  fwd: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  pour: ['KeyF'],
};
const EDGE = { Space: 'jump', KeyE: 'use', KeyG: 'gravity', KeyC: 'debug', KeyH: 'help', KeyR: 'respawn' };
const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  constructor(canvas, ui = {}) {
    this.canvas = canvas;
    this.ui = ui;
    this.down = new Set();
    this.edges = new Set();
    this.yaw = 0;
    this.pitch = 0.32;
    this.dist = 4.6;
    this.sens = 0.0024;
    this.touchSens = 0.006;
    this.stick = { x: 0, y: 0, id: null };
    this.runToggle = false;
    this.pourHeld = false;
    this.touchMode = matchMedia('(pointer: coarse)').matches;
    this.locked = false;
    this.drag = null;
    this._bindKeys();
    this._bindMouse();
    this._bindTouch();
    this.setTouchMode(this.touchMode);
  }

  // ------------------------------------------------------------ keyboard
  _bindKeys() {
    addEventListener('keydown', (e) => {
      if (BLOCK.has(e.code)) e.preventDefault();
      if (!e.repeat && EDGE[e.code]) this.edges.add(EDGE[e.code]);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => { this.down.clear(); this.stick.x = this.stick.y = 0; this.pourHeld = false; });
  }

  _any(list) {
    return list.some((c) => this.down.has(c));
  }

  // ------------------------------------------------------------ mouse: pointer lock, or drag when lock is refused
  _bindMouse() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.drag = { x: e.clientX, y: e.clientY };
      if (!this.locked && c.requestPointerLock) {
        try {
          const p = c.requestPointerLock();
          if (p && p.catch) p.catch(() => {});
        } catch (_) { /* drag mode */ }
      }
    });
    addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') this.drag = null; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === c;
      if (this.ui.onLock) this.ui.onLock(this.locked);
    });
    addEventListener('mousemove', (e) => {
      if (this.locked) {
        this._orbit(e.movementX, e.movementY, this.sens);
      } else if (this.drag) {
        this._orbit(e.clientX - this.drag.x, e.clientY - this.drag.y, this.sens * 1.4);
        this.drag = { x: e.clientX, y: e.clientY };
      }
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.dist = Math.min(9, Math.max(1.8, this.dist * (e.deltaY > 0 ? 1.1 : 1 / 1.1)));
    }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _orbit(dx, dy, k) {
    this.yaw -= dx * k;
    this.pitch = Math.min(1.25, Math.max(-0.3, this.pitch + dy * k));
  }

  // ------------------------------------------------------------ touch: left joystick, right side = look, buttons
  _bindTouch() {
    const c = this.canvas;
    const looks = new Map();
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      this.setTouchMode(true);
      looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { c.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    c.addEventListener('pointermove', (e) => {
      const p = looks.get(e.pointerId);
      if (!p) return;
      this._orbit(e.clientX - p.x, e.clientY - p.y, this.touchSens);
      p.x = e.clientX; p.y = e.clientY;
    });
    const endLook = (e) => looks.delete(e.pointerId);
    c.addEventListener('pointerup', endLook);
    c.addEventListener('pointercancel', endLook);

    const { stick, knob, btnJump, btnUse, btnRun, btnPour } = this.ui;
    if (stick && knob) {
      const R = 52;
      const move = (e) => {
        const r = stick.getBoundingClientRect();
        let x = (e.clientX - (r.left + r.width / 2)) / R;
        let y = (e.clientY - (r.top + r.height / 2)) / R;
        const m = Math.hypot(x, y);
        if (m > 1) { x /= m; y /= m; }
        this.stick.x = x; this.stick.y = y;
        knob.style.transform = `translate(${x * R}px, ${y * R}px)`;
      };
      stick.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.setTouchMode(true);
        this.stick.id = e.pointerId;
        try { stick.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        move(e);
      });
      stick.addEventListener('pointermove', (e) => { if (e.pointerId === this.stick.id) move(e); });
      const end = (e) => {
        if (e.pointerId !== this.stick.id) return;
        this.stick = { x: 0, y: 0, id: null };
        knob.style.transform = '';
      };
      stick.addEventListener('pointerup', end);
      stick.addEventListener('pointercancel', end);
    }
    const tap = (el, fn) => el && el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.setTouchMode(true); fn(); });
    tap(btnJump, () => this.edges.add('jump'));
    tap(btnUse, () => this.edges.add('use'));
    tap(btnRun, () => {
      this.runToggle = !this.runToggle;
      btnRun.classList.toggle('on', this.runToggle);
    });
    if (btnPour) {
      tap(btnPour, () => { this.pourHeld = true; btnPour.classList.add('on'); });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
        btnPour.addEventListener(ev, () => { this.pourHeld = false; btnPour.classList.remove('on'); });
      }
    }
  }

  setTouchMode(on) {
    this.touchMode = on;
    document.body.classList.toggle('touch', on);
  }

  /** Was this one-shot action pressed since the last call? */
  consume(name) {
    const had = this.edges.has(name);
    this.edges.delete(name);
    return had;
  }

  controls() {
    let fwd = (this._any(KEYS.fwd) ? 1 : 0) - (this._any(KEYS.back) ? 1 : 0);
    let right = (this._any(KEYS.right) ? 1 : 0) - (this._any(KEYS.left) ? 1 : 0);
    if (this.stick.id !== null) {
      fwd += -this.stick.y;
      right += this.stick.x;
    }
    return {
      fwd: Math.max(-1, Math.min(1, fwd)),
      right: Math.max(-1, Math.min(1, right)),
      run: this._any(KEYS.run) || this.runToggle,
      pour: this._any(KEYS.pour) || this.pourHeld,
      jump: this.consume('jump'),
      use: this.consume('use'),
      camYaw: this.yaw,
    };
  }
}

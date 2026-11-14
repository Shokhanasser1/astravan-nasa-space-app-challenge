// Oy karvonsaroyi — 3D demo fizikasi (kutubxonasiz, DOM'siz; Node'da ham test qilinadi).
// Birliklar: metr, sekund, kilogramm. Y yuqoriga (Three.js / glTF).
//
// Manbalar:
//  - Tortishish: NASA NSSDC Planetary Fact Sheets  https://nssdc.gsfc.nasa.gov/planetary/factsheet/
//      Oy 1.62, Yer 9.81 (9.80), Mars 3.71 m/s²
//  - EMU skafandr massasi 145 kg (ryukzak + SAFER bilan):
//      https://www.nasa.gov/wp-content/uploads/2015/07/2019_07_ea_emu.pdf
//  - Sumka (CTB): 42.5 × 50.2 × 23.5 sm, 27 kg gacha (STS-92 press kit):
//      https://www.nasa.gov/wp-content/uploads/2023/05/sts-092-press-kit.pdf
//  - Odam massasi 75 kg, tezliklar, tezlanish, sakrash tezligi — O'YIN TANLOVI (taxmin).

export const GRAVITY = { moon: 1.62, earth: 9.81, mars: 3.71 };
export const GRAVITY_NAMES = {
  moon: { uz: 'Oy', en: 'Moon' },
  earth: { uz: 'Yer', en: 'Earth' },
  mars: { uz: 'Mars', en: 'Mars' },
};

export const BODY = {
  personKg: 75,        // o'yin tanlovi: kattalar astronavti
  suitKg: 145,         // NASA EMU fact sheet
  bagKgDefault: 27,    // CTB maksimal yuki (STS-92 press kit); manifest mass_kg bo'lsa o'sha
  radius: 0.38,        // kapsula radiusi (PLSS ryukzak bilan), m
  height: 1.85,        // kapsula balandligi, m
};

export const MOVE = {
  walk: 1.4,           // m/s, o'yin tanlovi
  run: 3.2,            // m/s, o'yin tanlovi (Oyda "kenguru sakrashi")
  jumpV0: 1.2,         // m/s, oyoqlar bergan tik tezlik (Yer va Oyda bir xil)
  accelPerG: 1.5,      // yerdagi tezlanish = 1.5·g (ishqalanish og'irlikka bog'liq) ...
  accelMin: 2.5,       // ... lekin kamida 2.5 m/s² (o'yin qulay bo'lishi uchun)
  accelMax: 14,
  airControl: 0.25,    // havoda boshqaruv ulushi
  stepUp: 0.35,        // shuncha balandlikka "qadam bilan" chiqadi, m
  groundSnap: 0.06,    // pastga qiyalikda yerga yopishish, m
  windup: 0.15,        // sakrashdan oldin cho'kish vaqti, s
  coyote: 0.1,         // yerdan chiqqach ham sakrash mumkin bo'lgan vaqt, s
};

// ---------------------------------------------------------------- formulas (kids see these numbers)
export function totalMass(bagKg = 0) {
  return BODY.personKg + BODY.suitKg + (bagKg || 0);
}
/** speed factor while carrying: same push force, more mass -> M / (M + m) */
export function carryFactor(bagKg = 0) {
  const M = totalMass(0);
  return M / (M + (bagKg || 0));
}
/** jump take-off speed: same leg work (energy) -> v0 * sqrt(M / (M + m)) */
export function jumpSpeed(bagKg = 0) {
  return MOVE.jumpV0 * Math.sqrt(carryFactor(bagKg));
}
/** h = v² / (2g) */
export function jumpHeight(v, g) {
  return (v * v) / (2 * g);
}
/** time in the air t = 2v / g */
export function airTime(v, g) {
  return (2 * v) / g;
}
export function groundAccel(g) {
  return Math.min(MOVE.accelMax, Math.max(MOVE.accelMin, MOVE.accelPerG * g));
}
/** weight in newtons F = m·g */
export function weightN(massKg, g) {
  return massKg * g;
}

// ---------------------------------------------------------------- tiny vector helpers (arrays [x,y,z])
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.sqrt(dot(a, a));
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

/**
 * Oriented box: { c:[x,y,z] centre, u:[[ax],[ay],[az]] unit axes, e:[hx,hy,hz] half sizes, name }
 * Build it in the engine from a mesh's local bounding box + world matrix.
 */
export function makeOBB(center, axes, half, name = '') {
  return { c: center, u: axes, e: half, name, enabled: true };
}

function closestPointOBB(p, b) {
  const d = sub(p, b.c);
  let q = b.c.slice();
  for (let i = 0; i < 3; i++) {
    const t = clamp(dot(d, b.u[i]), -b.e[i], b.e[i]);
    q = add(q, mul(b.u[i], t));
  }
  return q;
}

function closestPointSegment(p, a, b) {
  const ab = sub(b, a);
  const t = clamp(dot(sub(p, a), ab) / Math.max(dot(ab, ab), 1e-9), 0, 1);
  return add(a, mul(ab, t));
}

/**
 * Capsule (vertical segment a..b, radius r) vs OBB.
 * Returns null or { n:[...] push normal, depth } — move the capsule by n*depth.
 */
export function capsuleVsOBB(a, b, r, box) {
  let p = closestPointSegment(box.c, a, b);
  let q = closestPointOBB(p, box);
  for (let k = 0; k < 3; k++) {
    p = closestPointSegment(q, a, b);
    q = closestPointOBB(p, box);
  }
  const v = sub(p, q);
  const d = len(v);
  if (d > 1e-6) {
    if (d >= r) return null;
    return { n: mul(v, 1 / d), depth: r - d };
  }
  // segment point is inside the box: leave through the closest face
  const lp = sub(p, box.c);
  let best = null;
  for (let i = 0; i < 3; i++) {
    const s = dot(lp, box.u[i]);
    const pen = box.e[i] - Math.abs(s) + r;
    if (!best || pen < best.depth) best = { n: mul(box.u[i], s >= 0 ? 1 : -1), depth: pen };
  }
  return best;
}

// ---------------------------------------------------------------- the player body
export class PlayerBody {
  constructor(pos = [0, 0, 0]) {
    this.pos = pos.slice();       // feet position
    this.vel = [0, 0, 0];
    this.onGround = false;
    this.sinceGround = 0;
    this.windup = -1;             // >=0 while crouching before take-off
    this.jumpQueued = false;
    this.bagKg = 0;               // carried mass
    this.lastJumpV = 0;
    this.maxHeightThisJump = 0;
    this.jumpStartY = 0;
  }

  /**
   * One fixed physics step.
   * input: { x, z (desired direction, |dir|<=1, world XZ), run:bool, jump:bool (pressed this frame) }
   * world: { g, groundHeight(x, z, fromY) -> number|null, colliders: OBB[], bounds?: number }
   */
  step(dt, input, world) {
    const g = world.g;
    const k = carryFactor(this.bagKg);
    const vmax = (input.run ? MOVE.run : MOVE.walk) * k;
    const mag = Math.min(1, Math.hypot(input.x, input.z));
    const want = mag > 1e-3 ? [input.x / Math.max(mag, 1e-6) * vmax * mag, input.z / Math.max(mag, 1e-6) * vmax * mag] : [0, 0];

    // horizontal: accelerate toward the wanted velocity, limited by traction (∝ g) and mass
    const aMax = groundAccel(g) * k * (this.onGround ? 1 : MOVE.airControl);
    const dvx = want[0] - this.vel[0];
    const dvz = want[1] - this.vel[2];
    const dv = Math.hypot(dvx, dvz);
    const lim = aMax * dt;
    if (dv > lim) {
      this.vel[0] += (dvx / dv) * lim;
      this.vel[2] += (dvz / dv) * lim;
    } else {
      this.vel[0] = want[0];
      this.vel[2] = want[1];
    }

    // jump: short crouch (wind-up), then take-off speed from leg work
    if (input.jump) this.jumpQueued = true;
    if (this.jumpQueued && this.windup < 0 && (this.onGround || this.sinceGround < MOVE.coyote)) {
      this.windup = 0;
      this.jumpQueued = false;
    } else if (this.jumpQueued && !this.onGround && this.sinceGround >= MOVE.coyote) {
      this.jumpQueued = false;
    }
    let tookOff = false;
    if (this.windup >= 0) {
      this.windup += dt;
      if (this.windup >= MOVE.windup) {
        this.windup = -1;
        this.lastJumpV = jumpSpeed(this.bagKg);
        this.vel[1] = this.lastJumpV;
        this.onGround = false;
        this.sinceGround = MOVE.coyote;
        this.jumpStartY = this.pos[1];
        this.maxHeightThisJump = 0;
        tookOff = true;
      }
    }

    // gravity + integrate (average of old/new vertical speed = exact parabola for constant g)
    const vy0 = this.vel[1];
    if (!this.onGround) this.vel[1] -= g * dt;
    this.pos = add(this.pos, mul(this.vel, dt));
    this.pos[1] += 0.5 * (vy0 - this.vel[1]) * dt;

    // collisions against boxes (capsule = segment from r to h-r above the feet)
    const r = BODY.radius;
    let landedOnBox = false;
    for (let it = 0; it < 2; it++) {
      for (const box of world.colliders) {
        if (!box.enabled) continue;
        const a = [this.pos[0], this.pos[1] + r, this.pos[2]];
        const b = [this.pos[0], this.pos[1] + BODY.height - r, this.pos[2]];
        const hit = capsuleVsOBB(a, b, r, box);
        if (!hit) continue;
        this.pos = add(this.pos, mul(hit.n, hit.depth));
        const vn = dot(this.vel, hit.n);
        if (vn < 0) this.vel = sub(this.vel, mul(hit.n, vn));
        if (hit.n[1] > 0.6) landedOnBox = true;
      }
    }

    // ground
    const gy = world.groundHeight(this.pos[0], this.pos[2], this.pos[1] + MOVE.stepUp + 0.05);
    let grounded = false;
    if (gy !== null && gy !== undefined) {
      if (this.pos[1] <= gy + 1e-4 && !tookOff) {
        this.pos[1] = gy;
        grounded = true;
      } else if (this.onGround && this.vel[1] <= 0 && this.pos[1] - gy < MOVE.groundSnap && !tookOff) {
        this.pos[1] = gy;  // stick to gentle downhill slopes
        grounded = true;
      }
    }
    if (landedOnBox && this.vel[1] <= 0.01) grounded = true;
    if (grounded) {
      if (this.vel[1] < 0) this.vel[1] = 0;
      this.onGround = true;
      this.sinceGround = 0;
    } else {
      this.onGround = false;
      this.sinceGround += dt;
      this.maxHeightThisJump = Math.max(this.maxHeightThisJump, this.pos[1] - this.jumpStartY);
    }

    // soft world bounds
    if (world.bounds) {
      this.pos[0] = clamp(this.pos[0], -world.bounds, world.bounds);
      this.pos[2] = clamp(this.pos[2], -world.bounds, world.bounds);
    }
    return { tookOff };
  }

  horizontalSpeed() {
    return Math.hypot(this.vel[0], this.vel[2]);
  }
}

// ---------------------------------------------------------------- queries used by the camera and bag logic
/** Is point p inside the OBB (optionally grown by `pad` metres)? */
export function pointInOBB(p, box, pad = 0) {
  const d = sub(p, box.c);
  for (let i = 0; i < 3; i++) if (Math.abs(dot(d, box.u[i])) > box.e[i] + pad) return false;
  return true;
}

/**
 * Ray (origin o, unit direction d) vs OBB, slab test.
 * Returns the entry distance t >= 0, or null (miss, or the origin is already inside the box).
 */
export function rayVsOBB(o, d, box) {
  const p = sub(box.c, o);
  let tmin = -Infinity, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const e = dot(box.u[i], p);
    const f = dot(box.u[i], d);
    if (Math.abs(f) > 1e-9) {
      let t1 = (e + box.e[i]) / f, t2 = (e - box.e[i]) / f;
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax || tmax < 0) return null;
    } else if (-e - box.e[i] > 0 || -e + box.e[i] < 0) {
      return null;
    }
  }
  return tmin >= 0 ? tmin : null;
}

// ---------------------------------------------------------------- numbers for the HUD
/**
 * Everything the HUD shows, from the carried mass and the gravity.
 * Same take-off speed everywhere, so the jump is g_earth / g times higher (Moon: 9.81 / 1.62 ≈ 6.06×).
 */
export function readout(bagKg = 0, g = GRAVITY.moon, gEarth = GRAVITY.earth) {
  const total = totalMass(bagKg);
  const factor = carryFactor(bagKg);
  const v0 = jumpSpeed(bagKg);
  return {
    personKg: BODY.personKg,
    suitKg: BODY.suitKg,
    bagKg: bagKg || 0,
    totalKg: total,
    factor,
    walk: MOVE.walk * factor,
    run: MOVE.run * factor,
    v0,
    jumpH: jumpHeight(v0, g),
    jumpHEarth: jumpHeight(v0, gEarth),
    ratio: gEarth / g,
    airTime: airTime(v0, g),
    weightN: weightN(total, g),
    weightNEarth: weightN(total, gEarth),
  };
}

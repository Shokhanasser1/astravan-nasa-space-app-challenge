import { useSyncExternalStore } from 'react';
import { complexToGame, HDU_HABITAT, HDU_PLAN } from './layout';

/**
 * Title camera (entry spec, docs/specs/2026-11-15-entry.md): while the reception desk is on screen, the camera
 * drifts slowly around the base like a film's opening shot (the "living menu" of many games: the menu shows the
 * game itself). Scene-local, never part of the View. The HUD switches it on and off; the rig reads it.
 * Motion-sickness rules still hold: level horizon, no roll, a slow pendulum (≈ 1°/s), no shake; with
 * prefers-reduced-motion the camera stands still on the middle of the arc.
 */
let on = false;
const subs = new Set<() => void>();

export function setTitle(v: boolean): void {
  if (v === on) return;
  on = v;
  for (const f of subs) f();
}
export const titleOn = () => on;

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}
/** React: is the title camera on (re-renders only when it changes). */
export function useTitle(): boolean {
  return useSyncExternalStore(subscribe, titleOn, titleOn);
}

/** One title shot: the target, the circle the camera rides on, the middle of its arc and the swing. */
export interface TitleShot {
  /** What the camera looks at (metres). */
  readonly target: readonly [number, number, number];
  readonly radius: number;
  readonly height: number;
  /** Middle of the arc, degrees, in the scene's azimuth convention (0 = +z, 90 = +x). */
  readonly az: number;
  /** Half the swing, degrees. */
  readonly swing: number;
  /** One full swing there and back, seconds. */
  readonly period: number;
}

/** The ASTRA shot: around the middle of the base, high enough to see every building, the horizon level. */
export const ASTRA_TITLE: TitleShot = {
  target: [0.6, 1.2, -0.4],
  radius: 13,
  height: 3.6,
  /** (the habitat in the middle, the solar arrays and the lander on the right, the dish on the left: framed by hand,
   * 15 Nov) */
  az: 120,
  swing: 25,
  period: 70,
};

/**
 * The HDU shot (`?hdu`): the three modules from the side of their doors, built from the plan (the complex's centre
 * and its turn), so it follows the complex wherever it is turned. Far and high enough that the camera never comes
 * near a module, a tunnel or a prop, and all three modules stay inside a 60° field over the whole swing
 * (src/scene/hduCamera.test.ts).
 */
function hduTitle(): TitleShot {
  const [tx, tz] = complexToGame(0, 3);
  return {
    target: [tx, 1.8, tz],
    radius: 30,
    height: 8,
    az: (HDU_PLAN.DOOR_AZ * 180) / Math.PI,
    swing: 15,
    period: 70,
  };
}
export const HDU_TITLE: TitleShot = hduTitle();

/** The shot of the plan the game is on. */
export const TITLE: TitleShot = HDU_HABITAT ? HDU_TITLE : ASTRA_TITLE;

/** Camera place at time t (seconds) on the title arc; `still` = the middle of the arc. Pure. */
export function titlePose(
  t: number,
  still: boolean,
  out: { x: number; y: number; z: number },
  shot: TitleShot = TITLE,
): { x: number; y: number; z: number } {
  // (dev only: window.__titleTune = { az, radius, height, swing } to frame the shot by hand)
  const tune = import.meta.env?.DEV && typeof window !== 'undefined' ? (window as unknown as { __titleTune?: Partial<TitleShot> }).__titleTune : undefined;
  const T = tune ? { ...shot, ...tune } : shot;
  const swing = still ? 0 : T.swing * Math.sin((2 * Math.PI * t) / T.period);
  const a = ((T.az + swing) * Math.PI) / 180;
  out.x = T.target[0] + Math.sin(a) * T.radius;
  out.z = T.target[2] + Math.cos(a) * T.radius;
  out.y = T.height;
  return out;
}

/**
 * Where the camera looks: at the target, then turned so the base sits clear of the menu — on a wide screen the menu
 * is on the left, so the base moves right (pan); on a tall screen the menu is a sheet at the bottom, so the base
 * moves up (tilt). Yaw/pitch in the rig's convention (rotation order YXZ, roll always 0). Pure.
 */
export function titleAngles(
  at: { x: number; y: number; z: number },
  aspect: number,
  shot: TitleShot = TITLE,
): { yaw: number; pitch: number } {
  const dx = shot.target[0] - at.x;
  const dy = shot.target[1] - at.y;
  const dz = shot.target[2] - at.z;
  const wide = aspect > 1.25;
  const pan = wide ? (16 * Math.PI) / 180 : 0;
  const tilt = wide ? 0 : (-7 * Math.PI) / 180;
  return { yaw: Math.atan2(-dx, -dz) + pan, pitch: Math.atan2(dy, Math.hypot(dx, dz)) + tilt };
}

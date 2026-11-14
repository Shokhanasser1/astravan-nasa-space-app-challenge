/**
 * What steers the walker (handoff "first-person walk", section 4): keys held, and the touch stick.
 *
 * Keys are read by where they are on the keyboard (`KeyboardEvent.code`), never by the letter they type, so W A S D
 * work on a Russian or Uzbek Cyrillic layout too. Every key is let go when the window loses focus or the tab is
 * hidden: otherwise Alt-Tab with W held would leave the walker walking.
 */
export const walkInput = {
  /** Movement keys held now, by physical key code. */
  keys: new Set<string>(),
  /** The touch stick: x to the right, y ahead, each −1…1. */
  stick: { x: 0, y: 0 },
  /** The game is on screen (not the start or end screen); set by the HUD. */
  inGame: false,
  /** The day's phase lets you walk (not the launch or the truth sequence); set by the rig. */
  phaseOk: false,
};

const CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export interface Axes {
  /** Forward (+) or back (−). */
  ahead: number;
  /** Step right (+) or left (−). */
  side: number;
  /** Turn right (+) or left (−): the left and right arrows, so the keyboard alone is enough to get about. */
  turn: number;
}

/** The keys and the stick as three axes, each −1…1 (W with ↑, or the stick with a key, is still one step's worth). */
export function axes(out: Axes = { ahead: 0, side: 0, turn: 0 }): Axes {
  const k = walkInput.keys;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const on = (code: string) => (k.has(code) ? 1 : 0);
  const walking = walkInput.inGame && walkInput.phaseOk;
  out.ahead = walking ? clamp(walkInput.stick.y + on('KeyW') + on('ArrowUp') - on('KeyS') - on('ArrowDown')) : 0;
  out.side = walking ? clamp(walkInput.stick.x + on('KeyD') - on('KeyA')) : 0;
  out.turn = walking ? on('ArrowRight') - on('ArrowLeft') : 0;
  return out;
}

export function releaseAll(): void {
  walkInput.keys.clear();
  walkInput.stick.x = 0;
  walkInput.stick.y = 0;
}

const typing = (t: EventTarget | null) =>
  typeof HTMLElement !== 'undefined' && t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/**
 * Listen for the walking keys. `onChange` runs whenever a key goes down or up (the scene draws only on demand, so
 * it must be told to draw). Returns the function that stops listening.
 */
export function listenKeys(onChange: () => void): () => void {
  const down = (e: KeyboardEvent) => {
    if (!CODES.has(e.code) || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    if (!(walkInput.inGame && walkInput.phaseOk)) return;
    // (Arrows would scroll the page.)
    if (e.code.startsWith('Arrow')) e.preventDefault();
    walkInput.keys.add(e.code);
    onChange();
  };
  const up = (e: KeyboardEvent) => {
    if (walkInput.keys.delete(e.code)) onChange();
  };
  const drop = () => {
    releaseAll();
    onChange();
  };
  const hidden = () => {
    if (document.hidden) drop();
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', drop);
  document.addEventListener('visibilitychange', hidden);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', drop);
    document.removeEventListener('visibilitychange', hidden);
    releaseAll();
  };
}

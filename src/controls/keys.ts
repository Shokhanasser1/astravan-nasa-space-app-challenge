/**
 * Game keys (docs/specs/2026-11-14-controls-guide.html): the keys most PC games use for the same jobs, so a child
 * presses what they already know. Walking keys (W A S D, arrows) live in src/walk/input.ts; these are the rest.
 *
 * Read by physical key (`KeyboardEvent.code`), so they work on Russian or Uzbek Cyrillic layouts too; only "?" is
 * read by the character it types, because it sits on different keys in different layouts.
 */
export type Command =
  | { kind: 'use' } // E: put a battery on the building you look at
  | { kind: 'undo' } // Q: take it back
  | { kind: 'confirm' } // Enter: the big button (confirm day / next)
  | { kind: 'tablet' } // Tab: open or close the wrist tablet
  | { kind: 'map' } // M: the base map (standing points)
  | { kind: 'help' } // F1 or ?: the list of controls
  | { kind: 'close' } // Esc: close the open window
  | { kind: 'houston' } // H: ask Houston
  | { kind: 'pick'; n: number }; // 1–9: a choice on screen

export interface KeyLike {
  code: string;
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

const SIMPLE: Record<string, Command> = {
  KeyE: { kind: 'use' },
  KeyQ: { kind: 'undo' },
  Enter: { kind: 'confirm' },
  NumpadEnter: { kind: 'confirm' },
  Tab: { kind: 'tablet' },
  KeyM: { kind: 'map' },
  F1: { kind: 'help' },
  Escape: { kind: 'close' },
  KeyH: { kind: 'houston' },
};

/** The command a key press means, or null when it is not a game key (or a shortcut of the browser). */
export function command(e: KeyLike): Command | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  // (Before the digits: on a Russian layout "?" is Shift+7.)
  if (e.key === '?') return { kind: 'help' };
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (digit) return { kind: 'pick', n: Number(digit[1]) };
  return SIMPLE[e.code] ?? null;
}

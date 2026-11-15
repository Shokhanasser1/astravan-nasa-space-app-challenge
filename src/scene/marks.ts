/**
 * Boot prints and wheel tracks stay on the ground after the page is closed and opened again (15 Nov, Shoxjahon aka).
 * The rings themselves live in src/look/fx.js (capped, the oldest fade out); here they are kept on the device through
 * src/lib/storage.ts: x, z and heading of each mark, 6 bytes, at most ~70 KB in all. No player data, nothing leaves
 * the device. Written every 10 s while something new was laid, and when the tab is hidden or closed.
 */
import { load, save } from '../lib/storage';
import { marks, parseMarks } from '../look/fx.js';

type Kind = 'prints' | 'tracks';
const KEY: Record<Kind, string> = { prints: 'marks.prints', tracks: 'marks.tracks' };

/** The stored marks of one kind, [x, z, yaw] oldest first (empty when there are none). */
export function storedMarks(kind: Kind): [number, number, number][] {
  return parseMarks(load<string>(KEY[kind], '')) as [number, number, number][];
}

let keeping = false;

/** Start saving the marks (once per page; safe to call from every component that lays them). */
export function keepMarks(): void {
  if (keeping || typeof window === 'undefined') return;
  keeping = true;
  const flush = () => {
    for (const k of ['prints', 'tracks'] as const) {
      const ring = marks[k];
      if (ring && ring.dirty) save(KEY[k], ring.serialize());
    }
  };
  setInterval(flush, 10_000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
  });
  window.addEventListener('pagehide', flush);
}

/**
 * What the astronaut just did, for the visor holograms (src/ui/play/Holo.tsx): the height of the last jump,
 * measured in the game from take-off to the top. Written by the rig only when a jump lands; read with
 * useSyncExternalStore. No game number lives here: jumps change nothing in the week.
 */
export interface Telemetry {
  /** Height of the last jump, metres (0 = none yet). */
  jump: number;
  /** Jumps so far (a new value shows the card again). */
  jumps: number;
}

let state: Telemetry = { jump: 0, jumps: 0 };
const listeners = new Set<() => void>();

export const telemetry = {
  get: (): Telemetry => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  landed(height: number): void {
    state = { jump: height, jumps: state.jumps + 1 };
    for (const fn of listeners) fn();
  },
};

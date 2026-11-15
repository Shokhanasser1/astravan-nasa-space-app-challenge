/**
 * About 60 frames a second at most, whatever the screen's refresh rate. 15 Nov perf audit: on a 240 Hz laptop the base
 * was drawn up to 240 times a second — the GPU ran flat out for a calm kids' game and the intro film stuttered.
 *
 * Every requestAnimationFrame callback of the page (R3F's loop, DayRun's tick, the arm scanner) runs on every Nth
 * screen refresh, N from the refresh rate measured on the fly (frameStride): 60–90 Hz screens are unchanged (N = 1).
 * One native frame loop runs only while callbacks wait, and stops when nothing does.
 */

type Host = Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'>;

/** Screen refreshes per drawn frame for about `fps`: 60/75/90 Hz → 1, 120/144 → 2, 165 → 3, 240 → 4. */
export function frameStride(refreshHz: number, fps = 60): number {
  return Math.max(1, Math.floor(refreshHz / fps + 0.3));
}

/** Gaps between native frames kept; the shortest one is the screen's refresh interval. */
const SAMPLES = 30;
/** Our ids start far above the browser's, so a cancel of an id from before the cap still reaches the browser. */
const FIRST_ID = 1e9;

/** Installs the cap on `host` (the window). Returns the function that removes it. */
export function capFrameRate(host: Host = window, fps = 60): () => void {
  const nativeRaf = host.requestAnimationFrame;
  const nativeCaf = host.cancelAnimationFrame;
  const raf = nativeRaf.bind(host);
  const caf = nativeCaf.bind(host);
  let waiting = new Map<number, FrameRequestCallback>();
  let running = new Map<number, FrameRequestCallback>();
  const gaps = new Float64Array(SAMPLES);
  let gapCount = 0;
  let nextId = FIRST_ID;
  let native = 0;
  let lastT = -1;
  let lastRun = -Infinity;
  let now = 0;

  const call = (cb: FrameRequestCallback) => {
    try {
      cb(now);
    } catch (e) {
      // like the browser: one failing callback is reported and the others still run
      queueMicrotask(() => {
        throw e;
      });
    }
  };

  const refreshMs = () => {
    let m = Infinity;
    for (let i = 0; i < SAMPLES; i++) m = Math.min(m, gaps[i]);
    return m;
  };

  const pump = (t: number) => {
    native = 0;
    if (waiting.size === 0) return;
    if (lastT >= 0 && t > lastT) gaps[gapCount++ % SAMPLES] = t - lastT;
    lastT = t;
    const frame = gapCount >= SAMPLES ? refreshMs() : 0;
    const stride = frame > 0 ? frameStride(1000 / frame, fps) : 1;
    if (stride > 1 && t - lastRun < (stride - 0.5) * frame) {
      native = raf(pump);
      return;
    }
    lastRun = t;
    now = t;
    const due = waiting;
    waiting = running;
    running = due;
    due.forEach(call);
    due.clear();
    if (waiting.size > 0 && native === 0) native = raf(pump);
  };

  host.requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = nextId++;
    waiting.set(id, cb);
    if (native === 0) native = raf(pump);
    return id;
  };
  host.cancelAnimationFrame = (id: number) => {
    if (!waiting.delete(id) && !running.delete(id)) caf(id);
  };

  return () => {
    host.requestAnimationFrame = nativeRaf;
    host.cancelAnimationFrame = nativeCaf;
    if (native !== 0) caf(native);
    native = 0;
    waiting.forEach((cb) => raf(cb));
    waiting.clear();
  };
}

import { describe, expect, it } from 'vitest';
import { capFrameRate, frameStride } from './frameCap';

describe('frameStride: screen refreshes per drawn frame for ~60 fps', () => {
  it.each([
    [60, 1],
    [75, 1],
    [90, 1],
    [120, 2],
    [144, 2],
    [165, 3],
    [240, 4],
  ])('%i Hz → every %i', (hz, n) => {
    expect(frameStride(hz)).toBe(n);
  });
});

/** A fake screen: tick() fires every waiting native callback at the next refresh. */
function fakeScreen(hz: number) {
  let id = 0;
  let t = 0;
  let waiting = new Map<number, FrameRequestCallback>();
  const host = {
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      waiting.set(++id, cb);
      return id;
    },
    cancelAnimationFrame: (n: number) => {
      waiting.delete(n);
    },
  };
  const tick = () => {
    t += 1000 / hz;
    const due = waiting;
    waiting = new Map();
    due.forEach((cb) => cb(t));
  };
  return { host, tick, pending: () => waiting.size };
}

/** A game loop like R3F's: asks for the next frame inside each frame. */
function loop(host: { requestAnimationFrame: (cb: FrameRequestCallback) => number }) {
  let frames = 0;
  const step = () => {
    frames++;
    host.requestAnimationFrame(step);
  };
  host.requestAnimationFrame(step);
  return () => frames;
}

describe('capFrameRate', () => {
  it('a 240 Hz screen draws 60 frames a second', () => {
    const s = fakeScreen(240);
    capFrameRate(s.host);
    const frames = loop(s.host);
    for (let i = 0; i < 240; i++) s.tick(); // 1 s: the refresh rate is measured, the cap settles
    const before = frames();
    for (let i = 0; i < 480; i++) s.tick(); // then 2 s
    expect(frames() - before).toBe(120);
  });

  it('a 60 Hz screen keeps every frame', () => {
    const s = fakeScreen(60);
    capFrameRate(s.host);
    const frames = loop(s.host);
    for (let i = 0; i < 120; i++) s.tick();
    expect(frames()).toBeGreaterThanOrEqual(119);
  });

  it('a cancelled frame never runs, and the native loop stops when nothing waits', () => {
    const s = fakeScreen(240);
    capFrameRate(s.host);
    let ran = false;
    const id = s.host.requestAnimationFrame(() => {
      ran = true;
    });
    s.host.cancelAnimationFrame(id);
    for (let i = 0; i < 8; i++) s.tick();
    expect(ran).toBe(false);
    expect(s.pending()).toBe(0);
  });

  it('a frame that throws does not stop the others', () => {
    const s = fakeScreen(60);
    capFrameRate(s.host);
    let ok = false;
    s.host.requestAnimationFrame(() => {
      throw new Error('boom');
    });
    s.host.requestAnimationFrame(() => {
      ok = true;
    });
    const thrown: unknown[] = [];
    const prev = globalThis.queueMicrotask;
    globalThis.queueMicrotask = (f) => {
      try {
        f();
      } catch (e) {
        thrown.push(e);
      }
    };
    try {
      s.tick();
    } finally {
      globalThis.queueMicrotask = prev;
    }
    expect(ok).toBe(true);
    expect(thrown).toHaveLength(1);
  });

  it('restore puts the native functions back and hands over waiting frames', () => {
    const s = fakeScreen(60);
    const nativeRaf = s.host.requestAnimationFrame;
    const restore = capFrameRate(s.host);
    let ran = false;
    s.host.requestAnimationFrame(() => {
      ran = true;
    });
    restore();
    expect(s.host.requestAnimationFrame).toBe(nativeRaf);
    s.tick();
    expect(ran).toBe(true);
  });
});

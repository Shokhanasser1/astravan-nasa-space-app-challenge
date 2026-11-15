import { lazy, type ComponentType } from "react";

/**
 * React.lazy plus an early start: `preload()` begins the dynamic import (call it when the phase before is shown, or
 * on idle), so by the time the screen is needed the chunk is usually in cache and the switch is instant.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyScreen<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
) {
  let started: Promise<unknown> | null = null;
  const preload = () => (started ??= load().catch(() => (started = null)));
  const Comp = lazy(() => {
    preload();
    return load();
  });
  return Object.assign(Comp, { preload });
}

/** Run `fn` once the first frames are done (idle, with a timeout fallback for browsers without requestIdleCallback). */
export function whenIdle(fn: () => void, timeout = 2500): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(fn, { timeout });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 1200);
  return () => clearTimeout(id);
}

/**
 * Safe localStorage. It can be missing or throw (private mode, Safari clears data after 7 days, quota).
 * The game must work without it. Never keep the only copy of the before/after count here.
 */
const PREFIX = 'hb7:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): boolean {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

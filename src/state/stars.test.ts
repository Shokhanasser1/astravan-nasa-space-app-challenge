import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markStar, stars, starsKey } from './stars';

/** An in-memory localStorage behind src/lib/storage.ts. */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

const WEEK = '2021-10-25';
let store: ReturnType<typeof memoryStorage>;

beforeEach(() => {
  store = memoryStorage();
  vi.stubGlobal('localStorage', store);
});
afterEach(() => vi.unstubAllGlobals());

describe('day stars', () => {
  it('starts with seven unlit stars', () => {
    expect(stars(WEEK)).toEqual([false, false, false, false, false, false, false]);
  });

  it('lights a day and keeps it on the device, by week', () => {
    expect(markStar(WEEK, 1)).toEqual([true, false, false, false, false, false, false]);
    markStar(WEEK, 5);
    expect(stars(WEEK)).toEqual([true, false, false, false, true, false, false]);
    expect(stars('2012-01-20')).toEqual(Array(7).fill(false));
    expect(JSON.parse(store.data.get(`hb7:${starsKey(WEEK)}`)!)).toEqual([true, false, false, false, true, false, false]);
  });

  it('keeps badges apart and the badge-less week apart from both', () => {
    markStar(WEEK, 2, 'lochin');
    markStar(WEEK, 3, 'humo');
    expect(stars(WEEK, 'lochin')[1]).toBe(true);
    expect(stars(WEEK, 'lochin')[2]).toBe(false);
    expect(stars(WEEK, 'humo')[2]).toBe(true);
    expect(stars(WEEK)).toEqual(Array(7).fill(false));
    expect(starsKey(WEEK, 'lochin')).toBe('stars:lochin:2021-10-25');
    expect(starsKey(WEEK)).toBe('stars:2021-10-25');
  });

  it('ignores days out of range and never writes a star twice', () => {
    const set = vi.spyOn(store, 'setItem');
    markStar(WEEK, 0);
    markStar(WEEK, 8);
    markStar(WEEK, 2.5);
    expect(set).not.toHaveBeenCalled();
    markStar(WEEK, 7);
    markStar(WEEK, 7);
    expect(set).toHaveBeenCalledTimes(1);
    expect(stars(WEEK)[6]).toBe(true);
  });

  it('reads broken or edited storage as unlit stars', () => {
    store.data.set(`hb7:${starsKey(WEEK)}`, '{not json');
    expect(stars(WEEK)).toEqual(Array(7).fill(false));
    store.data.set(`hb7:${starsKey(WEEK)}`, JSON.stringify(['yes', 1, true, null]));
    expect(stars(WEEK)).toEqual([false, false, true, false, false, false, false]);
  });

  it('goes on without storage: nothing is kept, nothing throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(() => markStar(WEEK, 1)).not.toThrow();
    expect(markStar(WEEK, 1)[0]).toBe(true); // the caller still sees today's star
    expect(stars(WEEK)).toEqual(Array(7).fill(false));
  });
});

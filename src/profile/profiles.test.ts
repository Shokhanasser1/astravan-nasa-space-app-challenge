import { describe, expect, it } from 'vitest';
import {
  MAX_PROFILES,
  SIGNS,
  canCreate,
  createProfile,
  freeSigns,
  rank,
  recordMission,
  removeProfile,
  sanitize,
  toNextRank,
  type MissionRecord,
  type Profile,
} from './profiles';

const rec = (seed: number, weekId = '2021-10-25'): MissionRecord => ({ weekId, titleKey: 'engine.title.cadet', crew: 7, science: 9, seed });

describe('cadet badges', () => {
  it('a badge is a call sign and a patch colour — nothing else about the child', () => {
    const { list, profile } = createProfile([], 'lochin', 'gold');
    expect(profile).toEqual({ id: 'lochin', sign: 'lochin', patch: 'gold', missions: [] });
    expect(Object.keys(profile!).sort()).toEqual(['id', 'missions', 'patch', 'sign']);
    expect(list).toHaveLength(1);
  });

  it('a call sign is worn once per device', () => {
    const { list } = createProfile([], 'lochin', 'gold');
    expect(freeSigns(list)).not.toContain('lochin');
    expect(createProfile(list, 'lochin', 'green').profile).toBeNull();
  });

  it('room for one class table of badges, then no more', () => {
    let list: Profile[] = [];
    for (const s of SIGNS.slice(0, MAX_PROFILES)) list = createProfile(list, s, 'green').list;
    expect(list).toHaveLength(MAX_PROFILES);
    expect(canCreate(list)).toBe(false);
  });

  it('unknown call signs and colours are refused', () => {
    expect(createProfile([], 'bob' as never, 'gold').profile).toBeNull();
    expect(createProfile([], 'humo', 'pink' as never).profile).toBeNull();
  });

  it('a finished mission is written once, to its own badge', () => {
    let list = createProfile([], 'lochin', 'gold').list;
    list = createProfile(list, 'humo', 'violet').list;
    list = recordMission(list, 'lochin', rec(1));
    list = recordMission(list, 'lochin', rec(1)); // the truth screen shown twice
    list = recordMission(list, 'lochin', rec(2, '2022-01-20'));
    expect(list[0].missions).toHaveLength(2);
    expect(list[1].missions).toHaveLength(0);
  });

  it('ranks grow with missions flown', () => {
    const p = (n: number) => ({ missions: Array.from({ length: n }, (_, i) => rec(i)) });
    expect(rank(p(0))).toBe('cadet');
    expect(rank(p(1))).toBe('crew');
    expect(rank(p(3))).toBe('specialist');
    expect(rank(p(7))).toBe('commander');
    expect(toNextRank(p(0))).toEqual({ next: 'crew', left: 1 });
    expect(toNextRank(p(4))).toEqual({ next: 'commander', left: 1 });
    expect(toNextRank(p(5))).toBeNull();
  });

  it('removing a badge leaves the others', () => {
    let list = createProfile([], 'lochin', 'gold').list;
    list = createProfile(list, 'humo', 'violet').list;
    expect(removeProfile(list, 'lochin').map((p) => p.sign)).toEqual(['humo']);
  });

  it('storage that is broken, old or edited by hand never breaks the game', () => {
    expect(sanitize(null)).toEqual([]);
    expect(sanitize('x')).toEqual([]);
    const raw = [
      { sign: 'lochin', patch: 'gold', missions: [rec(1), { weekId: 1 }], name: 'should be dropped' },
      { sign: 'lochin', patch: 'green', missions: [] }, // duplicate sign
      { sign: 'zz', patch: 'gold' },
      { sign: 'humo', patch: 'violet' },
    ];
    const list = sanitize(raw);
    expect(list.map((p) => p.sign)).toEqual(['lochin', 'humo']);
    expect(list[0].missions).toHaveLength(1);
    expect(list[0]).not.toHaveProperty('name');
    expect(list[1].missions).toEqual([]);
  });
});

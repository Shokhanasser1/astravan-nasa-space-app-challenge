import { describe, expect, it } from 'vitest';
import { confirm, dayInfo, limits, newGame, preview, result, type Alloc, type State } from './rules';
import type { Week, WeekDay } from './week';

const quietDay = (day: number, extra: Partial<WeekDay> = {}): WeekDay => ({
  day, date: `2030-01-0${day}`, mean_uGy_h: 10, max_uGy_h: 11, hours: 24, ratio: 1, level: 0, alert: false,
  r_label: 'measured', flares: [], particles: [], ...extra,
});
const quietWeek: Week = { id: '2030-01-01', kind: 'quiet', days: [1, 2, 3, 4, 5, 6, 7].map((d) => quietDay(d)) };
const stormWeek: Week = {
  id: '2030-02-01', kind: 'storm',
  days: [1, 2, 3, 4, 5, 6, 7].map((d) =>
    d === 3 ? quietDay(d, { alert: true, level: 1 }) : d === 4 ? quietDay(d, { level: 2 }) : quietDay(d)),
};
const a = (ls: number, gh: number, build: number, sc: number, shelter: Alloc['shelter'] = 'none', launch = 0): Alloc => ({
  ls, gh, build, sc, launch, shelter,
});
const run = (w: Week, days: Alloc[], s: State = newGame(w, { cards: [] })) => days.reduce((x, d) => confirm(x, w, d), s);

describe('rules', () => {
  it('starts at reserve 5, garden 3, one stored battery, six a day', () => {
    const s = newGame(quietWeek);
    expect(s).toMatchObject({ day: 1, air: 5, plant: 3, bat: 1, wall: 0, extra: 0, sci: 0 });
    expect(limits(s, quietWeek).available).toBe(7);
  });

  it('never changes the state it is given (preview and confirm are pure)', () => {
    const s = newGame(quietWeek);
    const copy = structuredClone(s);
    preview(s, quietWeek, a(2, 2, 0, 3));
    confirm(s, quietWeek, a(2, 2, 0, 3));
    expect(s).toEqual(copy);
  });

  it('the workshop is closed on day 1 and a wall level needs two batteries', () => {
    const s = newGame(quietWeek);
    expect(limits(s, quietWeek).max.build).toBe(0);
    const s2 = confirm(s, quietWeek, a(2, 2, 0, 0));
    expect(confirm(s2, quietWeek, a(2, 1, 1, 0)).wall).toBe(0);
    expect(confirm(s2, quietWeek, a(2, 1, 2, 0)).wall).toBe(1);
  });

  it('stores at most two unused batteries', () => {
    const s = run(quietWeek, [a(2, 1, 0, 0)]); // 7 available, 3 used
    expect(s.bat).toBe(2);
  });

  it('reserve 0 → emergency day: the next day runs itself, crew −2', () => {
    const s = run(quietWeek, [a(0, 2, 0, 3), a(0, 2, 0, 3)]); // 5 → 2 → −1
    expect(s.emerg).toBe(1);
    expect(s.forced).toBe(true);
    expect(dayInfo(s, quietWeek)).toMatchObject({ forced: true, card: null, choice: false });
    const next = confirm(s, quietWeek, a(0, 0, 0, 3));
    expect(next.days[next.days.length - 1]).toMatchObject({ shelter: 'full' });
    expect(next.air).toBe(1); // 3 to Life Support
    expect(next.forced).toBe(false);
  });

  it('no four batteries on Launch on day 7 → Late Ride Home, crew −2', () => {
    const six = Array.from({ length: 6 }, () => a(2, 2, 0, 0));
    const home = run(quietWeek, [...six, a(2, 0, 0, 0, 'none', 4)]);
    const late = run(quietWeek, [...six, a(2, 0, 0, 0, 'none', 0)]);
    expect(result(home, quietWeek)).toMatchObject({ late: false });
    expect(result(late, quietWeek)).toMatchObject({ late: true, title: 'Late Ride Home' });
    expect(result(late, quietWeek).crew).toBe(result(home, quietWeek).crew - 2);
  });

  it('alert day: shelter choice, level unknown; storm day: level known', () => {
    const s3 = run(stormWeek, [a(2, 2, 0, 0), a(2, 2, 0, 0)]);
    expect(dayInfo(s3, stormWeek)).toMatchObject({ storm: 'alert', choice: true, level: null, realLevel: 1 });
    const s4 = confirm(s3, stormWeek, a(2, 2, 0, 0));
    expect(dayInfo(s4, stormWeek)).toMatchObject({ storm: 'storm', choice: true, level: 2 });
  });

  it('shelter limits: half → explore ≤ 1; everyone inside → no explore, no workshop, garden ≤ 1', () => {
    const s3 = run(stormWeek, [a(2, 2, 0, 0), a(2, 2, 0, 0)]);
    expect(limits(s3, stormWeek, 'half').max).toMatchObject({ sc: 1, build: 2, gh: 2 });
    expect(limits(s3, stormWeek, 'full').max).toMatchObject({ sc: 0, build: 0, gh: 1 });
    const s = confirm(s3, stormWeek, a(2, 2, 2, 3, 'full'));
    expect(s.days[2]).toMatchObject({ shelter: 'full', outside: 0 });
    expect(s.wall).toBe(0);
  });

  it('a quiet day has no shelter choice even if one is sent', () => {
    const s = confirm(newGame(quietWeek), quietWeek, a(2, 2, 0, 3, 'full'));
    expect(s.days[0].shelter).toBe('none');
    expect(s.sci).toBe(3);
  });

  it('cards: dust leave costs a battery every day from tomorrow; filter wait costs reserve every day', () => {
    const dust = confirm(confirm(newGame(quietWeek, { cards: ['dust'] }), quietWeek, a(2, 2, 0, 0)), quietWeek, a(2, 2, 0, 0), 'dust:leave');
    expect(dust.dusty).toBe(true);
    expect(limits(dust, quietWeek).available).toBe(6 + dust.bat - 1);
    const s1 = confirm(newGame(quietWeek, { cards: ['filter'] }), quietWeek, a(2, 2, 0, 0));
    const wait = confirm(s1, quietWeek, a(2, 2, 0, 0), 'filter:wait');
    expect(wait.air).toBe(s1.air - 1);
    expect(confirm(wait, quietWeek, a(2, 2, 0, 0)).air).toBe(wait.air - 1);
  });

  it('cards: shadow heat costs one battery today, cool costs garden health', () => {
    const s1 = confirm(newGame(quietWeek, { cards: ['shadow'] }), quietWeek, a(2, 1, 0, 0));
    expect(limits(s1, quietWeek, 'none', 'shadow:heat').available).toBe(limits(s1, quietWeek).available - 1);
    expect(confirm(s1, quietWeek, a(2, 1, 0, 0), 'shadow:cool').plant).toBe(s1.plant - 1);
    expect(preview(s1, quietWeek, a(2, 1, 0, 0)).warning).toBe('engine.warn.chooseCard');
  });

  it('cards: sunrise gives a battery, tired rest caps explore and adds crew', () => {
    const s1 = confirm(newGame(quietWeek, { cards: ['sunrise'] }), quietWeek, a(2, 2, 0, 0));
    expect(limits(s1, quietWeek).available).toBe(6 + s1.bat + 1);
    const t1 = confirm(newGame(quietWeek, { cards: ['tired'] }), quietWeek, a(2, 2, 0, 0));
    expect(limits(t1, quietWeek, 'none', 'tired:rest').max.sc).toBe(1);
    expect(confirm(t1, quietWeek, a(2, 2, 0, 3), 'tired:rest')).toMatchObject({ crew_adj: 1, sci: 1 });
  });

  it('cards: request pays 2 when explore reaches 4 over today and tomorrow', () => {
    const s1 = confirm(newGame(quietWeek, { cards: ['request'] }), quietWeek, a(2, 2, 0, 0));
    const s3 = confirm(confirm(s1, quietWeek, a(3, 0, 0, 2)), quietWeek, a(3, 0, 0, 2));
    expect(s3.sci).toBe(4 + 2);
  });

  it('the same seed deals the same cards; storm days get no day card', () => {
    const one = newGame(stormWeek, { seed: 42 }).cards;
    expect(newGame(stormWeek, { seed: 42 }).cards).toEqual(one);
    expect(one[0]).toBeNull();
    expect(one[2]).toBeNull(); // alert day
    expect(one[3]).toBeNull(); // storm day
    expect(one[6]).toBeNull();
    expect(one.filter(Boolean)).toHaveLength(3);
  });

  it('the dose penalty steps at 1, 2.5, 5 and 10', () => {
    const base = newGame(quietWeek);
    const crewAt = (extra: number) => result({ ...base, extra }, quietWeek).crew;
    expect([0.5, 1.0, 2.0, 4.0, 9.0, 12].map(crewAt)).toEqual([7, 7, 6, 5, 4, 3]);
  });
});

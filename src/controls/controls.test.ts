import { describe, expect, it } from 'vitest';
import { command } from './keys';
import { pickAim, type AimTarget } from './aim';
import { TRAVEL, choices, resolve, type Ctx } from './act';
import { board, initialModel, reducer, type Model } from '../state/game';
import { week as realWeek } from '../engine/golden';

const key = (code: string, k = '', mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) =>
  command({ code, key: k, ...mods });

describe('game keys', () => {
  it('maps the usual PC game keys by their place on the keyboard', () => {
    expect(key('KeyE')).toEqual({ kind: 'use' });
    expect(key('KeyQ')).toEqual({ kind: 'undo' });
    expect(key('Enter')).toEqual({ kind: 'confirm' });
    expect(key('NumpadEnter')).toEqual({ kind: 'confirm' });
    expect(key('Tab')).toEqual({ kind: 'tablet' });
    expect(key('KeyM')).toEqual({ kind: 'map' });
    expect(key('KeyH')).toEqual({ kind: 'houston' });
    expect(key('Escape')).toEqual({ kind: 'close' });
    expect(key('F1')).toEqual({ kind: 'help' });
    expect(key('Digit3')).toEqual({ kind: 'pick', n: 3 });
    expect(key('Numpad1')).toEqual({ kind: 'pick', n: 1 });
  });

  it('works on a Cyrillic layout: the E key types "у" but is still E', () => {
    expect(key('KeyE', 'у')).toEqual({ kind: 'use' });
  });

  it('reads "?" by its character, before the digit it may sit on', () => {
    expect(key('Slash', '?')).toEqual({ kind: 'help' });
    expect(key('Digit7', '?')).toEqual({ kind: 'help' }); // Russian layout: Shift+7
  });

  it('leaves browser shortcuts and other keys alone', () => {
    expect(key('KeyE', 'e', { ctrlKey: true })).toBeNull();
    expect(key('KeyM', 'm', { metaKey: true })).toBeNull();
    expect(key('Digit1', '1', { altKey: true })).toBeNull();
    expect(key('Digit0')).toBeNull();
    expect(key('KeyW')).toBeNull(); // walking is src/walk/input.ts
    expect(key('Space')).toBeNull(); // kept for the jump of the character build
  });
});

describe('aim: the building in front', () => {
  const T: AimTarget[] = [
    { k: 'ls', x: 0, z: -10, r: 2 }, // straight ahead (yaw 0 looks along −z)
    { k: 'gh', x: 10, z: 0, r: 1.5 }, // to the right
  ];

  it('picks the building straight ahead', () => {
    expect(pickAim(0, 0, 0, T)).toBe('ls');
  });

  it('turning right (yaw −90°) faces the other building', () => {
    expect(pickAim(0, 0, -Math.PI / 2, T)).toBe('gh');
  });

  it('nothing when looking away or when too far', () => {
    expect(pickAim(0, 0, Math.PI, T)).toBeNull();
    expect(pickAim(0, 50, 0, [{ k: 'ls', x: 0, z: 0, r: 2 }])).toBeNull();
  });

  it('a building a little off the centre still counts; far off it does not', () => {
    const ahead = (deg: number) => -Math.tan((deg * Math.PI) / 180) * 10; // x of a point `deg` to the right at 10 m
    expect(pickAim(0, 0, 0, [{ k: 'ls', x: -ahead(20), z: -10, r: 2 }])).toBe('ls');
    expect(pickAim(0, 0, 0, [{ k: 'ls', x: -ahead(40), z: -10, r: 2 }])).toBeNull();
  });

  it('standing inside a building aims at it', () => {
    expect(pickAim(0, -10, Math.PI, T)).toBe('ls');
  });

  it('of two in line, the one nearer the centre of the view wins', () => {
    const two: AimTarget[] = [
      { k: 'ws', x: 1.5, z: -8, r: 1.5 },
      { k: 'sc', x: 0, z: -16, r: 1 },
    ];
    expect(pickAim(0, 0, 0, two)).toBe('sc');
  });
});

// ---- resolve: the same rules for keys and touch buttons ----
const step = (m: Model) => {
  if (m.phase === 'plan') {
    const b = board(m)!;
    const first = choices(b)[0];
    if (b.preview?.warning === 'engine.warn.chooseCard' && first) m = reducer(m, first);
    return reducer(m, { type: 'CONFIRM' });
  }
  return reducer(m, { type: 'NEXT' });
};
/** Plays on until `ok` holds (plan phase of some day). */
function until(ok: (m: Model) => boolean): Model {
  let m = reducer(initialModel, { type: 'START', week: realWeek() });
  for (let i = 0; i < 60 && !ok(m); i++) m = step(m);
  if (!ok(m)) throw new Error('state not reached');
  return m;
}
const ctx = (m: Model, extra: Partial<Ctx> = {}): Ctx => ({
  screen: m.screen,
  phase: m.phase,
  board: board(m),
  aim: null,
  overlay: null,
  ...extra,
});

describe('resolve', () => {
  const plan1 = until((m) => m.phase === 'plan' && m.game!.day === 1);
  const cardDay = until((m) => m.phase === 'plan' && board(m)!.cardOptions.length > 0);
  const stormDay = until((m) => m.phase === 'plan' && board(m)!.shelterOptions.length > 0);

  it('E and Q put a battery on, and take it back from, the building in front — only while planning', () => {
    expect(resolve({ kind: 'use' }, ctx(plan1, { aim: 'ls' }))).toEqual({ action: { type: 'SET', k: 'ls' } });
    expect(resolve({ kind: 'undo' }, ctx(plan1, { aim: 'gh' }))).toEqual({ action: { type: 'SET', k: 'gh', delta: -1 } });
    expect(resolve({ kind: 'use' }, ctx(plan1))).toBeNull(); // looking at nothing
    const morning = until((m) => m.phase === 'morning');
    expect(resolve({ kind: 'use' }, ctx(morning, { aim: 'ls' }))).toBeNull();
  });

  it('E through the reducer adds exactly what a tap on the building adds', () => {
    const e = resolve({ kind: 'use' }, ctx(plan1, { aim: 'ls' }));
    const byKey = reducer(plan1, (e as { action: never }).action);
    expect(byKey.alloc).toEqual(reducer(plan1, { type: 'SET', k: 'ls' }).alloc);
  });

  it('digits pick the card answers in their order on the tablet', () => {
    const b = board(cardDay)!;
    expect(resolve({ kind: 'pick', n: 1 }, ctx(cardDay))).toEqual({ action: { type: 'CHOOSE', card: b.cardOptions[0].value } });
    expect(resolve({ kind: 'pick', n: 2 }, ctx(cardDay))).toEqual({ action: { type: 'CHOOSE', card: b.cardOptions[1].value } });
    expect(resolve({ kind: 'pick', n: 9 }, ctx(cardDay))).toBeNull();
  });

  it('shelter choices are numbered after the card answers', () => {
    const b = board(stormDay)!;
    const n = b.cardOptions.length + 1;
    expect(resolve({ kind: 'pick', n }, ctx(stormDay))).toEqual({ action: { type: 'CHOOSE', shelter: b.shelterOptions[0].value } });
    expect(resolve({ kind: 'houston' }, ctx(stormDay))).toEqual({ ui: 'houston' });
    expect(resolve({ kind: 'houston' }, ctx(plan1))).toBeNull(); // no storm, nothing to ask
  });

  it('Enter is the big button: confirm while planning, next otherwise — never past an unanswered card', () => {
    expect(resolve({ kind: 'confirm' }, ctx(plan1))).toEqual({ action: { type: 'CONFIRM' } });
    const morning = until((m) => m.phase === 'morning');
    expect(resolve({ kind: 'confirm' }, ctx(morning))).toEqual({ action: { type: 'NEXT' } });
    expect(board(cardDay)!.preview?.warning).toBe('engine.warn.chooseCard');
    expect(resolve({ kind: 'confirm' }, ctx(cardDay))).toBeNull();
  });

  it('the map: M opens it, digits travel, Esc or M closes it', () => {
    expect(resolve({ kind: 'map' }, ctx(plan1))).toEqual({ ui: 'map' });
    const open = ctx(plan1, { overlay: 'map', aim: 'ls' });
    expect(resolve({ kind: 'pick', n: 1 }, open)).toEqual({ travel: 'airlock' });
    expect(resolve({ kind: 'pick', n: TRAVEL.length }, open)).toEqual({ travel: 'inside' });
    expect(resolve({ kind: 'pick', n: TRAVEL.length + 1 }, open)).toBeNull();
    expect(resolve({ kind: 'use' }, open)).toBeNull(); // keys under the map do nothing
    expect(resolve({ kind: 'map' }, open)).toEqual({ ui: 'close' });
    expect(resolve({ kind: 'close' }, open)).toEqual({ ui: 'close' });
    expect(resolve({ kind: 'close' }, ctx(plan1))).toBeNull();
  });

  it('on the start screen only help works', () => {
    expect(resolve({ kind: 'confirm' }, ctx(initialModel))).toBeNull();
    expect(resolve({ kind: 'map' }, ctx(initialModel))).toBeNull();
    expect(resolve({ kind: 'help' }, ctx(initialModel))).toEqual({ ui: 'help' });
  });

  it('Tab opens the wrist tablet only while planning', () => {
    expect(resolve({ kind: 'tablet' }, ctx(plan1))).toEqual({ ui: 'tablet' });
    expect(resolve({ kind: 'tablet' }, ctx(until((m) => m.phase === 'night')))).toBeNull();
  });
});

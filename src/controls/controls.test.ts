import { describe, expect, it } from 'vitest';
import { command } from './keys';
import { AIM_REACH, pickAim, type AimTarget } from './aim';
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
    { k: 'ls', x: 0, z: -3, r: 2 }, // straight ahead (yaw 0 looks along −z), edge 1 m away
    { k: 'gh', x: 3, z: 0, r: 1.5 }, // to the right
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

  it('only next to it: within AIM_REACH of the edge, not from across the base', () => {
    const at = (gap: number): AimTarget[] => [{ k: 'ws', x: 0, z: -(1.5 + gap), r: 1.5 }];
    expect(pickAim(0, 0, 0, at(AIM_REACH - 0.1))).toBe('ws');
    expect(pickAim(0, 0, 0, at(AIM_REACH + 0.1))).toBeNull();
    expect(pickAim(0, 0, 0, at(10))).toBeNull(); // the old 30 m reach is gone
  });

  it('the power hub is a target too', () => {
    expect(pickAim(0, 0, 0, [{ k: 'hub', x: 0, z: -2, r: 0.6 }])).toBe('hub');
  });

  it('a target with `near` counts when the astronaut stands next to it, whichever way they face', () => {
    const hub: AimTarget = { k: 'hub', x: 1.5, z: 0.8, r: 0.6, near: 1.6 }; // to the side and a bit behind
    expect(pickAim(0, 0, 0, [hub])).toBe('hub');
    expect(pickAim(0, 0, 0, [{ ...hub, x: 3 }])).toBeNull(); // 2.4 m from its edge: too far
    expect(pickAim(0, 0, 0, [{ ...hub, near: undefined }])).toBeNull(); // without `near` the heading counts
    // a building in front wins over the one beside
    expect(pickAim(0, 0, 0, [hub, { k: 'ls', x: 0, z: -3, r: 1 }])).toBe('ls');
  });

  it('a building a little off the centre still counts; far off it does not', () => {
    const ahead = (deg: number) => -Math.tan((deg * Math.PI) / 180) * 3; // x of a point `deg` to the right at 3 m
    expect(pickAim(0, 0, 0, [{ k: 'ls', x: -ahead(30), z: -3, r: 1 }])).toBe('ls');
    expect(pickAim(0, 0, 0, [{ k: 'ls', x: -ahead(50), z: -3, r: 1 }])).toBeNull();
  });

  it('standing inside a building aims at it', () => {
    expect(pickAim(0, -3, Math.PI, T)).toBe('ls');
  });

  it('of two in line, the one nearer the centre of the view wins', () => {
    const two: AimTarget[] = [
      { k: 'ws', x: 1.2, z: -2.5, r: 1 },
      { k: 'sc', x: 0, z: -3.5, r: 1 },
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

  it('E takes a battery at the hub and puts it into the building in front; Q takes it back — only while planning', () => {
    expect(resolve({ kind: 'use' }, ctx(plan1, { aim: 'hub' }))).toEqual({ action: { type: 'TAKE' } });
    expect(resolve({ kind: 'undo' }, ctx(plan1, { aim: 'hub' }))).toEqual({ action: { type: 'DROP' } });
    expect(resolve({ kind: 'use' }, ctx(plan1, { aim: 'ls', hands: 1 }))).toEqual({ action: { type: 'PUT', k: 'ls' } });
    expect(resolve({ kind: 'use' }, ctx(plan1, { aim: 'ls', hands: 0 }))).toBeNull(); // empty hands
    expect(resolve({ kind: 'use' }, ctx(plan1, { aim: 'ws', hands: 1 }))).toBeNull(); // the workshop needs two
    expect(resolve({ kind: 'undo' }, ctx(plan1, { aim: 'gh' }))).toEqual({ action: { type: 'BACK', k: 'gh' } });
    expect(resolve({ kind: 'use' }, ctx(plan1))).toBeNull(); // looking at nothing
    const morning = until((m) => m.phase === 'morning');
    expect(resolve({ kind: 'use' }, ctx(morning, { aim: 'ls', hands: 1 }))).toBeNull();
  });

  it('?drive: E at the rover climbs in, E while driving climbs out — in any phase you can walk in, before the aim', () => {
    const morning = until((m) => m.phase === 'morning');
    expect(resolve({ kind: 'use' }, ctx(morning, { ride: 'board' }))).toEqual({ ride: 'board' });
    expect(resolve({ kind: 'use' }, ctx(plan1, { ride: 'exit', aim: 'ls' }))).toEqual({ ride: 'exit' });
    expect(resolve({ kind: 'undo' }, ctx(plan1, { ride: 'board', aim: 'ls' }))).toEqual({ action: { type: 'BACK', k: 'ls' } });
    expect(resolve({ kind: 'use' }, ctx(plan1, { ride: 'board', overlay: 'map' }))).toBeNull(); // the map keeps its keys
    expect(resolve({ kind: 'use' }, { ...ctx(plan1, { ride: 'board' }), phase: 'launch' })).toBeNull();
  });

  it('D8: at a door with the machine in reach, E with a battery in hand aimed at it puts it in; otherwise the door', () => {
    const morning = until((m) => m.phase === 'morning');
    // a battery in hand, aiming at the machine → PUT (not the door)
    expect(resolve({ kind: 'use' }, ctx(plan1, { ride: 'enter', aim: 'ls', hands: 1 }))).toEqual({ action: { type: 'PUT', k: 'ls' } });
    expect(resolve({ kind: 'use' }, ctx(plan1, { ride: 'enter', aim: 'ws', hands: 2 }))).toEqual({ action: { type: 'PUT', k: 'ws' } });
    // no battery, too few, aiming at nothing or at the hub, or not planning → the door
    expect(resolve({ kind: 'use' }, ctx(plan1, { ride: 'enter', aim: 'ls', hands: 0 }))).toEqual({ ride: 'enter' });
    expect(resolve({ kind: 'use' }, ctx(plan1, { ride: 'enter', aim: 'ws', hands: 1 }))).toEqual({ ride: 'enter' });
    expect(resolve({ kind: 'use' }, ctx(plan1, { ride: 'enter', hands: 1 }))).toEqual({ ride: 'enter' });
    expect(resolve({ kind: 'use' }, ctx(plan1, { ride: 'enter', aim: 'hub', hands: 1 }))).toEqual({ ride: 'enter' });
    expect(resolve({ kind: 'use' }, ctx(morning, { ride: 'enter', aim: 'ls', hands: 1 }))).toEqual({ ride: 'enter' });
    // going out stays the door (inside, the module is always "aimed at")
    expect(resolve({ kind: 'use' }, ctx(plan1, { ride: 'leave', aim: 'ls', hands: 1 }))).toEqual({ ride: 'leave' });
    // no door in reach: exactly as before (the rover first, then the aim)
    expect(resolve({ kind: 'use' }, ctx(plan1, { ride: 'board', aim: 'ls', hands: 1 }))).toEqual({ ride: 'board' });
    expect(resolve({ kind: 'use' }, ctx(plan1, { aim: 'ls', hands: 1 }))).toEqual({ action: { type: 'PUT', k: 'ls' } });
  });

  it('home story: once the day has run, E at the habitat door is Sleep (NEXT, like the button); never while planning', () => {
    const ran = until((m) => m.phase === 'run');
    expect(resolve({ kind: 'use' }, ctx(ran, { ride: 'sleep' }))).toEqual({ action: { type: 'NEXT' } });
    expect(resolve({ kind: 'use' }, ctx(ran, { ride: 'sleep', overlay: 'map' }))).toBeNull(); // the map keeps its keys
    expect(resolve({ kind: 'use' }, ctx(plan1, { ride: 'sleep' }))).toEqual({ ride: 'sleep' }); // (the rig never offers it there)
  });

  it('E through the reducer adds exactly what a tap on the building adds', () => {
    const carrying = reducer(plan1, { type: 'TAKE' });
    const e = resolve({ kind: 'use' }, ctx(carrying, { aim: 'ls', hands: carrying.hands }));
    const byKey = reducer(carrying, (e as { action: never }).action);
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

import { describe, expect, it } from 'vitest';
import { board, initialModel, reducer, toView, truth, type Action, type Machine, type Model } from './game';
import { PLAN_A, week as realWeek } from '../engine/golden';
import { SKY, type Week } from '../engine/week';

const run = (m: Model, actions: Action[]) => actions.reduce(reducer, m);
const start = () => reducer(initialModel, { type: 'START', week: realWeek() });

/** Taps for one day of a plan: shelter and card first (they change the limits), then batteries. */
function dayActions(alloc: (typeof PLAN_A)[number]['alloc'], card?: string): Action[] {
  const taps: Action[] = [{ type: 'CHOOSE', shelter: alloc.shelter }];
  if (card) taps.push({ type: 'CHOOSE', card });
  const add = (k: Machine, n: number) => Array.from({ length: n }, () => ({ type: 'SET', k }) as Action);
  taps.push(...add('ls', alloc.ls), ...add('gh', alloc.gh), ...add('ws', alloc.build / 2), ...add('sc', alloc.sc));
  return taps;
}

describe('reducer flow', () => {
  it('starts the first mission in the morning of day 1 with Shadow and Ice dealt', () => {
    const m = start();
    expect(m.screen).toBe('game');
    expect(m.firstMission).toBe(true);
    expect(m.game?.cards.slice(1, 3)).toEqual(['shadow', 'ice']);
    expect(toView(m)).toMatchObject({ day: 1, phase: 'morning', plant: 3, wall: 0 });
  });

  it('gives the scene the real sky of the first mission week (sky.json)', () => {
    expect(toView(start(), SKY)).toMatchObject({ day: 1, sunAzDeg: 304, earthElDeg: 2.7, earthPhase: 0.2 });
  });

  it('taps add batteries only while planning, never past the batteries left', () => {
    let m = start();
    m = reducer(m, { type: 'SET', k: 'ls' });
    expect(m.alloc.ls).toBe(0); // morning: taps ignored
    m = run(m, [{ type: 'NEXT' }, ...Array.from({ length: 5 }, () => ({ type: 'SET', k: 'ls' }) as Action)]);
    expect(m.alloc.ls).toBe(3); // Life Support takes at most 3
    m = run(m, Array.from({ length: 6 }, () => ({ type: 'SET', k: 'sc' }) as Action));
    expect(m.alloc.sc).toBe(3);
    m = run(m, Array.from({ length: 3 }, () => ({ type: 'SET', k: 'gh' }) as Action));
    expect(m.alloc.gh).toBe(1); // 7 batteries: 3 + 3 + 1
    expect(m.preview?.left).toBe(0);
    expect(toView(m).batteries).toEqual({ left: 0, total: 7 });
    m = reducer(m, { type: 'SET', k: 'gh', delta: -1 });
    expect(m.alloc.gh).toBe(0); // undo is free until confirm
  });

  it('a card must be answered before the day can be confirmed', () => {
    let m = run(start(), [{ type: 'NEXT' }, ...dayActions(PLAN_A[0].alloc), { type: 'CONFIRM' }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' }]);
    expect(board(m)?.info.card).toBe('shadow');
    expect(reducer(m, { type: 'CONFIRM' }).phase).toBe('plan');
    m = run(m, [{ type: 'CHOOSE', card: 'shadow:heat' }, { type: 'CONFIRM' }]);
    expect(m.phase).toBe('run');
  });

  it('Plan A played through the reducer gives the engine result 7 / 14, 77 %, Balance Master', () => {
    let m = start();
    for (const d of PLAN_A) {
      m = run(m, [{ type: 'NEXT' }, ...dayActions(d.alloc, d.card)]);
      expect(m.alloc).toEqual(d.alloc);
      m = run(m, [{ type: 'CONFIRM' }, { type: 'NEXT' }]);
      if (m.phase === 'night') m = reducer(m, { type: 'NEXT' });
    }
    expect(m.phase).toBe('launch');
    const t = truth(m)!;
    expect(t.result).toMatchObject({ crew: 7, science: 14, title: 'Balance Master' });
    expect(Math.round(t.result.blockedPct)).toBe(77);
    expect(t.days.map((d) => d.level)).toEqual([0, 0, 0, 1, 2, 2, 1]);
    expect(reducer(reducer(m, { type: 'NEXT' }), { type: 'NEXT' }).screen).toBe('end');
  });

  it('choosing "everyone inside" takes the explorers and the workshop off the board', () => {
    let m = start();
    for (const d of PLAN_A.slice(0, 3)) m = run(m, [{ type: 'NEXT' }, ...dayActions(d.alloc, d.card), { type: 'CONFIRM' }, { type: 'NEXT' }, { type: 'NEXT' }]);
    m = run(m, [{ type: 'NEXT' }, { type: 'SET', k: 'sc' }, { type: 'SET', k: 'sc' }]);
    expect(board(m)?.info).toMatchObject({ storm: 'alert', choice: true, level: null });
    expect(m.alloc.sc).toBe(2);
    m = reducer(m, { type: 'CHOOSE', shelter: 'full' });
    expect(m.alloc).toMatchObject({ sc: 0, shelter: 'full' });
  });

  it('day 7 opens with four batteries on Launch; the view follows the real sky', () => {
    let m = start();
    for (const d of PLAN_A.slice(0, 6)) m = run(m, [{ type: 'NEXT' }, ...dayActions(d.alloc, d.card), { type: 'CONFIRM' }, { type: 'NEXT' }, { type: 'NEXT' }]);
    m = reducer(m, { type: 'NEXT' });
    expect(m.alloc.launch).toBe(4);
    expect(toView(m, SKY)).toMatchObject({ day: 7, sunAzDeg: 232, wall: 3 });
  });

  it('plays seven days to the truth screen pressing only the main button', () => {
    const empty: Week = { id: '2030-01-01', kind: 'quiet', days: realWeek().days.map((d) => ({ ...d, level: 0, alert: false })) };
    let m = reducer(initialModel, { type: 'START', week: empty, seed: 7 });
    for (let i = 0; i < 60 && m.phase !== 'truth'; i++) {
      const b = board(m);
      const card = b?.info.card;
      if (m.phase === 'plan' && card && !m.cardChoice && m.preview?.warning === 'engine.warn.chooseCard') {
        m = reducer(m, { type: 'CHOOSE', card: `${card}:${{ dust: 'brush', filter: 'swap', shadow: 'heat', ice: 'skip', tired: 'rest' }[card as string]}` });
      }
      m = reducer(m, m.phase === 'plan' ? { type: 'CONFIRM' } : { type: 'NEXT' });
    }
    expect(m.phase).toBe('truth');
    expect(truth(m)?.result.late).toBe(false); // day 7 opened with Launch filled
  });

  it('a saved model resumes where it stopped', () => {
    const m = run(start(), [{ type: 'NEXT' }, { type: 'SET', k: 'ls' }]);
    const saved = JSON.parse(JSON.stringify(m)) as Model;
    expect(reducer(initialModel, { type: 'RESUME', model: saved })).toEqual(m);
  });
});

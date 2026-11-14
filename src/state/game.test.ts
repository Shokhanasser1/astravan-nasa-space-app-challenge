import { describe, expect, it } from 'vitest';
import { initialModel, reducer, toView } from './game';
import type { Week } from '../engine/week';

const week: Week = { id: '2021-10-25', days: [] };

describe('reducer flow', () => {
  it('starts a game in the morning of day 1', () => {
    const m = reducer(initialModel, { type: 'START', week });
    expect(m.screen).toBe('game');
    expect(toView(m)).toMatchObject({ day: 1, phase: 'morning' });
  });

  it('taps add batteries only while planning; confirm moves to run', () => {
    let m = reducer(initialModel, { type: 'START', week });
    m = reducer(m, { type: 'SET', k: 'ls' });
    expect(m.alloc.ls).toBe(0); // morning: taps ignored
    m = reducer(m, { type: 'NEXT' });
    m = reducer(m, { type: 'SET', k: 'ls' });
    m = reducer(m, { type: 'SET', k: 'ws' });
    expect(toView(m).alloc).toMatchObject({ ls: 1, ws: 1 });
    m = reducer(m, { type: 'CONFIRM' });
    expect(m.phase).toBe('run');
  });

  it('plays seven days to the truth screen', () => {
    let m = reducer(initialModel, { type: 'START', week });
    for (let i = 0; i < 60 && m.phase !== 'truth'; i++) {
      m = reducer(m, m.phase === 'plan' ? { type: 'CONFIRM' } : { type: 'NEXT' });
    }
    expect(m.phase).toBe('truth');
  });
});

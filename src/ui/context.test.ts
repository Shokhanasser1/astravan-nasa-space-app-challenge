import { describe, expect, it } from 'vitest';
import { board, initialModel, reducer, type Action, type Model } from '../state/game';
import { week as realWeek } from '../engine/golden';
import { contextOf } from './play/Hands';

const run = (m: Model, actions: Action[]) => actions.reduce(reducer, m);
const plan = () => run(reducer(initialModel, { type: 'START', week: realWeek() }), [{ type: 'NEXT' }]);
const ctx = (m: Model, aim: Parameters<typeof contextOf>[2]) => contextOf(m, board(m), aim);

describe('context prompt (what E / ✋ and Q do here)', () => {
  it('offers TAKE at the hub and PUT at Life Support with the reducer’s own preview', () => {
    let m = plan();
    expect(ctx(m, 'hub')).toMatchObject({ prompt: { key: 'ui.prompt.take' }, act: { type: 'TAKE' }, back: null });
    expect(ctx(m, 'ls')).toMatchObject({ prompt: { key: 'ui.prompt.needOne' }, act: null });
    m = reducer(m, { type: 'TAKE' });
    const c = ctx(m, 'ls')!;
    expect(c.act).toEqual({ type: 'PUT', k: 'ls' });
    const after = reducer(m, { type: 'PUT', k: 'ls' });
    expect(c.fx).toEqual({ key: 'ui.prompt.fx.ls', vars: { from: m.preview!.reserveAfter, to: after.preview!.reserveAfter } });
    expect(ctx(after, 'ls')).toMatchObject({ back: { type: 'BACK', k: 'ls' } });
  });

  it('says the workshop is closed on Day 1 and needs two batteries when open', () => {
    const m = run(plan(), [{ type: 'TAKE' }]);
    expect(ctx(m, 'ws')?.prompt.key).toBe('ui.prompt.closed');
  });

  it('is quiet outside the plan, with no aim, and offers DROP with full hands', () => {
    expect(ctx(reducer(initialModel, { type: 'START', week: realWeek() }), 'hub')).toBeNull();
    expect(ctx(plan(), null)).toBeNull();
    const full = run(plan(), [{ type: 'TAKE' }, { type: 'TAKE' }, { type: 'TAKE' }, { type: 'TAKE' }]);
    expect(ctx(full, 'hub')).toMatchObject({ prompt: { key: 'ui.prompt.handsFull' }, act: null, back: { type: 'DROP' } });
  });
});

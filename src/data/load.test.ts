import { describe, expect, it } from 'vitest';
import { pickWeek } from './load';
import type { Week } from './types';

const w = (id: string, kind: Week['kind']): Week => ({ id, kind, days: [] });
const weeks = [w('2021-10-25', 'storm'), w('2020-06-01', 'quiet'), w('2017-09-04', 'hard')];

describe('pickWeek', () => {
  it('uses the class code from the URL', () => {
    expect(pickWeek(weeks, '?week=2020-06-01').id).toBe('2020-06-01');
  });

  it('allows a hard-mode week by class code', () => {
    expect(pickWeek(weeks, '?week=2017-09-04').id).toBe('2017-09-04');
  });

  it('never picks a hard-mode week at random', () => {
    for (const r of [0, 0.49, 0.5, 0.99]) {
      expect(pickWeek(weeks, '', () => r).kind).not.toBe('hard');
    }
  });

  it('ignores an unknown class code', () => {
    expect(pickWeek(weeks, '?week=1999-01-01', () => 0).id).toBe('2021-10-25');
  });
});

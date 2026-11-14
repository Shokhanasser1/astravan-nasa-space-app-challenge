import { describe, expect, it } from 'vitest';
import { engine, ENGINE_IS_PLACEHOLDER } from './index';

/**
 * Golden tests from concept v2, section 10: one real week (25–31 October 2021), three commanders.
 * Samandar: when the real engine is in, add the three day-by-day plans from the concept and remove `.skipIf`.
 */
describe.skipIf(ENGINE_IS_PLACEHOLDER)('engine golden plans, week 2021-10-25', () => {
  it.todo('Plan A gives Crew 7, Science 14');
  it.todo('Plan B (no wall, no shelter, three moonwalks a day) gives Crew 3, Science 19');
  it.todo('Plan C gives Crew 8, Science 9');
});

describe('engine contract', () => {
  const week = { id: '2021-10-25', kind: 'storm', days: [] } as never;
  const settings = { level: 'pilot', batteriesPerDay: 6 } as const;

  it('starts on day 1 and is deterministic for the same seed', () => {
    const a = engine.startGame({ week, settings, seed: 42 });
    const b = engine.startGame({ week, settings, seed: 42 });
    expect(a.day).toBe(1);
    expect(a).toEqual(b);
  });

  it('preview spends nothing; confirm returns a new state', () => {
    const s = engine.startGame({ week, settings });
    const plan = { batteries: { lifeSupport: 2, garden: 1, workshop: 2, explore: 1 } };
    const p = engine.previewDay(s, plan);
    expect(p.batteriesLeft).toBe(0);
    expect(s.day).toBe(1);
    const next = engine.confirmDay(s, plan);
    expect(next).not.toBe(s);
    expect(next.day).toBe(2);
  });

  it('rejects a plan with more batteries than the day has', () => {
    const s = engine.startGame({ week, settings });
    const p = engine.previewDay(s, { batteries: { explore: 7 } });
    expect(p.valid).toBe(false);
  });
});

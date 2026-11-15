import { describe, expect, it } from 'vitest';
import { ambienceFor, breathCycle } from './ambience';

describe('ambience', () => {
  it('breathes in the suit outside, hums inside, stays quiet off the Moon', () => {
    expect(ambienceFor('game', 'plan')).toBe('suit');
    expect(ambienceFor('game', 'run')).toBe('suit');
    expect(ambienceFor('game', 'morning')).toBe('inside');
    expect(ambienceFor('game', 'night')).toBe('inside');
    expect(ambienceFor('game', 'launch')).toBe('off');
    expect(ambienceFor('game', 'truth')).toBe('off');
    expect(ambienceFor('start', 'plan')).toBe('off');
  });

  it('breathes faster when the radiation is up, never faster than 3.6 s a breath', () => {
    expect(breathCycle(0)).toBeCloseTo(5.2);
    expect(breathCycle(2)).toBeCloseTo(4.4);
    expect(breathCycle(9)).toBeCloseTo(3.6);
  });
});

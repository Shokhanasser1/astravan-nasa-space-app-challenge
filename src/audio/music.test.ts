import { describe, expect, it } from 'vitest';
import { musicFor } from './music';

describe('music for the moment', () => {
  it('is calm at the desk and on quiet days, the finale at the launch and the reveal', () => {
    expect(musicFor('start', 'morning', 0, false, null)).toBe('calm');
    expect(musicFor('game', 'plan', 0, false, null)).toBe('calm');
    expect(musicFor('game', 'launch', 1, false, null)).toBe('finale');
    expect(musicFor('game', 'truth', 0, false, null)).toBe('finale');
    expect(musicFor('end', 'truth', 0, false, null)).toBe('finale');
  });

  it('turns tense on an alert or storm day, and while a stormy hour is played', () => {
    expect(musicFor('game', 'plan', 0, true, null)).toBe('storm');
    expect(musicFor('game', 'night', 2, false, null)).toBe('storm');
    // the running day follows the measured hour: calm morning, storm after the particles arrive
    expect(musicFor('game', 'run', 1, true, 0)).toBe('calm');
    expect(musicFor('game', 'run', 1, true, 2)).toBe('storm');
  });
});

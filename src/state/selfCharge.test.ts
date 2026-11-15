import { describe, expect, it, vi } from 'vitest';

// The home story switched off: the game as before it (Day 7 opens with the ship already charged).
vi.mock('../config/features', async (load) => {
  const real = await load<typeof import('../config/features')>();
  return { ...real, features: { ...real.features, homeStory: false } };
});

const { reducer, selfCharge } = await import('./game');
const { demoModel } = await import('./demo');

describe('flag off: the ship charges itself, as before', () => {
  it('Day 7 opens with four batteries on Launch', () => {
    expect(selfCharge).toBe(true);
    expect(reducer(demoModel('launch')!, { type: 'NEXT' }).alloc.launch).toBe(4);
  });
});

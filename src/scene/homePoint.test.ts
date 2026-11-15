import { describe, expect, it } from 'vitest';
import { homePoint, phasePoint } from './points';

describe('home story: where the day is spent (homePoint)', () => {
  it('wakes inside from Day 2 (Day 1 begins outside, as before) and sleeps inside', () => {
    expect(homePoint('morning', 1, false, true)).toBe(phasePoint('morning'));
    for (let d = 2; d <= 7; d++) expect(homePoint('morning', d, false, true)).toBe('inside');
    expect(homePoint('night', 3, false, true)).toBe('inside');
  });

  it('goes out at the airlock for the plan (the first-person rig: to the hub), and the day runs where it is', () => {
    expect(homePoint('plan', 3, false, true)).toBe('airlock');
    expect(homePoint('plan', 3, false, false)).toBe('hub');
    expect(homePoint('run', 3, false, true)).toBeNull();
  });

  it('inside all day (stay inside, the backup tank): the plan and the day stay inside', () => {
    expect(homePoint('plan', 5, true, true)).toBe('inside');
    expect(homePoint('run', 5, true, true)).toBe('inside');
    expect(homePoint('plan', 5, true, false)).toBe('inside');
  });

  it('leaves the launch and the truth screen as they were', () => {
    for (const ph of ['launch', 'truth']) expect(homePoint(ph, 7, false, true)).toBe(phasePoint(ph));
  });
});

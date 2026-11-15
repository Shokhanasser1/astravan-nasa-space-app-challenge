import { describe, expect, it } from 'vitest';
import { doseFor, hourAt, levelOf, ratioAt, runMs, utcHour } from './runClock';
import weeks from '../engine/weeks.json';

// The first mission's storm day, as measured: calm until the X1.0 flare (15:35 UTC) and the particles (16:16).
const day4 = (weeks as unknown as { weeks: { id: string; days: { day: number; ratio: number; hourly?: (number | null)[] }[] }[] }).weeks
  .find((w) => w.id === '2021-10-25')!
  .days.find((d) => d.day === 4)!;

describe('the real day, hour by hour', () => {
  it('uses the same level bands as the week builder', () => {
    expect([1, 2, 9.9, 10, 99, 100, 1000, 5000].map(levelOf)).toEqual([0, 1, 1, 2, 2, 3, 4, 4]);
  });

  it('plays 24 hours over the run, in order', () => {
    expect(hourAt(0, 6000)).toBe(0);
    expect(hourAt(3000, 6000)).toBe(12);
    expect(hourAt(9000, 6000)).toBeLessThan(24);
  });

  it('follows the measured hours of 28 Oct 2021: calm in the morning, the storm after 16 UTC', () => {
    expect(day4.hourly).toHaveLength(24);
    expect(levelOf(ratioAt(day4.hourly, 10, day4.ratio))).toBe(0);
    expect(levelOf(ratioAt(day4.hourly, 20.5, day4.ratio))).toBe(2);
    // a missing reading keeps the last one
    expect(ratioAt([1, null, null], 2.5, 9)).toBe(1);
    expect(ratioAt([null, null], 1, 9)).toBe(9);
  });

  it('does not let the plan hear a storm that comes in the afternoon', () => {
    expect(doseFor('plan', day4.hourly, day4.ratio)).toBeLessThan(2);
    expect(doseFor('night', day4.hourly, day4.ratio)).toBeGreaterThan(10);
    expect(doseFor('plan', undefined, 3)).toBe(3);
  });

  it('gives a storm day the longer run', () => {
    expect(runMs(day4.hourly)).toBe(6000);
    expect(runMs([1, 1, 1.2])).toBe(4000);
    expect(utcHour('15:35')).toBeCloseTo(15.583, 2);
  });
});

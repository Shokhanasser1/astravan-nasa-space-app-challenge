import { describe, expect, it } from 'vitest';
import sheet from '../../../public/data/facts.json';
import { DATED_FACTS, NIGHT_FACTS, factUnit, factValue, loadFacts, nightFactId, type Fact } from './night-facts';

const FACTS = (sheet as unknown as { facts: Fact[] }).facts;

describe('one fact a night', () => {
  it("follows the document's order, Day 1 to Day 7", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(nightFactId)).toEqual([
      'moonGravity', 'coldCrater', 'iceCrater', 'donkiFlare', 'stormPeak', 'noAir', 'moonDistance',
    ]);
    expect(nightFactId(0)).toBe('moonGravity');
    expect(nightFactId(9)).toBe('moonDistance');
  });

  it('finds every night fact in facts.json with a value, a mark and a named source', () => {
    for (const id of NIGHT_FACTS) {
      const f = FACTS.find((x) => x.id === id);
      expect(f, id).toBeDefined();
      expect(['measured', 'computed', 'rule', 'story']).toContain(f!.label);
      expect(f!.source.title.trim().length, id).toBeGreaterThan(0);
      expect(f!.key).toBe(`data.fact.${id}`);
    }
    expect(DATED_FACTS.has('donkiFlare')).toBe(true);
  });

  it('writes values for people', () => {
    expect(factValue(1.62, 'm/s²')).toBe('1.62');
    expect(factValue(384400, 'km')).toBe('384,400');
    expect(factValue(384400, 'km', 'ru').replace(/\s/g, ' ')).toBe('384 400');
    expect(factValue(3e-15, 'bar')).toBe('3 × 10⁻¹⁵');
    expect(factValue(2009, 'year')).toBe('2009');
    expect(factUnit('year')).toBe('');
    expect(factValue('X1.0', 'flare class')).toBe('X1.0');
    expect(factValue(-248, '°C')).toBe('-248');
  });

  it('loads the sheet lazily, once', async () => {
    const a = await loadFacts();
    expect(a?.map((f) => f.id)).toEqual(FACTS.map((f) => f.id));
    expect(loadFacts()).toBe(loadFacts());
  });
});

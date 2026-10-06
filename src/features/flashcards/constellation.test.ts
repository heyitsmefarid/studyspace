import { describe, expect, it } from 'vitest';
import { constellationLayout, hashString } from './constellation';

describe('constellationLayout', () => {
  it('is deterministic and stays inside the box with padding', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `card-${i}`);
    const a = constellationLayout(ids, 300, 160);
    expect(a).toEqual(constellationLayout(ids, 300, 160));
    for (const p of a) {
      expect(p.x).toBeGreaterThanOrEqual(8); expect(p.x).toBeLessThanOrEqual(292);
      expect(p.y).toBeGreaterThanOrEqual(8); expect(p.y).toBeLessThanOrEqual(152);
    }
  });
  it('hashString is stable', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });
});

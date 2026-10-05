import { describe, expect, it } from 'vitest';
import { mulberry32, sample, shuffle } from './random';

describe('random', () => {
  it('is deterministic for a seed', () => {
    expect(shuffle([1, 2, 3, 4, 5], mulberry32(7))).toEqual(shuffle([1, 2, 3, 4, 5], mulberry32(7)));
  });
  it('shuffle keeps all items and does not mutate', () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src, mulberry32(1));
    expect([...out].sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });
  it('sample returns n unique items (or all when n is larger)', () => {
    expect(new Set(sample([1, 2, 3, 4, 5], 3, mulberry32(2))).size).toBe(3);
    expect(sample([1, 2], 5, mulberry32(2))).toHaveLength(2);
  });
});

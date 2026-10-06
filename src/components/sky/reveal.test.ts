import { describe, expect, it } from 'vitest';
import { revealAlpha } from './reveal';

describe('revealAlpha', () => {
  it('lights stars one after another across the duration', () => {
    expect(revealAlpha(0, 10, 0, 800)).toBe(0);
    expect(revealAlpha(0, 10, 200, 800)).toBe(1);
    expect(revealAlpha(9, 10, 200, 800)).toBe(0);
    expect(revealAlpha(9, 10, 800, 800)).toBe(1);
  });
  it('is fully lit for zero duration or a single star', () => {
    expect(revealAlpha(3, 10, 0, 0)).toBe(1);
    expect(revealAlpha(0, 1, 800, 800)).toBe(1);
  });
});

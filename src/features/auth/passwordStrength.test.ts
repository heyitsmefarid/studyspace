import { describe, expect, it } from 'vitest';
import { passwordStrength, STRENGTH_LABELS } from './passwordStrength';

describe('passwordStrength', () => {
  it.each([
    ['', 0], ['abc', 0], ['abcdefgh', 1], ['abcdefghijkl', 2], ['abcdefghIJKL', 3], ['abcdefghIJK1', 4], ['abcdefghIJ1!', 5],
  ] as const)('%j → %i', (pw, score) => {
    expect(passwordStrength(pw)).toBe(score);
  });
  it('has a label per score', () => {
    expect(STRENGTH_LABELS).toHaveLength(6);
  });
});

import { describe, expect, it } from 'vitest';
import { prefersReducedMotion } from './motion';

const win = (matches: boolean) => ({ matchMedia: () => ({ matches }) }) as unknown as Window;

describe('prefersReducedMotion', () => {
  it('reads the media query and is false without matchMedia', () => {
    expect(prefersReducedMotion(win(true))).toBe(true);
    expect(prefersReducedMotion(win(false))).toBe(false);
    expect(prefersReducedMotion({} as Window)).toBe(false);
  });
});

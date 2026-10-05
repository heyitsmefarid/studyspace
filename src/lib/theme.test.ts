import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('follows the OS for system', () => {
    expect(resolveTheme('system', true)).toBe('night');
    expect(resolveTheme('system', false)).toBe('daybreak');
  });
  it('honours explicit choices', () => {
    expect(resolveTheme('night', false)).toBe('night');
    expect(resolveTheme('daybreak', true)).toBe('daybreak');
  });
});

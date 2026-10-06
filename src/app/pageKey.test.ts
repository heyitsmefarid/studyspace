import { describe, expect, it } from 'vitest';
import { pageKey } from './pageKey';

// Review Focus #2 is pinned by routes.test.ts (real route matching); this covers the key itself.
describe('pageKey', () => {
  it('uses the deepest matched route id', () => {
    expect(pageKey([{ id: '0' }, { id: '0-1' }, { id: '0-1-7' }])).toBe('0-1-7');
  });
  it('falls back to root', () => {
    expect(pageKey([])).toBe('root');
  });
});

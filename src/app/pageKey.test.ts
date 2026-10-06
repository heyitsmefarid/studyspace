import { describe, expect, it } from 'vitest';
import { pageKey } from './pageKey';

// Review Focus #2: same-route navigations must not remount (tutor chat creation, note-to-note, planner views).
describe('pageKey', () => {
  it('uses the deepest matched route id', () => {
    expect(pageKey([{ id: '0' }, { id: '0-1' }, { id: '0-1-7' }])).toBe('0-1-7');
  });
  it('is identical for /tutor and /tutor/:id (one optional-segment route)', () => {
    const tutor = [{ id: '0' }, { id: '0-1' }, { id: '0-1-12' }];
    expect(pageKey(tutor)).toBe(pageKey([...tutor]));
  });
  it('falls back to root', () => {
    expect(pageKey([])).toBe('root');
  });
});

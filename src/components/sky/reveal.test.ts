import { describe, expect, it } from 'vitest';
import { revealAlpha, revealClock } from './reveal';

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

// Deferred U2: a redraw during the draw-in (resize, data refresh) must continue the reveal, not restart or skip it.
describe('revealClock', () => {
  it('starts on the first paint that has stars', () => {
    expect(revealClock(null, true, true, 1000)).toBe(1000);
  });
  it('keeps the original start on later redraws', () => {
    expect(revealClock(1000, true, true, 1500)).toBe(1000);
  });
  it('waits for stars before starting', () => {
    expect(revealClock(null, true, false, 1000)).toBeNull();
  });
  it('never starts when the reveal is off', () => {
    expect(revealClock(null, false, true, 1000)).toBeNull();
  });
});

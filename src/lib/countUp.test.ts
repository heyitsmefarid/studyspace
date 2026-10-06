import { describe, expect, it } from 'vitest';
import { countUpValue } from './countUp';

describe('countUpValue', () => {
  it('eases from 0 to the target and lands exactly', () => {
    expect(countUpValue(120, 0, 900)).toBe(0);
    expect(countUpValue(120, 450, 900)).toBeGreaterThan(60); // ease-out: past halfway at half time
    expect(countUpValue(120, 900, 900)).toBe(120);
    expect(countUpValue(120, 5000, 900)).toBe(120);
  });
  it('handles zero, negative and a zero duration', () => {
    expect(countUpValue(0, 300, 900)).toBe(0);
    expect(countUpValue(-40, 900, 900)).toBe(-40);
    expect(countUpValue(75, 0, 0)).toBe(75); // reduced motion jumps to target
  });
});

// Deferred U1: a number that changes (XP after a save) should count on from where it was, not restart at 0.
describe('countUpValue from a previous value', () => {
  it('eases from `from` to the target', () => {
    expect(countUpValue(150, 0, 900, 100)).toBe(100);
    expect(countUpValue(150, 450, 900, 100)).toBeGreaterThan(125);
    expect(countUpValue(150, 900, 900, 100)).toBe(150);
  });
  it('counts down too', () => {
    expect(countUpValue(10, 0, 900, 50)).toBe(50);
    expect(countUpValue(10, 900, 900, 50)).toBe(10);
  });
});

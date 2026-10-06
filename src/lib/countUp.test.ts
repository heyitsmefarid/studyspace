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

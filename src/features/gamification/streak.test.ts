import { describe, expect, it } from 'vitest';
import { effectiveStreak, todayInZone } from './streak';

describe('todayInZone', () => {
  it('uses the local calendar day (00:30 Manila = 16:30Z previous day)', () => {
    expect(todayInZone('Asia/Manila', new Date('2026-10-05T16:30:00Z'))).toBe('2026-10-06');
  });
  it('falls back to Asia/Manila for an invalid zone', () => {
    expect(todayInZone('Not/AZone', new Date('2026-10-05T16:30:00Z'))).toBe('2026-10-06');
  });
});

describe('effectiveStreak', () => {
  it('keeps the streak if active today or yesterday', () => {
    expect(effectiveStreak(5, '2026-10-06', '2026-10-06')).toBe(5);
    expect(effectiveStreak(5, '2026-10-05', '2026-10-06')).toBe(5);
  });
  it('shows 0 once a day was missed or never active', () => {
    expect(effectiveStreak(5, '2026-10-04', '2026-10-06')).toBe(0);
    expect(effectiveStreak(0, null, '2026-10-06')).toBe(0);
  });
});

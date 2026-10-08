import { describe, expect, it } from 'vitest';
import { dayKey, dayLabel, groupByDay } from './days';

const TZ = 'Asia/Manila'; // UTC+8, no DST

describe('dayKey', () => {
  it('splits at local midnight, not UTC midnight', () => {
    // 23:59 and 00:01 Manila time are both 2026-10-05 in UTC
    expect(dayKey('2026-10-05T15:59:00Z', TZ)).toBe('2026-10-05');
    expect(dayKey('2026-10-05T16:01:00Z', TZ)).toBe('2026-10-06');
  });
});

describe('dayLabel', () => {
  it('names today and yesterday, then dates', () => {
    expect(dayLabel('2026-10-08', '2026-10-08')).toBe('Today');
    expect(dayLabel('2026-10-07', '2026-10-08')).toBe('Yesterday');
    expect(dayLabel('2026-10-05', '2026-10-08')).toBe('Mon, Oct 5');
  });
});

describe('groupByDay', () => {
  it('keeps order and starts a group whenever the local day changes', () => {
    const items = ['2026-10-08T01:00:00Z', '2026-10-07T17:00:00Z', '2026-10-07T15:00:00Z'];
    const groups = groupByDay(items, (i) => i, TZ, new Date('2026-10-08T02:00:00Z'));
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([['Today', 2], ['Yesterday', 1]]);
  });
});

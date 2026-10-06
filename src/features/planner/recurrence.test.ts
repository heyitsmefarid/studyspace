import { describe, expect, it } from 'vitest';
import { expandOccurrences, type RecurringLike } from './recurrence';

const local = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min);
const task = (id: string, at: Date | null, recurrence = 'none', until: string | null = null): RecurringLike =>
  ({ id, due_at: at ? at.toISOString() : null, start_at: null, recurrence, recurrence_until: until });
const dates = (occ: { date: string }[]) => occ.map((o) => o.date);

describe('expandOccurrences', () => {
  it('includes one-off tasks only inside the range and skips undated tasks', () => {
    const out = expandOccurrences([task('in', local(2026, 10, 7)), task('out', local(2026, 11, 7)), task('none', null)], local(2026, 10, 1, 0), local(2026, 11, 1, 0));
    expect(out.map((o) => o.task.id)).toEqual(['in']);
  });
  it('expands daily tasks and honours the until date', () => {
    expect(dates(expandOccurrences([task('d', local(2026, 10, 5), 'daily', '2026-10-08')], local(2026, 10, 1, 0), local(2026, 10, 31, 0))))
      .toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']);
  });
  it('fast-forwards old daily anchors to the range', () => {
    expect(dates(expandOccurrences([task('d', local(2025, 1, 1), 'daily')], local(2026, 10, 6, 0), local(2026, 10, 8, 0))))
      .toEqual(['2026-10-06', '2026-10-07']);
  });
  it('weekdays skip Saturday and Sunday', () => {
    expect(dates(expandOccurrences([task('w', local(2026, 10, 5), 'weekdays')], local(2026, 10, 5, 0), local(2026, 10, 12, 0))))
      .toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
  });
  it('weekly repeats on the same weekday', () => {
    expect(dates(expandOccurrences([task('w', local(2026, 10, 6), 'weekly')], local(2026, 10, 1, 0), local(2026, 11, 1, 0))))
      .toEqual(['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27']);
  });
  it('monthly on the 31st clamps to month end without drifting', () => {
    expect(dates(expandOccurrences([task('m', local(2027, 1, 31), 'monthly')], local(2027, 1, 1, 0), local(2027, 5, 1, 0))))
      .toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
    expect(dates(expandOccurrences([task('m', local(2028, 1, 31), 'monthly')], local(2028, 2, 1, 0), local(2028, 3, 1, 0))))
      .toEqual(['2028-02-29']);
  });
  it('keeps the time of day and sorts across tasks', () => {
    const out = expandOccurrences([task('late', local(2026, 10, 6, 20), 'daily'), task('early', local(2026, 10, 6, 7), 'daily')], local(2026, 10, 6, 0), local(2026, 10, 7, 0));
    expect(out.map((o) => [o.task.id, o.at.getHours()])).toEqual([['early', 7], ['late', 20]]);
  });
});

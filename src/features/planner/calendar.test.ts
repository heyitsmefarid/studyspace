import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { countdownLabel, groupByDate, rangeFor, resolveDateKey, shiftDate } from './calendar';

const key = (d: Date) => format(d, 'yyyy-MM-dd');

describe('resolveDateKey', () => {
  it.each(['2026-10-06', '2024-02-29', '2000-02-29'])('keeps the valid calendar date %s', (date) => {
    expect(resolveDateKey(date, '2026-10-09')).toBe(date);
  });

  it.each([null, '', 'not-a-date', '2026-2-03', '2026-10-06T12:00:00', '2026-99-99', '2026-00-10', '2026-10-00', '2026-02-29', '1900-02-29', '2026-04-31'])('falls back to today for an invalid calendar date: %s', (date) => {
    const dateKey = resolveDateKey(date, '2026-10-09');
    expect(dateKey).toBe('2026-10-09');
    for (const view of ['month', 'week', 'day'] as const) {
      expect(rangeFor(view, dateKey).days.map(key)).toContain('2026-10-09');
      expect(() => shiftDate(view, dateKey, 1)).not.toThrow();
    }
  });
});

describe('rangeFor', () => {
  it('month view covers whole weeks around the month (Sunday start, end exclusive)', () => {
    const r = rangeFor('month', '2026-10-06');
    expect(key(r.start)).toBe('2026-09-27');
    expect(key(r.end)).toBe('2026-11-01');
    expect(r.days).toHaveLength(35);
    expect(r.days.map(key)).toContain('2026-10-31');
  });
  it('week and day views', () => {
    const w = rangeFor('week', '2026-10-06');
    expect([key(w.start), key(w.end), w.days.length]).toEqual(['2026-10-04', '2026-10-11', 7]);
    const d = rangeFor('day', '2026-10-06');
    expect([key(d.start), key(d.end), d.days.length]).toEqual(['2026-10-06', '2026-10-07', 1]);
  });
});

describe('shiftDate', () => {
  it('moves by the view unit', () => {
    expect(shiftDate('month', '2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftDate('week', '2026-10-06', -1)).toBe('2026-09-29');
    expect(shiftDate('day', '2026-10-31', 1)).toBe('2026-11-01');
  });
});

describe('groupByDate', () => {
  it('groups occurrences by their date, keeping order', () => {
    const m = groupByDate([{ date: 'a', n: 1 }, { date: 'b', n: 2 }, { date: 'a', n: 3 }]);
    expect(m.get('a')?.map((o) => o.n)).toEqual([1, 3]);
    expect(m.get('b')).toHaveLength(1);
  });
});

describe('countdownLabel', () => {
  const now = new Date(2026, 9, 6, 15);
  it('labels days left', () => {
    expect(countdownLabel(new Date(2026, 9, 6, 9), now)).toBe('Today');
    expect(countdownLabel(new Date(2026, 9, 7), now)).toBe('Tomorrow');
    expect(countdownLabel(new Date(2026, 9, 10), now)).toBe('In 4 days');
    expect(countdownLabel(new Date(2026, 9, 1), now)).toBe('Past');
  });
});

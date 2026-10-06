import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { countdownLabel, groupByDate, rangeFor, shiftDate } from './calendar';

const key = (d: Date) => format(d, 'yyyy-MM-dd');

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

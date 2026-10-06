import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  filters: [] as [string, unknown][],
  row: null as unknown,
  error: null as unknown,
}));

vi.mock('@/lib/supabase', () => {
  const q = {
    select: () => q,
    eq: (col: string, v: unknown) => { db.filters.push([col, v]); return q; },
    maybeSingle: async () => ({ data: db.row, error: db.error }),
  };
  return { supabase: { from: (table: string) => { db.filters.push(['table', table]); return q; } } };
});

import { attemptXp } from './api';

// Review P5: the results page always claimed "+20 XP", even when the daily cap meant none was awarded.
describe('attemptXp', () => {
  beforeEach(() => { db.filters.length = 0; db.row = null; db.error = null; });

  it('reads the XP the server awarded for this attempt', async () => {
    db.row = { amount: 20 };
    await expect(attemptXp('att-1')).resolves.toBe(20);
    expect(db.filters).toEqual([['table', 'xp_events'], ['reason', 'quiz_completed'], ['ref', 'att-1']]);
  });

  it('is 0 when no XP was awarded (daily cap reached)', async () => {
    await expect(attemptXp('att-1')).resolves.toBe(0);
  });

  it('surfaces a read error', async () => {
    db.error = { code: 'PGRST301', message: 'JWT expired' };
    await expect(attemptXp('att-1')).rejects.toThrow();
  });
});

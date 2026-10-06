import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  calls: [] as unknown[][],
  result: { data: null, error: null } as { data: unknown; error: unknown },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      upsert: (row: unknown, opts: unknown) => { db.calls.push([table, row, opts]); return Promise.resolve(db.result); },
    }),
  },
}));

import { completeTaskOccurrence } from './api';

// Review P12: the study summary ignored a failed planner tick, so the task silently stayed open.
describe('completeTaskOccurrence', () => {
  beforeEach(() => { db.calls.length = 0; db.result = { data: null, error: null }; });

  it('ticks the occurrence off, treating an existing completion as done', async () => {
    await completeTaskOccurrence('t1', 'u1', '2026-10-06');
    expect(db.calls).toEqual([[
      'task_completions',
      { task_id: 't1', user_id: 'u1', occurrence_date: '2026-10-06' },
      { onConflict: 'task_id,occurrence_date', ignoreDuplicates: true },
    ]]);
  });

  it('reports a failed tick instead of swallowing it', async () => {
    db.result = { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } };
    await expect(completeTaskOccurrence('t1', 'u1', '2026-10-06')).rejects.toThrow();
  });
});

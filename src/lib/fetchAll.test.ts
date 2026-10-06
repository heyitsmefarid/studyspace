import { describe, expect, it, vi } from 'vitest';
import { fetchAll } from './fetchAll';

// Review I3: PostgREST returns at most 1000 rows per request with no error, so unbounded reads must page.
describe('fetchAll', () => {
  const rows = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
  const page = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null }));

  it('pages until a short page and returns every row in order', async () => {
    const all = await fetchAll(page);
    expect(all).toHaveLength(2500);
    expect(all.at(-1)).toEqual({ id: 2499 });
    expect(page.mock.calls.map(([from, to]) => [from, to])).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('throws a friendly AppError when a page fails', async () => {
    await expect(fetchAll(async () => ({ data: null, error: { code: '42501', message: 'permission denied' } })))
      .rejects.toThrow("You don't have permission to do that.");
  });
});

import { AppError, friendlyMessage } from './errors';

type Page<T> = { data: T[] | null; error: { code?: string; message?: string } | null };

/**
 * Reads every row of a query. PostgREST silently caps a response at 1000 rows, so unbounded reads page with
 * `.range(from, to)` until a short page. The query must have a stable order (e.g. `.order('id')`).
 */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<Page<T>>, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const res = await page(from, from + pageSize - 1);
    if (res.error) throw new AppError(friendlyMessage(res.error), res.error.code, res.error);
    const rows = res.data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) return out;
  }
}

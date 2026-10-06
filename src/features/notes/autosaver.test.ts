import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosaver, type SaveStatus } from './autosaver';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => { resolve = res; });
  return { promise, resolve };
};

describe('createAutosaver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces bursts into one save of the latest value', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const s = createAutosaver<string>({ save, delay: 1000 });
    s.push('a'); s.push('ab'); s.push('abc');
    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith('abc');
    expect(s.status).toBe('saved');
  });

  it('never runs saves concurrently and always ends with the newest value', async () => {
    const first = deferred();
    let active = 0; let maxActive = 0;
    const save = vi.fn(async (v: string) => {
      active++; maxActive = Math.max(maxActive, active);
      if (v === 'v1') await first.promise;
      active--;
    });
    const s = createAutosaver<string>({ save, delay: 100 });
    s.push('v1');
    await vi.advanceTimersByTimeAsync(100);
    s.push('v2'); s.push('v3');
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve();
    await vi.advanceTimersByTimeAsync(200);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('v3');
    expect(maxActive).toBe(1);
    expect(s.status).toBe('saved');
  });

  it('marks error, keeps edits made after the failure, and retries with the latest value', async () => {
    const statuses: SaveStatus[] = [];
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const s = createAutosaver<string>({ save, delay: 100, retryDelays: [2000], onStatus: (x) => statuses.push(x) });
    s.push('draft');
    await vi.advanceTimersByTimeAsync(100);
    expect(s.status).toBe('error');
    s.push('draft + more');
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenLastCalledWith('draft + more');
    expect(s.status).toBe('saved');
    expect(statuses).toContain('error');
  });

  it('flush saves pending changes immediately', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const s = createAutosaver<string>({ save, delay: 5000 });
    s.push('x');
    await s.flush();
    expect(save).toHaveBeenCalledWith('x');
    expect(s.dirty).toBe(false);
  });
});

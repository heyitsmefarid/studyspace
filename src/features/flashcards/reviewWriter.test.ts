import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReviewWriter, REVIEW_GAP_MS, reviewDelayMs } from './reviewWriter';

// Review P3: an "Again" card that comes straight back and is graded within 2 s tripped the server's repeat guard
// ("That card was just reviewed."), so that review was lost.
describe('reviewDelayMs', () => {
  it('needs no wait for a card that has not been written', () => {
    expect(reviewDelayMs(undefined, 5_000)).toBe(0);
  });
  it('waits out the rest of the gap after the previous write finished', () => {
    expect(reviewDelayMs(10_000, 10_500)).toBe(REVIEW_GAP_MS - 500);
    expect(reviewDelayMs(10_000, 10_000 + REVIEW_GAP_MS + 1)).toBe(0);
  });
  it('keeps a margin over the server guard of 2 s', () => {
    expect(REVIEW_GAP_MS).toBeGreaterThan(2_000);
  });
});

describe('createReviewWriter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('writes a card straight away the first time', async () => {
    const w = createReviewWriter(vi.fn());
    const write = vi.fn(async () => {});
    w.enqueue('c1', write);
    await vi.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenCalledOnce();
  });

  it('holds a second write for the same card until the gap has passed', async () => {
    const w = createReviewWriter(vi.fn());
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});
    w.enqueue('c1', first);
    await vi.advanceTimersByTimeAsync(0);
    w.enqueue('c1', second);
    await vi.advanceTimersByTimeAsync(REVIEW_GAP_MS - 1);
    expect(second).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(second).toHaveBeenCalledOnce();
  });

  it('does not hold writes for different cards', async () => {
    const w = createReviewWriter(vi.fn());
    const a = vi.fn(async () => {});
    const b = vi.fn(async () => {});
    w.enqueue('c1', a);
    w.enqueue('c2', b);
    await vi.advanceTimersByTimeAsync(0);
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('flush resolves once every pending write has landed', async () => {
    const w = createReviewWriter(vi.fn());
    const landed: string[] = [];
    w.enqueue('c1', async () => { landed.push('first'); });
    w.enqueue('c1', async () => { landed.push('second'); });
    let flushed = false;
    void w.flush().then(() => { flushed = true; });
    await vi.advanceTimersByTimeAsync(REVIEW_GAP_MS - 10);
    expect(flushed).toBe(false);
    await vi.advanceTimersByTimeAsync(10);
    expect(landed).toEqual(['first', 'second']);
    expect(flushed).toBe(true);
  });

  it('reports a failed write and still runs the next one', async () => {
    const onError = vi.fn();
    const w = createReviewWriter(onError);
    const next = vi.fn(async () => {});
    w.enqueue('c1', async () => { throw new Error('offline'); });
    w.enqueue('c1', next);
    await vi.advanceTimersByTimeAsync(REVIEW_GAP_MS);
    expect(onError).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    await expect(w.flush()).resolves.toBeUndefined();
  });
});

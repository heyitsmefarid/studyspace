import { describe, expect, it } from 'vitest';
import { buildQueue, DAY, deckMastery, NEW_PROGRESS, previewIntervals, requeueOffset, schedule, stateFor, type Progress } from './srs';
import { mulberry32 } from '@/lib/random';

const now = new Date('2026-10-06T10:00:00Z');
const review = (intervalMinutes: number, ease = 2.5): Progress => ({ ...NEW_PROGRESS, intervalMinutes, ease, repetitions: 3, reviewCount: 3, state: stateFor(intervalMinutes, 3) });

describe('schedule — new cards', () => {
  it('Good → 1 day, reviewing, counted correct', () => {
    const p = schedule(NEW_PROGRESS, 2, now);
    expect(p.intervalMinutes).toBe(DAY);
    expect(p.state).toBe('reviewing');
    expect(p.dueAt).toBe('2026-10-07T10:00:00.000Z');
    expect([p.reviewCount, p.correctCount, p.incorrectCount]).toEqual([1, 1, 0]);
  });
  it('Again → 10 minutes, learning, counted incorrect', () => {
    const p = schedule(NEW_PROGRESS, 0, now);
    expect(p.intervalMinutes).toBe(10);
    expect(p.state).toBe('learning');
    expect(p.repetitions).toBe(0);
    expect(p.incorrectCount).toBe(1);
  });
  it('Hard → 1 day, Easy → 4 days', () => {
    expect(schedule(NEW_PROGRESS, 1, now).intervalMinutes).toBe(DAY);
    expect(schedule(NEW_PROGRESS, 3, now).intervalMinutes).toBe(4 * DAY);
  });
});

describe('schedule — review cards', () => {
  it('Good multiplies by ease', () => {
    expect(schedule(review(2 * DAY), 2, now).intervalMinutes).toBe(5 * DAY);
  });
  it('Easy multiplies by ease × 1.3 and raises ease', () => {
    const p = schedule(review(2 * DAY), 3, now);
    expect(p.intervalMinutes).toBe(Math.round(2 * DAY * 2.5 * 1.3));
    expect(p.ease).toBe(2.65);
  });
  it('Hard grows by 1.2 and lowers ease', () => {
    const p = schedule(review(2 * DAY), 1, now);
    expect(p.intervalMinutes).toBe(Math.round(2 * DAY * 1.2));
    expect(p.ease).toBe(2.35);
  });
  it('Again lapses to 10 minutes, resets repetitions, ease floor 1.3', () => {
    const p = schedule(review(10 * DAY, 1.35), 0, now);
    expect(p.intervalMinutes).toBe(10);
    expect(p.repetitions).toBe(0);
    expect(p.state).toBe('learning');
    expect(p.ease).toBe(1.3);
  });
  it('reaches mastered at 21 days', () => {
    expect(schedule(review(9 * DAY), 2, now).state).toBe('mastered');
    expect(stateFor(20 * DAY, 5)).toBe('reviewing');
  });
});

describe('previewIntervals', () => {
  it('labels each grade outcome', () => {
    expect(previewIntervals(NEW_PROGRESS, now)).toEqual({ 0: '10m', 1: '1d', 2: '1d', 3: '4d' });
  });
});

describe('buildQueue', () => {
  const card = (id: string, position: number, dueAt: string | null, state: Progress['state'] = 'reviewing') =>
    ({ id, position, progress: dueAt === null && state === 'new' ? null : { ...NEW_PROGRESS, dueAt, state, reviewCount: 1 } });
  const cards = [
    card('future', 0, '2026-10-09T00:00:00Z'),
    card('due-late', 1, '2026-10-06T09:00:00Z'),
    card('due-early', 2, '2026-10-01T00:00:00Z'),
    card('new-b', 4, null, 'new'),
    card('new-a', 3, null, 'new'),
    card('new-c', 5, null, 'new'),
  ];
  it('orders due cards oldest first, then new cards by position up to the limit', () => {
    expect(buildQueue(cards, now, { newLimit: 2 })).toEqual(['due-early', 'due-late', 'new-a', 'new-b']);
  });
  it('all=true includes not-yet-due cards after the due ones', () => {
    expect(buildQueue(cards, now, { newLimit: 0, all: true })).toEqual(['due-early', 'due-late', 'future', 'new-a', 'new-b', 'new-c']);
  });
  it('shuffle keeps the same set', () => {
    const out = buildQueue(cards, now, { newLimit: 2, shuffle: true, rng: mulberry32(3) });
    expect([...out].sort()).toEqual(['due-early', 'due-late', 'new-a', 'new-b']);
  });
});

describe('requeueOffset & deckMastery', () => {
  it('re-inserts 3–5 cards later, or at the end of a short queue', () => {
    for (let s = 0; s < 20; s++) {
      const o = requeueOffset(10, mulberry32(s));
      expect(o).toBeGreaterThanOrEqual(3);
      expect(o).toBeLessThanOrEqual(5);
    }
    expect(requeueOffset(1, mulberry32(1))).toBe(1);
  });
  it('summarises mastery', () => {
    expect(deckMastery(['new', 'mastered', 'mastered', 'learning'])).toEqual({
      counts: { new: 1, learning: 1, reviewing: 0, mastered: 2 }, total: 4, masteredPct: 50,
    });
  });
});

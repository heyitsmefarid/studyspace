import { describe, expect, it } from 'vitest';
import { bestScore, focusByDay, focusByMonth, focusByWeek, minutesBySubject, minutesThisWeek, quizAverage, subjectStrengths, weakTopicsFrom } from './stats';

const today = new Date(2026, 9, 6, 15); // Tue Oct 6 2026, local
const at = (y: number, m: number, d: number, mins: number, subject: string | null = null) =>
  ({ started_at: new Date(y, m - 1, d, 10).toISOString(), focus_seconds: mins * 60, subject_id: subject });

describe('dashboard stats', () => {
  const sessions = [at(2026, 10, 6, 30, 'bio'), at(2026, 10, 6, 15, 'bio'), at(2026, 10, 5, 60, 'chem'), at(2026, 9, 20, 45), at(2026, 8, 1, 10)];
  it('buckets focus minutes by day (oldest first, zero-filled)', () => {
    expect(focusByDay(sessions, 3, today)).toEqual([
      { date: '2026-10-04', minutes: 0 }, { date: '2026-10-05', minutes: 60 }, { date: '2026-10-06', minutes: 45 },
    ]);
  });
  it('buckets by ISO week (Mon start) and by month', () => {
    // weeks start Monday: Sep 21, Sep 28, Oct 5 — Sep 20 (a Sunday) falls in the week before the range
    expect(focusByWeek(sessions, 3, today).map((w) => w.minutes)).toEqual([0, 0, 105]);
    expect(focusByMonth(sessions, 3, today).map((m) => [m.label, m.minutes])).toEqual([['Aug', 10], ['Sep', 45], ['Oct', 105]]);
  });
  it('sums this week and per subject', () => {
    expect(minutesThisWeek(sessions, today)).toBe(105);
    expect(Object.fromEntries(minutesBySubject(sessions))).toEqual({ bio: 45, chem: 60, null: 55 });
  });
  it('quiz average and best score ignore empty lists', () => {
    expect(quizAverage([])).toBeNull();
    expect(quizAverage([{ accuracy: 0.5 }, { accuracy: 1 }])).toBe(0.75);
    expect(bestScore([{ accuracy: 0.4 }, { accuracy: 0.9 }])).toBe(0.9);
  });
  it('ranks subjects by blended quiz accuracy and card mastery', () => {
    const r = subjectStrengths({
      subjects: [{ id: 'bio', name: 'Biology' }, { id: 'chem', name: 'Chemistry' }, { id: 'hist', name: 'History' }],
      attempts: [{ subject_id: 'bio', accuracy: 0.9 }, { subject_id: 'chem', accuracy: 0.4 }],
      mastery: new Map([['bio', 0.5], ['chem', 0.6]]),
    });
    expect(r.map((x) => x.id)).toEqual(['bio', 'chem']);
    expect(r[0]!.score).toBeCloseTo(0.7);
  });
  it('extracts weak topics (≥ 2 questions, < 60%)', () => {
    expect(weakTopicsFrom([{ subject_id: 'bio', topic_breakdown: { Cells: { correct: 1, total: 3, accuracy: 0.33 }, Energy: { correct: 0, total: 1, accuracy: 0 } } }]))
      .toEqual([{ topic: 'Cells', subjectId: 'bio' }]);
  });
});

describe('subjectMastery', () => {
  it('weights deck mastery by card count per subject and skips unfiled or empty decks', async () => {
    const { subjectMastery } = await import('./stats');
    const decks = [{ id: 'd1', subject_id: 'bio' }, { id: 'd2', subject_id: 'bio' }, { id: 'd3', subject_id: null }, { id: 'd4', subject_id: 'chem' }];
    const stats = new Map([['d1', { total: 10, masteredPct: 50 }], ['d2', { total: 30, masteredPct: 10 }], ['d3', { total: 5, masteredPct: 100 }], ['d4', { total: 0, masteredPct: 0 }]]);
    const m = subjectMastery(decks, stats);
    expect(m.get('bio')).toBeCloseTo(0.2);
    expect(m.has('chem')).toBe(false);
    expect(m.size).toBe(1);
  });
});

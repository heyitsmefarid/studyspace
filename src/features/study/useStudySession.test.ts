import { describe, expect, it } from 'vitest';
import { parseStoredStudy, type ActiveStudy } from './useStudySession';
import { createTimer, timerReducer } from './timer';

const HOUR = 3_600_000;
const config = { mode: 'pomodoro' as const, focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4, customMin: 45 };
const start = Date.parse('2026-10-06T10:00:00Z');
const active: ActiveStudy = {
  timer: timerReducer(createTimer(config, start), { type: 'pause', now: start + 60_000 }),
  subjectId: null, taskId: 't1', taskDate: '2026-10-06', content: { type: 'deck', id: 'd1' },
  counters: { cards: 3, questions: 0, correct: 2 }, startedAtIso: new Date(start).toISOString(), endedAtIso: null,
};

describe('parseStoredStudy', () => {
  it('restores a saved session exactly', () => {
    expect(parseStoredStudy(JSON.stringify(active), start + HOUR)).toEqual(active);
  });
  it('drops malformed or unknown data', () => {
    expect(parseStoredStudy(null, start)).toBeNull();
    expect(parseStoredStudy('{nope', start)).toBeNull();
    expect(parseStoredStudy(JSON.stringify({ ...active, timer: { ...active.timer, phase: 'nap' } }), start)).toBeNull();
    expect(parseStoredStudy(JSON.stringify({ ...active, counters: { cards: 'x' } }), start)).toBeNull();
    expect(parseStoredStudy(JSON.stringify({ ...active, content: { type: 'video', id: 'x' } }), start)).toBeNull();
  });
  it('drops sessions older than a day', () => {
    expect(parseStoredStudy(JSON.stringify(active), start + 25 * HOUR)).toBeNull();
  });
});

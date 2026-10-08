import { describe, expect, it } from 'vitest';
import { createTimer, timerReducer } from './timer';
import { MAX_SESSION_MS, toFinished } from './finish';
import type { ActiveStudy } from './useStudySession';

const HOUR = 3_600_000;
const start = Date.parse('2026-10-06T08:00:00Z');
const config = { mode: 'stopwatch' as const, focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4, customMin: 45 };
const finished = (endMs: number): ActiveStudy => ({
  sessionId: 's1', subjectId: null, taskId: null, taskDate: null, roomId: null, orbitId: null, content: null, counters: { cards: 0, questions: 0, correct: 0 },
  timer: timerReducer(createTimer(config, start), { type: 'finish', now: endMs }),
  startedAtIso: new Date(start).toISOString(), endedAtIso: new Date(endMs).toISOString(),
});

describe('toFinished (review I1)', () => {
  it('keeps a normal session as recorded', () => {
    const f = toFinished(finished(start + 2 * HOUR));
    expect([f.focusSeconds, f.startedAtIso, f.capped, f.sessionId]).toEqual([7200, new Date(start).toISOString(), false, 's1']);
  });
  it('caps a forgotten overnight session to the 16-hour limit the server enforces', () => {
    const end = start + 20 * HOUR;
    const f = toFinished(finished(end));
    expect(f.capped).toBe(true);
    expect(Date.parse(f.endedAtIso) - Date.parse(f.startedAtIso)).toBe(MAX_SESSION_MS);
    expect(f.focusSeconds).toBe(MAX_SESSION_MS / 1000);
    expect(f.endedAtIso).toBe(new Date(end).toISOString());
  });
});

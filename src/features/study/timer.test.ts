import { describe, expect, it } from 'vitest';
import { createTimer, remainingMs, timerReducer, totalFocusMs, type TimerConfig } from './timer';

const MIN = 60_000;
const pomodoro: TimerConfig = { mode: 'pomodoro', focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4, customMin: 50 };
const tick = (s: ReturnType<typeof createTimer>, now: number) => timerReducer(s, { type: 'tick', now });

describe('timer', () => {
  it('moves from focus to a short break after 25 minutes', () => {
    const s = tick(createTimer(pomodoro, 0), 25 * MIN);
    expect([s.phase, s.completedFocus, totalFocusMs(s, 25 * MIN)]).toEqual(['short_break', 1, 25 * MIN]);
    expect(remainingMs(s, 25 * MIN)).toBe(5 * MIN);
  });
  it('excludes paused time', () => {
    let s = createTimer(pomodoro, 0);
    s = timerReducer(s, { type: 'pause', now: 10 * MIN });
    s = timerReducer(s, { type: 'resume', now: 30 * MIN });
    expect(tick(s, 44 * MIN).phase).toBe('focus');
    s = tick(s, 45 * MIN);
    expect(s.phase).toBe('short_break');
    expect(totalFocusMs(s, 45 * MIN)).toBe(25 * MIN);
  });
  it('catches up across multiple phases after a long sleep, counting only focus time', () => {
    const s = tick(createTimer(pomodoro, 0), 95 * MIN);
    expect(s.phase).toBe('focus');
    expect(s.completedFocus).toBe(3);
    expect(totalFocusMs(s, 95 * MIN)).toBe(80 * MIN);
    expect(remainingMs(s, 95 * MIN)).toBe(20 * MIN);
  });
  it('takes a long break after every 4th focus', () => {
    const s = tick(createTimer(pomodoro, 0), 116 * MIN);
    expect([s.phase, s.completedFocus]).toEqual(['long_break', 4]);
  });
  it('custom mode finishes when its time is up', () => {
    const s = tick(createTimer({ ...pomodoro, mode: 'custom', customMin: 50 }, 0), 60 * MIN);
    expect([s.finished, s.running, totalFocusMs(s, 60 * MIN)]).toEqual([true, false, 50 * MIN]);
  });
  it('stopwatch never ends and counts focus minus pauses', () => {
    let s = createTimer({ ...pomodoro, mode: 'stopwatch' }, 0);
    s = timerReducer(s, { type: 'pause', now: 30 * MIN });
    s = timerReducer(s, { type: 'resume', now: 40 * MIN });
    s = tick(s, 200 * MIN);
    expect([s.finished, s.phase, remainingMs(s, 200 * MIN)]).toEqual([false, 'focus', null]);
    expect(totalFocusMs(s, 200 * MIN)).toBe(190 * MIN);
  });
  it('skip ends a break immediately; finish banks running focus time', () => {
    let s = tick(createTimer(pomodoro, 0), 26 * MIN);
    s = timerReducer(s, { type: 'skip', now: 26 * MIN });
    expect(s.phase).toBe('focus');
    s = timerReducer(s, { type: 'finish', now: 36 * MIN });
    expect([s.finished, s.running, totalFocusMs(s, 99 * MIN)]).toEqual([true, false, 35 * MIN]);
  });
});

export type Phase = 'focus' | 'short_break' | 'long_break';
export type TimerMode = 'pomodoro' | 'custom' | 'stopwatch';
export interface TimerConfig { mode: TimerMode; focusMin: number; shortMin: number; longMin: number; longEvery: number; customMin: number }
export interface TimerState {
  config: TimerConfig; phase: Phase; phaseStartedAt: number | null; phaseElapsedMs: number;
  focusMs: number; completedFocus: number; startedAt: number; running: boolean; finished: boolean;
}
export type TimerAction = { type: 'pause' | 'resume' | 'tick' | 'skip' | 'finish'; now: number };

const MIN = 60_000;

export function createTimer(config: TimerConfig, now: number): TimerState {
  return { config, phase: 'focus', phaseStartedAt: now, phaseElapsedMs: 0, focusMs: 0, completedFocus: 0, startedAt: now, running: true, finished: false };
}

export function phaseDurationMs(s: TimerState): number | null {
  const c = s.config;
  if (c.mode === 'stopwatch') return null;
  if (c.mode === 'custom') return c.customMin * MIN;
  return (s.phase === 'focus' ? c.focusMin : s.phase === 'short_break' ? c.shortMin : c.longMin) * MIN;
}

export const elapsedInPhase = (s: TimerState, now: number) => s.phaseElapsedMs + (s.running && s.phaseStartedAt !== null ? now - s.phaseStartedAt : 0);

export function remainingMs(s: TimerState, now: number): number | null {
  const d = phaseDurationMs(s);
  return d === null ? null : Math.max(0, d - elapsedInPhase(s, now));
}

export const totalFocusMs = (s: TimerState, now: number) =>
  s.focusMs + (s.running && s.phase === 'focus' && s.phaseStartedAt !== null ? now - s.phaseStartedAt : 0);

export function phaseProgress(s: TimerState, now: number): number {
  const d = phaseDurationMs(s);
  const e = elapsedInPhase(s, now);
  return d === null ? (e % (60 * MIN)) / (60 * MIN) : Math.min(1, e / d);
}

/** Bank the running stretch into elapsed (and focus) totals. */
function bank(s: TimerState, now: number): TimerState {
  if (!s.running || s.phaseStartedAt === null) return s;
  const stretch = now - s.phaseStartedAt;
  return { ...s, phaseElapsedMs: s.phaseElapsedMs + stretch, focusMs: s.focusMs + (s.phase === 'focus' ? stretch : 0), phaseStartedAt: now };
}

export function timerReducer(s: TimerState, a: TimerAction): TimerState {
  if (s.finished) return s;
  switch (a.type) {
    case 'pause': return s.running ? { ...bank(s, a.now), running: false, phaseStartedAt: null } : s;
    case 'resume': return s.running ? s : { ...s, running: true, phaseStartedAt: a.now };
    case 'finish': return { ...bank(s, a.now), running: false, phaseStartedAt: null, finished: true };
    case 'skip':
      if (s.phase === 'focus') return s;
      return { ...s, phase: 'focus', phaseElapsedMs: 0, phaseStartedAt: s.running ? a.now : null };
    case 'tick': {
      let cur = s;
      for (let guard = 0; guard < 500; guard++) {
        const d = phaseDurationMs(cur);
        if (d === null || !cur.running || cur.phaseStartedAt === null) return cur;
        const left = d - cur.phaseElapsedMs;
        const endsAt = cur.phaseStartedAt + left;
        if (a.now < endsAt) return cur;
        const banked = bank(cur, endsAt);
        if (cur.phase === 'focus') {
          const completed = banked.completedFocus + 1;
          if (cur.config.mode === 'custom') return { ...banked, completedFocus: completed, running: false, phaseStartedAt: null, finished: true };
          const next: Phase = completed % cur.config.longEvery === 0 ? 'long_break' : 'short_break';
          cur = { ...banked, completedFocus: completed, phase: next, phaseElapsedMs: 0, phaseStartedAt: endsAt };
        } else {
          cur = { ...banked, phase: 'focus', phaseElapsedMs: 0, phaseStartedAt: endsAt };
        }
      }
      return cur;
    }
  }
}

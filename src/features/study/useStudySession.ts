import { useSyncExternalStore } from 'react';
import { createTimer, timerReducer, type TimerAction, type TimerConfig, type TimerState } from './timer';

export interface ActiveStudy {
  /** Client-generated study_sessions.id — makes saving idempotent across retries. */
  sessionId: string;
  timer: TimerState;
  subjectId: string | null;
  taskId: string | null;
  /** The planner occurrence this session completes (the task's own date, or today for repeating tasks). */
  taskDate: string | null;
  content: { type: 'deck' | 'quiz' | 'note'; id: string } | null;
  counters: { cards: number; questions: number; correct: number };
  startedAtIso: string;
  endedAtIso: string | null;
}

const KEY = 'ss.study';
const DAY = 86_400_000;
const MODES = new Set(['pomodoro', 'custom', 'stopwatch']);
const PHASES = new Set(['focus', 'short_break', 'long_break']);
const CONTENT = new Set(['deck', 'quiz', 'note']);

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const strOrNull = (v: unknown) => v === null || typeof v === 'string';

function isTimer(t: unknown): t is TimerState {
  if (!t || typeof t !== 'object') return false;
  const s = t as Record<string, unknown>;
  const c = s.config as Record<string, unknown> | undefined;
  return Boolean(c) && MODES.has(c!.mode as string) && ['focusMin', 'shortMin', 'longMin', 'longEvery', 'customMin'].every((k) => num(c![k]))
    && PHASES.has(s.phase as string) && (s.phaseStartedAt === null || num(s.phaseStartedAt))
    && ['phaseElapsedMs', 'focusMs', 'completedFocus', 'startedAt'].every((k) => num(s[k]))
    && typeof s.running === 'boolean' && typeof s.finished === 'boolean';
}

/** Validates what sessionStorage held; anything odd (or older than a day) is dropped rather than trusted. */
export function parseStoredStudy(raw: string | null, nowMs: number): ActiveStudy | null {
  if (!raw) return null;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;
  const counters = a.counters as Record<string, unknown> | undefined;
  const content = a.content as Record<string, unknown> | null | undefined;
  const started = typeof a.startedAtIso === 'string' ? Date.parse(a.startedAtIso) : NaN;
  const ok = isTimer(a.timer) && typeof a.sessionId === 'string' && strOrNull(a.subjectId) && strOrNull(a.taskId) && strOrNull(a.taskDate) && strOrNull(a.endedAtIso)
    && Boolean(counters) && ['cards', 'questions', 'correct'].every((k) => num(counters![k]))
    && (content === null || (Boolean(content) && CONTENT.has(content!.type as string) && typeof content!.id === 'string'))
    && Number.isFinite(started) && nowMs - started <= DAY;
  return ok ? (a as unknown as ActiveStudy) : null;
}

// ───────────── module store shared by the setup, runner and summary
let active: ActiveStudy | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function snapshot(): ActiveStudy | null {
  if (!loaded) {
    loaded = true;
    try { active = parseStoredStudy(sessionStorage.getItem(KEY), Date.now()); } catch { active = null; }
  }
  return active;
}

function set(next: ActiveStudy | null) {
  active = next;
  try {
    if (next) sessionStorage.setItem(KEY, JSON.stringify(next));
    else sessionStorage.removeItem(KEY);
  } catch { /* storage unavailable — the session still lives in memory */ }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export type StartStudy = Omit<ActiveStudy, 'sessionId' | 'timer' | 'counters' | 'startedAtIso' | 'endedAtIso'> & { config: TimerConfig };

function start({ config, ...rest }: StartStudy) {
  const now = Date.now();
  set({ ...rest, sessionId: crypto.randomUUID(), timer: createTimer(config, now), counters: { cards: 0, questions: 0, correct: 0 }, startedAtIso: new Date(now).toISOString(), endedAtIso: null });
}

function dispatch(action: TimerAction) {
  const cur = snapshot();
  if (!cur) return;
  const timer = timerReducer(cur.timer, action);
  if (timer === cur.timer) return; // ticks inside a phase change nothing — no re-render, no storage write
  set({ ...cur, timer, endedAtIso: !cur.timer.finished && timer.finished ? new Date(action.now).toISOString() : cur.endedAtIso });
}

function count(kind: 'card' | 'question', correct: boolean) {
  const cur = snapshot();
  if (!cur) return;
  const c = cur.counters;
  set({ ...cur, counters: { cards: c.cards + (kind === 'card' ? 1 : 0), questions: c.questions + (kind === 'question' ? 1 : 0), correct: c.correct + (correct ? 1 : 0) } });
}

const clear = () => set(null);

export function useStudySession() {
  const a = useSyncExternalStore(subscribe, snapshot, () => null);
  return { active: a, start, dispatch, count, clear };
}

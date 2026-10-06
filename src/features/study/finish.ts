import type { ActiveStudy } from './useStudySession';

/** The server rejects sessions longer than this (study_sessions_length_plausible). */
export const MAX_SESSION_MS = 16 * 3_600_000;

export interface FinishedStudy extends ActiveStudy { endedAtIso: string; focusSeconds: number; capped: boolean }

/**
 * Snapshot of a finished session in the shape the server accepts. A session left running overnight is capped to the
 * last 16 hours (with its focus time) instead of being rejected forever.
 */
export function toFinished(a: ActiveStudy): FinishedStudy {
  const started = Date.parse(a.startedAtIso);
  const ended = a.endedAtIso ? Date.parse(a.endedAtIso) : started + a.timer.focusMs;
  const capped = ended - started > MAX_SESSION_MS;
  return {
    ...a,
    startedAtIso: capped ? new Date(ended - MAX_SESSION_MS).toISOString() : a.startedAtIso,
    endedAtIso: new Date(ended).toISOString(),
    focusSeconds: Math.round(Math.min(a.timer.focusMs, MAX_SESSION_MS) / 1000),
    capped,
  };
}

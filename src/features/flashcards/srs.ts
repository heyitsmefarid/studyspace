import type { Tables, TablesInsert } from '@/lib/supabase';
import { shuffle } from '@/lib/random';

export type Grade = 0 | 1 | 2 | 3;
export type CardState = 'new' | 'learning' | 'reviewing' | 'mastered';
export const DAY = 1440;

export interface Progress {
  ease: number; intervalMinutes: number; repetitions: number; dueAt: string | null; lastReviewedAt: string | null;
  correctCount: number; incorrectCount: number; reviewCount: number; state: CardState;
}

export const NEW_PROGRESS: Progress = {
  ease: 2.5, intervalMinutes: 0, repetitions: 0, dueAt: null, lastReviewedAt: null,
  correctCount: 0, incorrectCount: 0, reviewCount: 0, state: 'new',
};

export function stateFor(intervalMinutes: number, reviewCount: number): CardState {
  if (reviewCount === 0) return 'new';
  if (intervalMinutes < DAY) return 'learning';
  if (intervalMinutes < 21 * DAY) return 'reviewing';
  return 'mastered';
}

const LEARNING_STEPS: Record<Grade, number> = { 0: 10, 1: DAY, 2: DAY, 3: 4 * DAY };

export function schedule(p: Progress, grade: Grade, now: Date): Progress {
  const isReview = p.state === 'reviewing' || p.state === 'mastered';
  let ease = p.ease;
  let interval: number;
  let reps = p.repetitions;
  if (!isReview) {
    interval = LEARNING_STEPS[grade];
    reps = grade === 0 ? 0 : reps + 1;
  } else if (grade === 0) {
    interval = 10; reps = 0; ease -= 0.2;
  } else if (grade === 1) {
    interval = Math.round(p.intervalMinutes * 1.2); ease -= 0.15; reps += 1;
  } else if (grade === 2) {
    interval = Math.round(p.intervalMinutes * ease); reps += 1;
  } else {
    interval = Math.round(p.intervalMinutes * ease * 1.3); ease += 0.15; reps += 1;
  }
  ease = Math.max(1.3, Math.round(ease * 100) / 100);
  const reviewCount = p.reviewCount + 1;
  return {
    ease,
    intervalMinutes: interval,
    repetitions: reps,
    dueAt: new Date(now.getTime() + interval * 60_000).toISOString(),
    lastReviewedAt: now.toISOString(),
    correctCount: p.correctCount + (grade >= 1 ? 1 : 0),
    incorrectCount: p.incorrectCount + (grade === 0 ? 1 : 0),
    reviewCount,
    state: stateFor(interval, reviewCount),
  };
}

function label(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < DAY) return `${Math.round(minutes / 60)}h`;
  const days = Math.round(minutes / DAY);
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

export function previewIntervals(p: Progress, now: Date): Record<Grade, string> {
  return { 0: label(schedule(p, 0, now).intervalMinutes), 1: label(schedule(p, 1, now).intervalMinutes),
           2: label(schedule(p, 2, now).intervalMinutes), 3: label(schedule(p, 3, now).intervalMinutes) };
}

export function progressFromRow(row: Tables<'flashcard_progress'> | undefined): Progress {
  if (!row) return NEW_PROGRESS;
  return {
    ease: Number(row.ease), intervalMinutes: row.interval_minutes, repetitions: row.repetitions, dueAt: row.due_at,
    lastReviewedAt: row.last_reviewed_at, correctCount: row.correct_count, incorrectCount: row.incorrect_count,
    reviewCount: row.review_count, state: row.state as CardState,
  };
}

export function progressToRow(userId: string, cardId: string, p: Progress): TablesInsert<'flashcard_progress'> {
  return {
    user_id: userId, card_id: cardId, ease: p.ease, interval_minutes: p.intervalMinutes, repetitions: p.repetitions,
    due_at: p.dueAt, last_reviewed_at: p.lastReviewedAt, correct_count: p.correctCount, incorrect_count: p.incorrectCount,
    review_count: p.reviewCount, state: p.state,
  };
}

export interface QueueCard { id: string; position: number; progress: Progress | null }

export function buildQueue(cards: QueueCard[], now: Date, opts: { newLimit: number; shuffle?: boolean; all?: boolean; rng?: () => number }): string[] {
  const isNew = (c: QueueCard) => !c.progress || c.progress.state === 'new';
  const seen = cards.filter((c) => !isNew(c));
  const due = seen.filter((c) => !c.progress!.dueAt || new Date(c.progress!.dueAt) <= now)
    .sort((a, b) => (a.progress!.dueAt ?? '').localeCompare(b.progress!.dueAt ?? ''));
  const notDue = opts.all ? seen.filter((c) => !due.includes(c)).sort((a, b) => (a.progress!.dueAt ?? '').localeCompare(b.progress!.dueAt ?? '')) : [];
  const fresh = cards.filter(isNew).sort((a, b) => a.position - b.position);
  const newOnes = opts.all ? fresh : fresh.slice(0, Math.max(0, opts.newLimit));
  const ids = [...due, ...notDue, ...newOnes].map((c) => c.id);
  return opts.shuffle ? shuffle(ids, opts.rng) : ids;
}

export function requeueOffset(remaining: number, rng: () => number = Math.random): number {
  if (remaining < 3) return Math.max(remaining, 0);
  return Math.min(remaining, 3 + Math.floor(rng() * 3));
}

export function deckMastery(states: CardState[]) {
  const counts: Record<CardState, number> = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
  for (const s of states) counts[s]++;
  const total = states.length;
  return { counts, total, masteredPct: total ? Math.round((counts.mastered / total) * 100) : 0 };
}

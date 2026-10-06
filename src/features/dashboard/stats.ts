import { addDays, addMonths, addWeeks, format, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns';

type S = { started_at: string; focus_seconds: number; subject_id: string | null };
const mins = (s: S) => s.focus_seconds / 60;
const round = (n: number) => Math.round(n);

export function focusByDay(sessions: S[], days: number, today: Date) {
  const start = startOfDay(addDays(today, -(days - 1)));
  const buckets = Array.from({ length: days }, (_, i) => ({ date: format(addDays(start, i), 'yyyy-MM-dd'), minutes: 0 }));
  const index = new Map(buckets.map((b, i) => [b.date, i]));
  for (const s of sessions) {
    const i = index.get(format(parseISO(s.started_at), 'yyyy-MM-dd'));
    if (i !== undefined) buckets[i]!.minutes += mins(s);
  }
  return buckets.map((b) => ({ ...b, minutes: round(b.minutes) }));
}

export function focusByWeek(sessions: S[], weeks: number, today: Date) {
  const first = startOfWeek(addWeeks(today, -(weeks - 1)), { weekStartsOn: 1 });
  const buckets = Array.from({ length: weeks }, (_, i) => ({ start: addWeeks(first, i), label: format(addWeeks(first, i), 'MMM d'), minutes: 0 }));
  for (const s of sessions) {
    const d = parseISO(s.started_at);
    const i = Math.floor((startOfWeek(d, { weekStartsOn: 1 }).getTime() - first.getTime()) / (7 * 86_400_000) + 0.5);
    if (i >= 0 && i < weeks) buckets[i]!.minutes += mins(s);
  }
  return buckets.map(({ label, minutes }) => ({ label, minutes: round(minutes) }));
}

export function focusByMonth(sessions: S[], months: number, today: Date) {
  const first = startOfMonth(addMonths(today, -(months - 1)));
  const buckets = Array.from({ length: months }, (_, i) => ({ key: format(addMonths(first, i), 'yyyy-MM'), label: format(addMonths(first, i), 'MMM'), minutes: 0 }));
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const s of sessions) {
    const i = index.get(format(parseISO(s.started_at), 'yyyy-MM'));
    if (i !== undefined) buckets[i]!.minutes += mins(s);
  }
  return buckets.map(({ label, minutes }) => ({ label, minutes: round(minutes) }));
}

export function minutesThisWeek(sessions: S[], today: Date): number {
  const start = startOfWeek(today, { weekStartsOn: 1 }).getTime();
  return round(sessions.filter((s) => parseISO(s.started_at).getTime() >= start).reduce((t, s) => t + mins(s), 0));
}

export function minutesBySubject(sessions: S[]): Map<string | null, number> {
  const m = new Map<string | null, number>();
  for (const s of sessions) m.set(s.subject_id, round((m.get(s.subject_id) ?? 0) + mins(s)));
  return m;
}

export const quizAverage = (a: { accuracy: number }[]) => (a.length ? a.reduce((t, x) => t + Number(x.accuracy), 0) / a.length : null);
export const bestScore = (a: { accuracy: number }[]) => (a.length ? Math.max(...a.map((x) => Number(x.accuracy))) : null);

export function subjectStrengths({ subjects, attempts, mastery }: { subjects: { id: string; name: string }[]; attempts: { subject_id: string | null; accuracy: number }[]; mastery: Map<string, number> }) {
  const out: { id: string; name: string; score: number }[] = [];
  for (const subj of subjects) {
    const acc = attempts.filter((a) => a.subject_id === subj.id).map((a) => Number(a.accuracy));
    const quiz = acc.length ? acc.reduce((t, x) => t + x, 0) / acc.length : null;
    const m = mastery.get(subj.id) ?? null;
    if (quiz === null && m === null) continue;
    const score = quiz !== null && m !== null ? (quiz + m) / 2 : (quiz ?? m)!;
    out.push({ id: subj.id, name: subj.name, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function weakTopicsFrom(attempts: { topic_breakdown: unknown; subject_id: string | null }[]) {
  const out: { topic: string; subjectId: string | null }[] = [];
  const seen = new Set<string>();
  for (const a of attempts) {
    const b = (a.topic_breakdown ?? {}) as Record<string, { total?: number; accuracy?: number }>;
    for (const [topic, st] of Object.entries(b)) {
      if ((st.total ?? 0) >= 2 && (st.accuracy ?? 1) < 0.6 && !seen.has(topic)) { seen.add(topic); out.push({ topic, subjectId: a.subject_id }); }
    }
  }
  return out;
}

/** Card mastery (0..1) per subject, weighted by each deck's card count. Unfiled and empty decks are skipped. */
export function subjectMastery(decks: { id: string; subject_id: string | null }[], stats: Map<string, { total: number; masteredPct: number }>) {
  const sums = new Map<string, { mastered: number; total: number }>();
  for (const d of decks) {
    const s = stats.get(d.id);
    if (!d.subject_id || !s || s.total === 0) continue;
    const cur = sums.get(d.subject_id) ?? { mastered: 0, total: 0 };
    sums.set(d.subject_id, { mastered: cur.mastered + (s.masteredPct / 100) * s.total, total: cur.total + s.total });
  }
  return new Map([...sums].map(([id, v]) => [id, v.mastered / v.total]));
}

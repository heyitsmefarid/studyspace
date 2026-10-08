import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { Check, X } from 'lucide-react';
import { formatDuration } from '@/lib/dates';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryError } from '@/components/ui/QueryError';
import { ProgressRing } from '@/components/ui/Progress';
import { useAttempt, useReviewSuggestions } from './api';
import { useAttemptXp } from '@/features/gamification/api';
import { classifyTopics, type AnswerRecord, type TopicStat } from './scoring';
import { AskNovaButton } from '@/features/ai/AskNovaButton';
import { ResultsSky } from './ResultsSky';
import { useCountUp } from '@/lib/countUp';
import { AnalysisPanel } from './AnalysisPanel';

function ReviewSuggestions({ topics }: { topics: string[] }) {
  const q = useReviewSuggestions(topics);
  if (topics.length === 0) return null;
  return (
    <Card>
      <h2 className="font-display text-lg">Recommended review</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {(q.data ?? topics.map((topic) => ({ topic, notes: [], decks: [] }))).map(({ topic, notes, decks }) => (
          <li key={topic}>
            <p className="text-sm font-semibold">{topic}</p>
            <div className="mt-1 flex flex-wrap gap-2 text-sm">
              {notes.map((n) => <Link key={n.id} to={`/notes/${n.id}`} className="text-primary underline-offset-2 hover:underline">📄 {n.title}</Link>)}
              {decks.map((d) => <Link key={d.id} to={`/decks/${d.id}`} className="text-primary underline-offset-2 hover:underline">🃏 {d.title}</Link>)}
              {notes.length + decks.length === 0 && (
                <Link to={`/tutor?mode=explain_simply&prompt=${encodeURIComponent(`Explain ${topic}`)}`} className="text-primary underline-offset-2 hover:underline">Ask Nova to explain {topic}</Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function ResultsPage() {
  const { id } = useParams();
  const q = useAttempt(id);
  const answers = useMemo(() => (Array.isArray(q.data?.answers) ? (q.data!.answers as unknown as AnswerRecord[]) : []), [q.data]);
  const breakdown = useMemo(() => (q.data?.topic_breakdown ?? {}) as unknown as Record<string, TopicStat>, [q.data]);
  const topics = useMemo(() => classifyTopics(breakdown), [breakdown]);
  const shownScore = useCountUp(q.data?.score ?? 0);
  const xp = useAttemptXp(q.data?.id);

  if (q.isPending) return <div className="flex flex-col gap-3"><Skeleton className="h-32" /><Skeleton className="h-60" /></div>;
  if (q.isError) return <QueryError error={q.error} onRetry={q.refetch} retrying={q.isFetching} />;
  if (!q.data) return <EmptyState title="Result not found" action={<Link to="/quizzes" className="text-primary underline">Back to quizzes</Link>} />;
  const a = q.data;
  const perfect = a.total >= 5 && a.score === a.total;
  let retake = a.quiz_id ? `/quizzes/${a.quiz_id}/take?mode=practice` : '/quizzes';
  try { retake = localStorage.getItem(`ss.lastQuizUrl.${a.id}`) ?? retake; } catch { /* storage unavailable */ }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Card className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <ProgressRing value={Number(a.accuracy)} size={96} stroke={7} color="var(--teal)" />
        <div className="flex-1">
          <p className="text-sm text-ink-muted">{a.title}</p>
          <p className="font-display text-5xl tabular">{shownScore}/{a.total}</p>
          <p className="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm text-ink-muted sm:justify-start">
            {formatDuration(a.duration_seconds)} · <Badge>{a.mode}</Badge>{xp.data ? <> <Badge tone="gold">+{xp.data} XP</Badge></> : null}
          </p>
        </div>
      </Card>
      {perfect && <div className="animate-pop-in rounded-xl bg-gold-soft px-4 py-3 text-center font-display text-lg text-gold"><span className="text-shimmer animate-shimmer-text">Supernova! A perfect score ✦</span></div>}
      <Card><ResultsSky answers={answers} breakdown={breakdown} /></Card>
      <div className="stagger grid gap-4 sm:grid-cols-3">
        <Card><h3 className="text-sm font-semibold text-teal">Strong topics</h3><div className="mt-2 flex flex-wrap gap-1.5">{topics.strong.map((t) => <Badge key={t} tone="teal">{t}</Badge>)}{!topics.strong.length && <span className="text-sm text-ink-faint">—</span>}</div></Card>
        <Card><h3 className="text-sm font-semibold text-coral">Needs work</h3><div className="mt-2 flex flex-wrap gap-1.5">{topics.weak.map((t) => <Badge key={t} tone="coral">{t}</Badge>)}{!topics.weak.length && <span className="text-sm text-ink-faint">—</span>}</div></Card>
        <Card><h3 className="text-sm font-semibold text-ink-muted">Needs more data</h3><div className="mt-2 flex flex-wrap gap-1.5">{topics.needsData.map((t) => <Badge key={t}>{t}</Badge>)}{!topics.needsData.length && <span className="text-sm text-ink-faint">—</span>}</div></Card>
      </div>
      <ReviewSuggestions topics={topics.weak.slice(0, 3)} />
      <AnalysisPanel key={a.id} attempt={a} />
      <Card>
        <h2 className="font-display text-lg">Your answers</h2>
        <ol className="mt-3 flex flex-col gap-2">
          {answers.map((r, i) => (
            <li key={r.questionId}>
              <details className="rounded-xl border border-line p-3">
                <summary className="flex cursor-pointer items-start gap-2 text-sm">
                  {r.correct ? <Check className="mt-0.5 size-4 shrink-0 text-teal" aria-label="Correct" /> : <X className="mt-0.5 size-4 shrink-0 text-coral" aria-label="Wrong" />}
                  <span><span className="text-ink-faint tabular">{i + 1}.</span> {r.question.question}</span>
                </summary>
                <div className="mt-2 pl-6 text-sm">
                  <p>Your answer: <strong>{r.chosen ?? '—'}</strong></p>
                  {!r.correct && <p>Correct: <strong className="text-teal">{r.question.correctAnswer}</strong></p>}
                  {r.question.explanation && <p className="mt-1 text-ink-muted">{r.question.explanation}</p>}
                </div>
              </details>
            </li>
          ))}
        </ol>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Link to={retake} className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink">Retake</Link>
        <Link to="/quizzes" className="inline-flex h-11 items-center rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold">Back to quizzes</Link>
        {answers.some((r) => !r.correct) && (
          <AskNovaButton context={{ type: 'attempt', id: a.id }} prompt="Help me understand the questions I got wrong." label="Ask Nova about my mistakes" />
        )}
      </div>
    </div>
  );
}

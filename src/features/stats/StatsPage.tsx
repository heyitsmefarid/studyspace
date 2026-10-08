import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { format, parseISO, startOfDay, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from 'date-fns';
import { formatDuration } from '@/lib/dates';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryError } from '@/components/ui/QueryError';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { RankBadge } from '@/components/sky/RankBadge';
import { useAuth } from '@/features/auth/AuthProvider';
import { DEFAULT_TZ, effectiveStreak, todayInZone } from '@/features/gamification/streak';
import { useMySubjects } from '@/features/subjects/api';
import { useDecks, useDeckStats } from '@/features/flashcards/api';
import { bestScore, focusByDay, focusByMonth, focusByWeek, minutesBySubject, minutesThisWeek, quizAverage, subjectMastery, subjectStrengths } from '@/features/dashboard/stats';
import { useStatsData } from './useStatsData';
import { StatTile } from './StatTile';
import { AccuracyLine, ChartCard, FocusBars, formatMinutes, SubjectBars } from './charts';

type Range = 'days' | 'weeks' | 'months';
const RANGES: Record<Range, { tab: string; label: string; start: (t: Date) => Date }> = {
  days: { tab: 'Days', label: 'Last 14 days', start: (t) => startOfDay(subDays(t, 13)) },
  weeks: { tab: 'Weeks', label: 'Last 12 weeks', start: (t) => startOfWeek(subWeeks(t, 11), { weekStartsOn: 1 }) },
  months: { tab: 'Months', label: 'Last 12 months', start: (t) => startOfMonth(subMonths(t, 11)) },
};
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

export default function StatsPage() {
  const { profile } = useAuth();
  const data = useStatsData();
  const subjects = useMySubjects();
  const decks = useDecks('mine');
  const deckStats = useDeckStats();
  const [now] = useState(() => new Date());
  const [range, setRange] = useState<Range>('days');

  const windowStart = RANGES[range].start(now).toISOString();
  const sessionsIn = useMemo(() => data.sessions.filter((s) => s.started_at >= windowStart), [data.sessions, windowStart]);
  const attemptsIn = useMemo(() => data.attempts.filter((a) => a.finished_at >= windowStart), [data.attempts, windowStart]);

  const focus = useMemo(() => {
    if (range === 'days') return focusByDay(data.sessions, 14, now).map((d) => ({ label: format(parseISO(d.date), 'MMM d'), minutes: d.minutes }));
    if (range === 'weeks') return focusByWeek(data.sessions, 12, now);
    return focusByMonth(data.sessions, 12, now);
  }, [data.sessions, range, now]);

  const bySubject = useMemo(() => {
    const names = new Map((subjects.data ?? []).map((s) => [s.id, s]));
    return [...minutesBySubject(sessionsIn)]
      .filter(([, m]) => m > 0)
      .map(([id, minutes]) => ({ id: id ?? 'none', name: id ? names.get(id)?.name ?? 'Other subject' : 'No subject', color: id ? names.get(id)?.color ?? null : null, minutes }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [sessionsIn, subjects.data]);

  const accuracy = attemptsIn.slice(-20).map((a) => ({ label: format(parseISO(a.finished_at), 'MMM d'), accuracy: a.accuracy }));
  const strengths = subjectStrengths({
    subjects: subjects.data ?? [], attempts: attemptsIn, mastery: subjectMastery(decks.data ?? [], deckStats.data ?? new Map()),
  });

  if (data.error) return <><PageHeader title="Stats" /><QueryError error={data.error} onRetry={data.refetch} retrying={data.isFetching} /></>;
  if (data.isPending || !profile) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-10 w-40" /><Skeleton className="h-48" /><Skeleton className="h-72" /></div>;
  }
  if (data.sessions.length === 0 && data.attempts.length === 0 && data.reviewCount === 0) {
    return (
      <div>
        <PageHeader title="Stats" />
        <EmptyState title="No stars to chart yet" body="Study, review cards or take a quiz — your progress shows up here."
          action={<Link to="/study" className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink">Start a study session</Link>} />
      </div>
    );
  }

  const streak = effectiveStreak(profile.current_streak, profile.last_active_date, todayInZone(profile.timezone ?? DEFAULT_TZ));
  const avg = quizAverage(data.attempts);
  const rangeLabel = RANGES[range].label;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Stats" subtitle="How your sky has grown." />

      <section aria-label="Totals" className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Total study time" value={formatDuration(data.totalFocusSeconds)} sub="All time" />
        <StatTile label="This week" value={formatMinutes(minutesThisWeek(data.sessions, now))} sub="Since Monday" />
        <StatTile label="Flashcards studied" value={data.reviewCount.toLocaleString()} sub="Reviews, all time" />
        <StatTile label="Cards mastered" value={data.masteredCount.toLocaleString()} />
        <StatTile label="Quiz average" value={pct(avg)} sub={`${data.attempts.length} quiz${data.attempts.length === 1 ? '' : 'zes'} this year`} />
        <StatTile label="Best quiz" value={pct(bestScore(data.attempts))} sub="This year" />
        <StatTile label="Streak" value={`${streak} day${streak === 1 ? '' : 's'}`} sub={`Longest ${profile.longest_streak} day${profile.longest_streak === 1 ? '' : 's'}`} />
        <StatTile label="Completed tasks" value={data.completedTasks.toLocaleString()} />
        <Card className="flex flex-col justify-center gap-2 p-4"><p className="text-sm text-ink-muted">Level &amp; rank</p><RankBadge xp={profile.xp} /></Card>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-ink-muted">Range</span>
        <Tabs label="Range" value={range} onValueChange={setRange} items={(Object.keys(RANGES) as Range[]).map((r) => ({ value: r, label: RANGES[r].tab }))} />
      </div>

      <ChartCard
        title="Focus time"
        subtitle={rangeLabel}
        empty={focus.every((f) => f.minutes === 0) ? 'No focus time in this range yet.' : null}
        table={{ columns: [range === 'days' ? 'Day' : range === 'weeks' ? 'Week of' : 'Month', 'Focus'], rows: focus.map((f) => [f.label, formatMinutes(f.minutes)]) }}
      >
        <FocusBars data={focus} />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Time by subject"
          subtitle={rangeLabel}
          empty={bySubject.length === 0 ? 'No sessions in this range yet.' : null}
          table={{ columns: ['Subject', 'Focus'], rows: bySubject.map((s) => [s.name, formatMinutes(s.minutes)]) }}
        >
          <SubjectBars data={bySubject} />
        </ChartCard>
        <ChartCard
          title="Quiz accuracy"
          subtitle={accuracy.length ? `${rangeLabel} · latest ${pct(accuracy.at(-1)!.accuracy)}` : rangeLabel}
          empty={accuracy.length < 2 ? 'Take a couple of quizzes in this range to see a trend.' : null}
          table={{ columns: ['Quiz', 'Accuracy'], rows: attemptsIn.slice(-20).map((a) => [`${a.title} · ${format(parseISO(a.finished_at), 'MMM d')}`, pct(a.accuracy)]) }}
        >
          <AccuracyLine data={accuracy} />
        </ChartCard>
      </div>

      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-lg">Strongest &amp; weakest</h2>
        {strengths.length >= 2 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="rounded-xl bg-teal-soft px-4 py-3 text-sm"><span className="block text-xs text-ink-muted">Strongest</span><strong className="text-ink">{strengths[0]!.name}</strong> · {pct(strengths[0]!.score)}</p>
            <p className="rounded-xl bg-coral-soft px-4 py-3 text-sm"><span className="block text-xs text-ink-muted">Needs the most love</span><strong className="text-ink">{strengths.at(-1)!.name}</strong> · {pct(strengths.at(-1)!.score)}</p>
          </div>
        ) : <p className="text-sm text-ink-muted">Study a couple of subjects to compare them.</p>}
        <p className="text-xs text-ink-faint">Blends quiz accuracy ({rangeLabel.toLowerCase()}) with flashcard mastery.</p>
      </Card>
    </div>
  );
}

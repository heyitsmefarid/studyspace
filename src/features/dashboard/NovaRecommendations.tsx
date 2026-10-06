import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { startOfWeek } from 'date-fns';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { generateRecommendations } from '@/services/ai/aiService';
import type { RecommendationsResult } from '@/services/ai/schemas';
import { useAuth } from '@/features/auth/AuthProvider';
import { DEFAULT_TZ, effectiveStreak, todayInZone } from '@/features/gamification/streak';
import { useAiTask } from '@/features/ai/useAiTask';
import { AiStatus } from '@/features/ai/AiStatus';
import { ProviderBadge } from '@/features/ai/ProviderBadge';
import { useDecks, useDeckStats } from '@/features/flashcards/api';
import { useQuizzes, useRecentAttempts } from '@/features/quizzes/api';
import { useNotes } from '@/features/notes/api';
import { useUpcoming } from '@/features/planner/api';
import { subjectById, useSubjects } from '@/features/subjects/api';
import { useSessions } from '@/features/study/api';
import { buildRecommendationsInput, recsCacheKey, routeForAction } from './recommendations';
import { minutesThisWeek, weakTopicsFrom } from './stats';
import { WidgetCard } from './widgets/WidgetCard';

function readCache(key: string): RecommendationsResult | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null') as RecommendationsResult | null;
    return v && Array.isArray(v.items) ? v : null;
  } catch { return null; }
}
function writeCache(key: string, v: RecommendationsResult) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

/** Nova's picks for today: generated at most once per day (cached per member + date), refreshable on demand. */
export function NovaRecommendations() {
  const { user, profile } = useAuth();
  const [now] = useState(() => new Date());
  const [weekStart] = useState(() => startOfWeek(now, { weekStartsOn: 1 }).toISOString());
  const decks = useDecks('mine');
  const stats = useDeckStats();
  const quizzes = useQuizzes('mine');
  const notes = useNotes({ scope: 'mine' });
  const attempts = useRecentAttempts(20);
  const subjects = useSubjects();
  const sessions = useSessions(weekStart);
  const exams = useUpcoming({ days: 14, kinds: ['exam'] });

  const today = todayInZone(profile?.timezone ?? DEFAULT_TZ, now);
  const cacheKey = recsCacheKey(user?.id ?? 'anon', today);
  const [cached, setCached] = useState(() => readCache(cacheKey));
  const task = useAiTask(generateRecommendations, { onSuccess: (r) => { writeCache(cacheKey, r); setCached(r); } });

  const ready = !decks.isPending && !stats.isPending && !quizzes.isPending && !notes.isPending && !attempts.isPending && !sessions.isPending && !subjects.isPending && !exams.isPending;
  const hasData = (notes.data?.length ?? 0) + (decks.data?.length ?? 0) + (quizzes.data?.length ?? 0) > 0;

  const buildInput = () => buildRecommendationsInput({
    today,
    streak: profile ? effectiveStreak(profile.current_streak, profile.last_active_date, today) : 0,
    minutesThisWeek: minutesThisWeek(sessions.data ?? [], now),
    decks: (decks.data ?? []).map((d) => ({ id: d.id, title: d.title, masteryPct: stats.data?.get(d.id)?.masteredPct ?? 0, due: stats.data?.get(d.id)?.due ?? 0 })),
    quizzes: (quizzes.data ?? []).map((q) => ({ id: q.id, title: q.title })),
    notes: (notes.data ?? []).map((n) => ({ id: n.id, title: n.title || 'Untitled' })),
    weakTopics: weakTopicsFrom(attempts.data ?? []).map((w) => ({ topic: w.topic, subjectName: subjectById(subjects.data, w.subjectId)?.name })),
    exams: exams.items.map((o) => ({ id: o.task.id, title: o.task.title, date: o.date, subjectName: subjectById(subjects.data, o.task.subject_id)?.name })),
  });

  const started = useRef(false);
  useEffect(() => {
    if (cached || started.current || !ready || !hasData) return;
    started.current = true;
    void task.run(buildInput());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- generate once per day when the data is in
  }, [cached, ready, hasData]);

  if (ready && !hasData) return null;
  const items = (task.status === 'success' ? task.data?.items : cached?.items) ?? [];
  const busy = task.status === 'loading';

  return (
    <WidgetCard title="✦ Nova suggests">
      {!ready ? <Skeleton className="h-28" /> : (
        <>
          {task.status !== 'idle' && task.status !== 'success' && <AiStatus task={task} loadingLabel="Nova is looking at your week…" emptyTitle="Nothing to suggest yet" />}
          {!busy && items.length > 0 && (
            <ul className="stagger flex flex-col gap-2">
              {items.map((it) => (
                <li key={`${it.title}-${it.action.type}`}>
                  <Link to={routeForAction(it.action)} className="group flex items-start gap-3 rounded-xl border border-line px-3 py-2.5 hover:border-primary">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{it.title}</span>
                      {it.reason && <span className="block text-xs text-ink-muted">{it.reason}</span>}
                    </span>
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-ink-faint group-hover:text-primary" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex items-center justify-between gap-2">
            <ProviderBadge meta={task.meta} />
            <Button variant="ghost" size="sm" onClick={() => void task.run(buildInput())} disabled={busy}><RefreshCw className="size-4" /> Refresh</Button>
          </div>
        </>
      )}
    </WidgetCard>
  );
}

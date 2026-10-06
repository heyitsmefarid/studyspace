import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfDay, subDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDeckStats } from '@/features/flashcards/api';
import { useTotalFocusSeconds } from '@/features/gamification/api';
import { useSessions } from '@/features/study/api';

/** Everything the stats page charts: a year of sessions and attempts, plus all-time counters. */
export function useStatsData() {
  const { user } = useAuth();
  const uid = user?.id;
  const [since] = useState(() => subDays(startOfDay(new Date()), 365).toISOString());
  const sessions = useSessions(since);
  const totalFocusSeconds = useTotalFocusSeconds(uid);
  const deckStats = useDeckStats();

  const attempts = useQuery({
    queryKey: ['stats', 'attempts', uid, since],
    enabled: Boolean(uid),
    queryFn: async () => unwrap(await supabase.from('quiz_attempts').select('accuracy, finished_at, subject_id, topic_breakdown, title')
      .eq('user_id', uid!).not('finished_at', 'is', null).gte('finished_at', since).order('finished_at')),
  });
  const reviews = useQuery({
    queryKey: ['stats', 'reviews', uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const r = await supabase.from('review_events').select('id', { count: 'exact', head: true }).eq('user_id', uid!);
      if (r.error) throw r.error;
      return r.count ?? 0;
    },
  });
  const completions = useQuery({
    queryKey: ['stats', 'completions', uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const r = await supabase.from('task_completions').select('id', { count: 'exact', head: true }).eq('user_id', uid!);
      if (r.error) throw r.error;
      return r.count ?? 0;
    },
  });

  const masteredCount = [...(deckStats.data?.values() ?? [])].reduce((n, s) => n + s.states.filter((x) => x === 'mastered').length, 0);
  return {
    sessions: sessions.data ?? [],
    attempts: (attempts.data ?? []).map((a) => ({ ...a, accuracy: Number(a.accuracy), finished_at: a.finished_at! })),
    reviewCount: reviews.data ?? 0,
    masteredCount,
    completedTasks: completions.data ?? 0,
    totalFocusSeconds,
    isPending: sessions.isPending || attempts.isPending || reviews.isPending || completions.isPending || deckStats.isPending,
  };
}

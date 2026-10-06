import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { format, startOfDay, subDays } from 'date-fns';
import { BookOpen } from 'lucide-react';
import { formatDuration, greetingFor } from '@/lib/dates';
import { Skeleton } from '@/components/ui/Skeleton';
import { Comet } from '@/components/sky/Comet';
import { RankBadge } from '@/components/sky/RankBadge';
import { StarField } from '@/components/sky/StarField';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTotalFocusSeconds } from '@/features/gamification/api';
import { DEFAULT_TZ, effectiveStreak, todayInZone } from '@/features/gamification/streak';
import { useSubjects } from '@/features/subjects/api';
import { useDecks, useDeckStats } from '@/features/flashcards/api';
import { useSessions } from '@/features/study/api';
import { subjectMastery } from './stats';

export function YourSky() {
  const { user, profile } = useAuth();
  const [now] = useState(() => new Date());
  const [since] = useState(() => subDays(startOfDay(now), 365).toISOString());
  const sessions = useSessions(since);
  const subjects = useSubjects();
  const decks = useDecks('mine');
  const stats = useDeckStats();
  const focus = useTotalFocusSeconds(user?.id);

  const skySubjects = useMemo(() => {
    const mastery = subjectMastery(decks.data ?? [], stats.data ?? new Map());
    return (subjects.data ?? []).map((s) => ({ id: s.id, name: s.name, color: s.color, mastery: mastery.get(s.id) ?? 0 }));
  }, [subjects.data, decks.data, stats.data]);

  if (!profile) return <Skeleton className="h-72 rounded-3xl" />;
  const streak = effectiveStreak(profile.current_streak, profile.last_active_date, todayInZone(profile.timezone ?? DEFAULT_TZ));
  const list = sessions.data ?? [];
  const empty = !sessions.isPending && list.length === 0;

  return (
    <section aria-label="Your sky" className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="relative">
        <StarField sessions={list} subjects={skySubjects} meColor={profile.star_color} ariaLabel="Your sky" />
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-surface/90 via-surface/40 to-transparent p-5 pb-10">
          <h1 className="font-display text-3xl leading-tight">{greetingFor(now)}, {profile.display_name}</h1>
          <p className="text-sm text-ink-muted">{format(now, 'EEEE, MMMM d')}</p>
        </div>
        {empty && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 pt-20 text-center">
            <div className="flex flex-col items-center gap-2">
              <span aria-hidden className="size-2 rounded-full bg-gold opacity-60 shadow-glow" />
              <p className="max-w-xs text-sm text-ink-muted">Your first study session lights your first star.</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line px-5 py-4">
        <Comet streak={streak} size="sm" />
        <p className="text-sm"><span className="text-ink-muted">Total focus</span> <strong className="tabular">{formatDuration(focus)}</strong></p>
        <div className="w-36"><RankBadge xp={profile.xp} compact /></div>
        <span className="flex-1" />
        <Link to="/study" className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink shadow-glow">
          <BookOpen className="size-4" /> Start studying
        </Link>
      </div>
    </section>
  );
}

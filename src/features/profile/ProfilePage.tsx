import { Link, useParams } from 'react-router';
import { Pencil } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/sky/Avatar';
import { Comet } from '@/components/sky/Comet';
import { RankBadge } from '@/components/sky/RankBadge';
import { formatDuration } from '@/lib/dates';
import { useAuth } from '@/features/auth/AuthProvider';
import { effectiveStreak, todayInZone } from '@/features/gamification/streak';
import { useTotalFocusSeconds } from '@/features/gamification/api';
import { AchievementsGrid } from '@/features/gamification/AchievementsGrid';
import { GoalsList } from '@/features/goals/GoalsList';
import { useSubjects } from '@/features/subjects/api';
import { SubjectDot } from '@/features/subjects/SubjectDot';

export default function ProfilePage() {
  const { userId } = useParams();
  const { profile: me, partner } = useAuth();
  const isSelf = !userId || userId === me?.id;
  const p = isSelf ? me : partner?.id === userId ? partner : null;
  const focus = useTotalFocusSeconds(p?.id);
  const subjects = useSubjects();

  if (!p) return <EmptyState title="No star here" body="That profile isn't part of your sky." />;
  const streak = effectiveStreak(p.current_streak, p.last_active_date, todayInZone(p.timezone));
  const mySubjects = (subjects.data ?? []).filter((s) => s.owner_id === p.id);

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
        <span className="animate-pop-in rounded-full p-1 shadow-[0_0_0_2px_var(--primary-soft),0_0_24px_var(--primary-soft)]"><Avatar profile={p} size={96} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <h1 className="font-display text-3xl">{p.display_name || 'Unnamed star'}</h1>
            {isSelf && (
              <Link to="/settings/profile" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-primary hover:bg-primary-soft">
                <Pencil className="size-3.5" /> Edit profile
              </Link>
            )}
          </div>
          {p.bio && <p className="mt-2 text-ink-muted">{p.bio}</p>}
          <div className="mt-4 max-w-xs"><RankBadge xp={p.xp} /></div>
        </div>
      </Card>

      <div className="stagger mt-4 grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-ink-muted">Streak</p><div className="mt-2"><Comet streak={streak} size="sm" /></div></Card>
        <Card><p className="text-sm text-ink-muted">Total focus</p><p className="mt-1 font-display text-2xl tabular">{formatDuration(focus)}</p></Card>
        <Card><p className="text-sm text-ink-muted">Longest streak</p><p className="mt-1 font-display text-2xl tabular">{p.longest_streak} days</p></Card>
      </div>

      <Card className="mt-4">
        <h2 className="font-display text-lg">Subjects</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {mySubjects.length === 0 && <p className="text-sm text-ink-muted">No subjects yet.</p>}
          {mySubjects.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-sm">
              <SubjectDot color={s.color} /> {s.name}
            </span>
          ))}
        </div>
      </Card>
      <Card className="mt-4"><AchievementsGrid userId={p.id} /></Card>
      <Card className="mt-4">
        {isSelf
          ? <GoalsList title="Goals" filter={(g) => g.owner_id === p.id} canCreate />
          : <GoalsList title="Shared goals" filter={(g) => g.owner_id === p.id && g.is_shared} />}
      </Card>
    </div>
  );
}

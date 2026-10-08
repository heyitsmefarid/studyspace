import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/Progress';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGoals, useWeeklyTotals } from '@/features/goals/api';
import { GoalDialog } from '@/features/goals/GoalDialog';
import { goalProgress, pickCurrentGoals } from '@/features/goals/progress';
import { WidgetCard } from './WidgetCard';

export function CurrentGoals() {
  const { user } = useAuth();
  const goals = useGoals();
  const weekly = useWeeklyTotals();
  const [open, setOpen] = useState(false);
  const picked = pickCurrentGoals((goals.data ?? []).filter((g) => g.owner_id === user?.id || g.is_shared), (g) => goalProgress(g, weekly));
  return (
    <WidgetCard title="Current goals" more={{ to: '/profile', label: 'All goals' }}>
      {goals.isPending ? <Skeleton className="h-24" /> : picked.length === 0 ? (
        <div className="flex flex-col items-start gap-2 text-sm text-ink-muted">
          No goals in progress.
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Set a goal</Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {picked.map((g) => {
            const p = goalProgress(g, weekly);
            return (
              <li key={g.id}>
                <div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate">{g.title}</span><span className="tabular text-ink-muted">{p.value}/{p.target}</span></div>
                <ProgressBar value={p.ratio} label={`${g.title}: ${p.value} of ${p.target}`} />
              </li>
            );
          })}
        </ul>
      )}
      {open && <GoalDialog open={open} onOpenChange={setOpen} />}
    </WidgetCard>
  );
}

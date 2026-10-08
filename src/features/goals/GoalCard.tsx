import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Minus, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Menu } from '@/components/ui/Menu';
import { ProgressBar } from '@/components/ui/Progress';
import { useAuth } from '@/features/auth/AuthProvider';
import { useBumpGoal, useDeleteGoal, type Goal } from './api';
import { GOAL_KIND_LABEL, goalProgress, type GoalKind, type WeekTotals } from './progress';

export function GoalCard({ goal, weekly, onEdit }: { goal: Goal; weekly: Map<string, WeekTotals>; onEdit: () => void }) {
  const { user, partner } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const bump = useBumpGoal();
  const del = useDeleteGoal();
  const p = goalProgress(goal, weekly);
  const mine = goal.owner_id === user?.id;
  const meta = [GOAL_KIND_LABEL[goal.kind as GoalKind] ?? goal.kind, goal.is_shared && 'shared', !mine && (partner?.display_name || 'your partner'),
    goal.due_date && `due ${format(parseISO(goal.due_date), 'MMM d')}`].filter(Boolean).join(' · ');
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="truncate font-semibold">{goal.title}</p><p className="text-xs text-ink-muted">{meta}</p></div>
        {mine && (
          <Menu trigger={<button className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-2" aria-label="Goal options"><MoreHorizontal className="size-4" /></button>}
            items={[{ label: 'Edit', icon: Pencil, onSelect: onEdit }, { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setConfirming(true) }]} />
        )}
      </div>
      <ProgressBar value={p.ratio} tone={p.done ? 'gold' : 'primary'} label={`${goal.title}: ${p.value} of ${p.target}`} />
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="tabular">{p.value} / {p.target}</span>
        {p.done && <span className="inline-flex animate-pop-in items-center gap-1 font-semibold text-gold"><Sparkles className="size-4" aria-hidden />{goal.kind === 'custom' ? 'Completed ✓' : 'Done this week ✓'}</span>}
        {goal.kind === 'custom' && mine && (
          <span className="flex gap-1">
            <Button size="icon" variant="secondary" aria-label="One less" disabled={goal.progress <= 0} onClick={() => bump.mutate({ goal, delta: -1 })}><Minus className="size-4" /></Button>
            <Button size="icon" variant="secondary" aria-label="One more" onClick={() => bump.mutate({ goal, delta: 1 })}><Plus className="size-4" /></Button>
          </span>
        )}
      </div>
      <ConfirmDialog open={confirming} onOpenChange={setConfirming} title="Delete this goal?" body={`“${goal.title}” will be removed.`} confirmLabel="Delete" danger
        onConfirm={() => del.mutateAsync(goal.id)} />
    </Card>
  );
}

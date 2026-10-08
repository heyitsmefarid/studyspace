import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useGoals, useWeeklyTotals, type Goal } from './api';
import { GoalCard } from './GoalCard';
import { GoalDialog } from './GoalDialog';

export function GoalsList({ title, filter, canCreate = false, defaultShared }: { title: string; filter: (g: Goal) => boolean; canCreate?: boolean; defaultShared?: boolean }) {
  const goals = useGoals();
  const weekly = useWeeklyTotals();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [open, setOpen] = useState(false);
  const list = (goals.data ?? []).filter(filter);
  const openFor = (g: Goal | null) => { setEditing(g); setOpen(true); };
  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg">{title}</h2>
        {canCreate && <Button size="sm" variant="secondary" onClick={() => openFor(null)}><Plus className="size-4" /> New goal</Button>}
      </div>
      {goals.isPending ? <Skeleton className="h-24" />
        : list.length === 0 ? <p className="text-sm text-ink-muted">{canCreate ? 'No goals yet. Set one to aim for this week.' : 'No goals here yet.'}</p>
          : <div className="stagger grid gap-3 sm:grid-cols-2">{list.map((g) => <GoalCard key={g.id} goal={g} weekly={weekly} onEdit={() => openFor(g)} />)}</div>}
      {open && <GoalDialog key={editing?.id ?? 'new'} open={open} onOpenChange={setOpen} goal={editing ?? undefined} defaultShared={defaultShared} />}
    </section>
  );
}

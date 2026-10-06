import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { addDays, format, startOfDay } from 'date-fns';
import { Layers, Play } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDeckStats } from '@/features/flashcards/api';
import { useTasksInRange, useToggleComplete } from '@/features/planner/api';
import { occurrenceKey } from '@/features/planner/recurrence';
import { TaskChip } from '@/features/planner/TaskChip';
import { WidgetCard } from './WidgetCard';

export function TodayCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [start] = useState(() => startOfDay(new Date()));
  const [end] = useState(() => addDays(start, 1));
  const today = format(start, 'yyyy-MM-dd');
  const range = useTasksInRange(start, end);
  const stats = useDeckStats();
  const toggle = useToggleComplete();
  const due = [...(stats.data?.values() ?? [])].reduce((n, s) => n + s.due, 0);

  return (
    <WidgetCard title="Today" more={{ to: `/planner?view=day&date=${today}`, label: 'Planner' }}>
      <Link to="/decks" className="flex items-center gap-3 rounded-xl bg-teal-soft px-3 py-2.5 text-sm">
        <Layers className="size-5 text-teal" aria-hidden />
        <span><strong className="tabular">{stats.isPending ? '…' : due}</strong> card{due === 1 ? '' : 's'} due for review</span>
      </Link>
      {range.isPending ? (
        <div className="flex flex-col gap-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
      ) : range.occurrences.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing scheduled today. <Link to="/planner?new=1" className="text-primary hover:underline">Add something</Link></p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {range.occurrences.map((o) => {
            const done = range.completions.has(occurrenceKey(o.task.id, o.date));
            return (
              <li key={occurrenceKey(o.task.id, o.date)} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <TaskChip occurrence={o} done={done} onToggle={(v) => toggle.mutate({ taskId: o.task.id, date: o.date, done: v })}
                    onOpen={() => navigate(`/planner?view=day&date=${today}`)} />
                </div>
                {o.task.kind === 'study_session' && o.task.owner_id === user?.id && !done && (
                  <Link to={`/study?task=${o.task.id}`} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-gold-soft px-3 text-sm font-semibold text-gold">
                    <Play className="size-4" /> Start
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

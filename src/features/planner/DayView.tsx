import { format } from 'date-fns';
import { Link } from 'react-router';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/AuthProvider';
import { occurrenceKey } from './recurrence';
import { countdownLabel } from './calendar';
import { TaskChip } from './TaskChip';
import type { CalendarViewProps } from './MonthView';

export function DayView({ days, byDate, completions, todayKey, now, onToggle, onOpen, onAdd }:
  Pick<CalendarViewProps, 'days' | 'byDate' | 'completions' | 'todayKey' | 'onToggle' | 'onOpen'> & { now: Date; onAdd: () => void }) {
  const { user } = useAuth();
  const day = days[0]!;
  const key = format(day, 'yyyy-MM-dd');
  const items = byDate.get(key) ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        title={key === todayKey ? 'A clear sky today.' : `A clear sky on ${format(day, 'EEEE')}.`}
        body="Nothing planned. Add a task, or let Nova plan your study sessions."
        action={<Button onClick={onAdd}>Add something</Button>}
      />
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {items.map((o) => {
        const k = occurrenceKey(o.task.id, o.date);
        const done = completions.has(k);
        const mine = o.task.owner_id === user?.id;
        return (
          <li key={k} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <TaskChip occurrence={o} done={done} onToggle={(v) => onToggle(o, v)} onOpen={() => onOpen(o.task)} />
            </div>
            {o.task.kind === 'study_session' && mine && !done && (
              <Link to={`/study?task=${o.task.id}`} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-gold-soft px-3 text-sm font-semibold text-gold">
                <Play className="size-4" /> Start
              </Link>
            )}
            {o.task.kind === 'exam' && <Badge tone="coral" className="shrink-0">{countdownLabel(o.at, now)}</Badge>}
          </li>
        );
      })}
    </ol>
  );
}

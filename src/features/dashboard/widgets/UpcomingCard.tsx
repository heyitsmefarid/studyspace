import { useState } from 'react';
import { Link } from 'react-router';
import { differenceInCalendarDays } from 'date-fns';
import { cn } from '@/lib/cn';
import { useUpcoming } from '@/features/planner/api';
import { occurrenceKey } from '@/features/planner/recurrence';
import { countdownLabel } from '@/features/planner/calendar';
import { kindMeta } from '@/features/planner/kinds';
import { WidgetCard } from './WidgetCard';

export function UpcomingCard() {
  const [now] = useState(() => new Date());
  const items = useUpcoming({ days: 7, kinds: ['assignment', 'exam', 'deadline'] });
  return (
    <WidgetCard title="Coming up" more={{ to: '/planner?view=week', label: 'Week' }}>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">No assignments, exams or deadlines in the next 7 days.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.slice(0, 6).map((o) => {
            const meta = kindMeta(o.task.kind);
            const Icon = meta.icon;
            const soon = differenceInCalendarDays(o.at, now) <= 1;
            return (
              <li key={occurrenceKey(o.task.id, o.date)}>
                <Link to={`/planner?view=day&date=${o.date}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2">
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', meta.className)}><Icon className="size-4" aria-hidden /></span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.task.title}</span>
                  <span className={cn('shrink-0 text-xs font-semibold', soon ? 'text-coral' : 'text-ink-muted')}>{countdownLabel(o.at, now)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

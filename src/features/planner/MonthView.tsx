import { format } from 'date-fns';
import { cn } from '@/lib/cn';
import { occurrenceKey, type Occurrence } from './recurrence';
import type { Task } from './api';
import { kindMeta } from './kinds';
import { dayDropProps } from './calendar';
import { TaskChip } from './TaskChip';

export interface CalendarViewProps {
  days: Date[];
  byDate: Map<string, Occurrence<Task>[]>;
  completions: Set<string>;
  todayKey: string;
  onDayClick: (date: string) => void;
  onToggle: (o: Occurrence<Task>, done: boolean) => void;
  onOpen: (task: Task) => void;
  onDrop: (taskId: string, date: string) => void;
}

const MAX_CHIPS = 3;

export function MonthView({ days, month, byDate, completions, todayKey, onDayClick, onToggle, onOpen, onDrop }: CalendarViewProps & { month: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line text-center text-xs font-semibold text-ink-muted">
        {days.slice(0, 7).map((d) => (
          <div key={d.getDay()} className="py-2"><span className="md:hidden">{format(d, 'EEEEE')}</span><span className="hidden md:inline">{format(d, 'EEE')}</span></div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const key = format(day, 'yyyy-MM-dd');
          const items = byDate.get(key) ?? [];
          const isToday = key === todayKey;
          const label = format(day, 'EEEE, MMMM d');
          return (
            <div
              key={key}
              {...dayDropProps(key, onDrop)}
              className={cn(
                'relative flex min-h-14 min-w-0 flex-col gap-1 border-line p-1 md:min-h-24',
                i % 7 !== 6 && 'border-r', i < days.length - 7 && 'border-b',
                day.getMonth() !== month && 'opacity-50',
              )}
            >
              <button
                type="button"
                onClick={() => onDayClick(key)}
                aria-label={`${label}${items.length ? `, ${items.length} item${items.length > 1 ? 's' : ''}` : ''}`}
                className={cn(
                  'relative z-10 grid size-7 place-items-center self-center rounded-full text-xs tabular hover:bg-surface-2 md:self-start',
                  isToday && 'font-bold text-gold ring-2 ring-gold',
                )}
              >
                {format(day, 'd')}
              </button>
              <div className="hidden min-w-0 flex-col gap-1 md:flex">
                {items.slice(0, MAX_CHIPS).map((o) => (
                  <TaskChip key={occurrenceKey(o.task.id, o.date)} compact occurrence={o} done={completions.has(occurrenceKey(o.task.id, o.date))}
                    onToggle={(done) => onToggle(o, done)} onOpen={() => onOpen(o.task)} />
                ))}
                {items.length > MAX_CHIPS && (
                  <button type="button" onClick={() => onDayClick(key)} className="self-start px-1 text-xs font-semibold text-ink-muted hover:text-ink">
                    +{items.length - MAX_CHIPS} more
                  </button>
                )}
              </div>
              {items.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 md:hidden" aria-hidden>
                  {items.slice(0, 4).map((o) => (
                    <span key={occurrenceKey(o.task.id, o.date)} className={cn('size-1.5 rounded-full', kindMeta(o.task.kind).dot,
                      completions.has(occurrenceKey(o.task.id, o.date)) && 'opacity-40')} />
                  ))}
                </div>
              )}
              <button type="button" tabIndex={-1} aria-hidden onClick={() => onDayClick(key)} className="absolute inset-0 md:hidden" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

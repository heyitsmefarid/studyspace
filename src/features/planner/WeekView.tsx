import { format } from 'date-fns';
import { cn } from '@/lib/cn';
import { occurrenceKey } from './recurrence';
import { dayDropProps } from './calendar';
import { TaskChip } from './TaskChip';
import type { CalendarViewProps } from './MonthView';

export function WeekView({ days, byDate, completions, todayKey, onDayClick, onToggle, onOpen, onDrop }: CalendarViewProps) {
  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-7 md:gap-2 md:overflow-visible md:pb-0">
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const items = byDate.get(key) ?? [];
        const allDay = items.filter((o) => o.task.all_day);
        const timed = items.filter((o) => !o.task.all_day);
        const isToday = key === todayKey;
        const chip = (o: (typeof items)[number]) => (
          <TaskChip key={occurrenceKey(o.task.id, o.date)} compact occurrence={o} done={completions.has(occurrenceKey(o.task.id, o.date))}
            onToggle={(done) => onToggle(o, done)} onOpen={() => onOpen(o.task)} />
        );
        return (
          <section
            key={key}
            {...dayDropProps(key, onDrop)}
            aria-label={format(day, 'EEEE, MMMM d')}
            className={cn('flex w-[78%] shrink-0 snap-start flex-col gap-1.5 rounded-2xl border bg-surface p-2 sm:w-[45%] md:w-auto md:min-w-0', isToday ? 'border-gold' : 'border-line')}
          >
            <button type="button" onClick={() => onDayClick(key)} className="flex items-baseline gap-1.5 rounded-lg px-1 py-0.5 text-left hover:bg-surface-2">
              <span className="text-xs font-semibold uppercase text-ink-muted">{format(day, 'EEE')}</span>
              <span className={cn('font-display text-lg tabular', isToday && 'text-gold')}>{format(day, 'd')}</span>
            </button>
            {allDay.length > 0 && (
              <div className="flex flex-col gap-1 border-b border-line pb-1.5">
                <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">All day</span>
                {allDay.map(chip)}
              </div>
            )}
            {timed.map(chip)}
            {items.length === 0 && <span className="px-1 text-sm text-ink-faint">—</span>}
          </section>
        );
      })}
    </div>
  );
}

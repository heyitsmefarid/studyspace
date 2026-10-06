import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { addDays, format, isSameMonth, parseISO, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { useTasksInRange, useMoveTask, useToggleComplete, useUndatedTasks, type Task } from './api';
import { CALENDAR_VIEWS, groupByDate, rangeFor, shiftDate, type CalendarView } from './calendar';
import type { Occurrence } from './recurrence';
import type { TaskForm } from './taskForm';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { TaskChip } from './TaskChip';
import { TaskDialog } from './TaskDialog';

const VIEW_ITEMS = [{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function titleFor(view: CalendarView, dateKey: string, days: Date[]): string {
  const d = parseISO(dateKey);
  if (view === 'month') return format(d, 'MMMM yyyy');
  if (view === 'day') return format(d, 'EEEE, MMM d');
  const first = days[0]!, last = days[days.length - 1]!;
  return `${format(first, 'MMM d')} – ${format(last, isSameMonth(first, last) ? 'd' : 'MMM d')}`;
}

function Someday({ onOpen, onToggle }: { onOpen: (t: Task) => void; onToggle: (t: Task, done: boolean, doneOn: string | null) => void }) {
  const q = useUndatedTasks();
  const tasks = q.data ?? [];
  if (tasks.length === 0) return null;
  const items = tasks
    .map((t) => ({ task: t, doneOn: t.task_completions[0]?.occurrence_date ?? null }))
    .sort((a, b) => Number(Boolean(a.doneOn)) - Number(Boolean(b.doneOn)));
  const open = items.filter((i) => !i.doneOn).length;
  return (
    <details className="mt-6 rounded-2xl border border-line bg-surface p-4" open={open > 0}>
      <summary className="cursor-pointer font-display text-lg">Someday <span className="text-sm text-ink-muted">· {open} open</span></summary>
      <p className="mt-1 text-xs text-ink-faint">Undated tasks. On a computer, drag one onto a day to schedule it.</p>
      <ul className="stagger mt-3 flex flex-col gap-1.5 [--stagger-step:30ms]">
        {items.map(({ task, doneOn }) => (
          <li key={task.id}>
            <TaskChip occurrence={{ task, date: null, at: null }} done={Boolean(doneOn)} onToggle={(done) => onToggle(task, done, doneOn)} onOpen={() => onOpen(task)} />
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function PlannerPage() {
  const [params, setParams] = useSearchParams();
  const [now] = useState(() => new Date());
  const [fallbackView] = useState<CalendarView>(() => (window.matchMedia('(min-width: 768px)').matches ? 'month' : 'day'));
  const [dialog, setDialog] = useState<{ task?: Task; defaults?: Partial<TaskForm> } | null>(null);
  const todayKey = format(now, 'yyyy-MM-dd');

  const viewParam = params.get('view') as CalendarView | null;
  const view: CalendarView = viewParam && CALENDAR_VIEWS.includes(viewParam) ? viewParam : fallbackView;
  const dateParam = params.get('date');
  const dateKey = dateParam && DATE_RE.test(dateParam) ? dateParam : todayKey;
  const range = useMemo(() => rangeFor(view, dateKey), [view, dateKey]);
  const { occurrences, completions, isPending } = useTasksInRange(range.start, range.end);
  const byDate = useMemo(() => groupByDate(occurrences), [occurrences]);
  const undated = useUndatedTasks();
  const toggle = useToggleComplete();
  const move = useMoveTask();

  const go = (next: { view?: CalendarView; date?: string }) => setParams((p) => {
    const n = new URLSearchParams(p);
    if (next.view) n.set('view', next.view);
    if (next.date) n.set('date', next.date);
    return n;
  }, { replace: true });

  const newFromUrl = params.get('new') === '1';
  const dialogOpen = dialog !== null || newFromUrl;
  const onDialogChange = (o: boolean) => {
    if (o) return;
    setDialog(null);
    if (newFromUrl) setParams((p) => { const n = new URLSearchParams(p); n.delete('new'); return n; }, { replace: true });
  };
  const addOn = (date: string) => setDialog({ defaults: { date } });
  const openTask = (task: Task) => setDialog({ task });
  const onToggle = (o: Occurrence<Task>, done: boolean) => toggle.mutate({ taskId: o.task.id, date: o.date, done });
  const onDrop = (taskId: string, date: string) => {
    const occ = occurrences.find((o) => o.task.id === taskId);
    const task = occ?.task ?? undated.data?.find((t) => t.id === taskId);
    if (task && occ?.date !== date) move.mutate({ task, toDate: date });
  };
  const common = { days: range.days, byDate, completions, todayKey, onToggle, onOpen: openTask };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Planner"
        subtitle="Your sky for the days ahead."
        actions={(
          <>
            <Link to="/planner/ai" className="inline-flex h-11 items-center gap-2 rounded-xl bg-gold-soft px-4 text-sm font-semibold text-gold">
              <Sparkles className="size-4" aria-hidden /> Plan with Nova
            </Link>
            <Button onClick={() => addOn(view === 'day' ? dateKey : todayKey)}><Plus className="size-4" /> Add</Button>
          </>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs label="Calendar view" value={view} onValueChange={(v) => go({ view: v })} items={[...VIEW_ITEMS]} />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label={`Previous ${view}`} onClick={() => go({ date: shiftDate(view, dateKey, -1) })}><ChevronLeft className="size-5" /></Button>
          <Button variant="secondary" size="sm" onClick={() => go({ date: todayKey })} disabled={dateKey === todayKey}>Today</Button>
          <Button variant="ghost" size="icon" aria-label={`Next ${view}`} onClick={() => go({ date: shiftDate(view, dateKey, 1) })}><ChevronRight className="size-5" /></Button>
        </div>
        <h2 className="font-display text-xl" aria-live="polite">{titleFor(view, dateKey, range.days)}</h2>
      </div>

      <div key={view} className="animate-fade-in">
      {isPending ? (
        <Skeleton className={view === 'day' ? 'h-40' : 'h-96'} />
      ) : view === 'month' ? (
        <MonthView {...common} month={parseISO(dateKey).getMonth()} onDayClick={(d) => go({ view: 'day', date: d })} onDrop={onDrop} />
      ) : view === 'week' ? (
        <WeekView {...common} onDayClick={(d) => go({ view: 'day', date: d })} onDrop={onDrop} />
      ) : (
        <DayView {...common} now={startOfDay(now)} onAdd={() => addOn(dateKey)} />
      )}
      </div>

      {view === 'day' && (
        <div className="mt-3 flex justify-between text-sm">
          <button type="button" className="text-ink-muted hover:text-ink" onClick={() => go({ date: format(addDays(parseISO(dateKey), -1), 'yyyy-MM-dd') })}>← {format(addDays(parseISO(dateKey), -1), 'EEE d')}</button>
          <button type="button" className="text-ink-muted hover:text-ink" onClick={() => go({ date: format(addDays(parseISO(dateKey), 1), 'yyyy-MM-dd') })}>{format(addDays(parseISO(dateKey), 1), 'EEE d')} →</button>
        </div>
      )}

      <Someday
        onOpen={openTask}
        onToggle={(task, done, doneOn) => toggle.mutate({ taskId: task.id, date: done ? todayKey : (doneOn ?? todayKey), done })}
      />

      <TaskDialog open={dialogOpen} onOpenChange={onDialogChange} task={dialog?.task} defaults={dialog?.defaults ?? { date: dateKey }} />
    </div>
  );
}

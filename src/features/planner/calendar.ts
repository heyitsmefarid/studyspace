import type { DragEvent } from 'react';
import {
  addDays, addMonths, addWeeks, differenceInCalendarDays, eachDayOfInterval, endOfMonth, format, parseISO, startOfDay,
  startOfMonth, startOfWeek, subDays,
} from 'date-fns';

export type CalendarView = 'month' | 'week' | 'day';
export const CALENDAR_VIEWS: readonly CalendarView[] = ['month', 'week', 'day'];
export const TASK_DRAG_TYPE = 'text/task-id';

/** Visible range for a view around `dateKey` (YYYY-MM-DD): start inclusive, end exclusive, plus each day. */
export function rangeFor(view: CalendarView, dateKey: string): { start: Date; end: Date; days: Date[] } {
  const d = parseISO(dateKey);
  let start: Date, end: Date;
  if (view === 'month') { start = startOfWeek(startOfMonth(d)); end = addWeeks(startOfWeek(endOfMonth(d)), 1); }
  else if (view === 'week') { start = startOfWeek(d); end = addDays(start, 7); }
  else { start = startOfDay(d); end = addDays(start, 1); }
  return { start, end, days: eachDayOfInterval({ start, end: subDays(end, 1) }) };
}

export function shiftDate(view: CalendarView, dateKey: string, dir: 1 | -1): string {
  const d = parseISO(dateKey);
  const next = view === 'month' ? addMonths(d, dir) : view === 'week' ? addWeeks(d, dir) : addDays(d, dir);
  return format(next, 'yyyy-MM-dd');
}

export function groupByDate<T extends { date: string }>(items: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) m.set(it.date, [...(m.get(it.date) ?? []), it]);
  return m;
}

export function countdownLabel(at: Date, now: Date): string {
  const n = differenceInCalendarDays(at, now);
  if (n < 0) return 'Past';
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return `In ${n} days`;
}

/** Drop-target handlers for a calendar day that accepts dragged one-off tasks. */
export function dayDropProps(date: string, onDrop: (taskId: string, date: string) => void) {
  return {
    onDragEnter: (e: DragEvent) => {
      if (e.dataTransfer.types.includes(TASK_DRAG_TYPE)) e.currentTarget.classList.add('drop-glow');
    },
    onDragLeave: (e: DragEvent) => {
      // Moving between child chips fires dragleave on the cell; only clear when the pointer really leaves it.
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) e.currentTarget.classList.remove('drop-glow');
    },
    onDragOver: (e: DragEvent) => {
      if (e.dataTransfer.types.includes(TASK_DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
    },
    onDrop: (e: DragEvent) => {
      const id = e.dataTransfer.getData(TASK_DRAG_TYPE);
      e.currentTarget.classList.remove('drop-glow');
      if (id) { e.preventDefault(); onDrop(id, date); }
    },
  };
}

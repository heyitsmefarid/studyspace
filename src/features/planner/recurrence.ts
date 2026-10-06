import { addDays, addMonths, addWeeks, differenceInCalendarDays, differenceInCalendarMonths, format, isWeekend, parseISO } from 'date-fns';

export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';
export interface RecurringLike { id: string; due_at: string | null; start_at: string | null; recurrence: string; recurrence_until: string | null }
export interface Occurrence<T> { task: T; date: string; at: Date }

export const anchorOf = (t: RecurringLike): Date | null => (t.start_at ?? t.due_at ? parseISO((t.start_at ?? t.due_at)!) : null);
export const occurrenceKey = (taskId: string, date: string) => `${taskId}:${date}`;
const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');

export function expandOccurrences<T extends RecurringLike>(tasks: T[], rangeStart: Date, rangeEnd: Date, maxPerTask = 1000): Occurrence<T>[] {
  const out: Occurrence<T>[] = [];
  for (const task of tasks) {
    const anchor = anchorOf(task);
    if (!anchor) continue;
    const until = task.recurrence_until;
    const push = (at: Date) => {
      if (at >= rangeStart && at < rangeEnd && (!until || dayKey(at) <= until)) out.push({ task, date: dayKey(at), at });
    };
    const rec = task.recurrence as Recurrence;
    if (rec === 'none') { push(anchor); continue; }
    if (rec === 'monthly') {
      const k0 = Math.max(0, differenceInCalendarMonths(rangeStart, anchor) - 1);
      for (let k = k0, n = 0; n < maxPerTask; k++, n++) {
        const at = addMonths(anchor, k);
        if (at >= rangeEnd || (until && dayKey(at) > until)) break;
        push(at);
      }
      continue;
    }
    if (rec === 'weekly') {
      const k0 = Math.max(0, Math.floor(differenceInCalendarDays(rangeStart, anchor) / 7) - 1);
      for (let k = k0, n = 0; n < maxPerTask; k++, n++) {
        const at = addWeeks(anchor, k);
        if (at >= rangeEnd || (until && dayKey(at) > until)) break;
        push(at);
      }
      continue;
    }
    // daily & weekdays
    const k0 = Math.max(0, differenceInCalendarDays(rangeStart, anchor) - 1);
    for (let k = k0, n = 0; n < maxPerTask; k++, n++) {
      const at = addDays(anchor, k);
      if (at >= rangeEnd || (until && dayKey(at) > until)) break;
      if (rec === 'weekdays' && isWeekend(at)) continue;
      push(at);
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

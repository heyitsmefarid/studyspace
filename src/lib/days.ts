import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { todayInZone } from '@/features/gamification/streak';

/** The calendar day (YYYY-MM-DD) an instant falls on in `tz`. */
export const dayKey = (iso: string, tz: string) => todayInZone(tz, new Date(iso));

/** "Today", "Yesterday" or "Mon, Oct 5" for a day key, relative to `todayKey`. */
export function dayLabel(key: string, todayKey: string): string {
  const diff = differenceInCalendarDays(parseISO(todayKey), parseISO(key));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return format(parseISO(key), 'EEE, MMM d');
}

/** Consecutive runs of items on the same local day, in the order given. */
export function groupByDay<T>(items: T[], at: (item: T) => string, tz: string, now: Date) {
  const today = todayInZone(tz, now);
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const key = dayKey(at(item), tz);
    const last = groups.at(-1);
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(key, today), items: [item] });
  }
  return groups;
}

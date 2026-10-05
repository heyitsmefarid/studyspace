import { differenceInCalendarDays, parseISO } from 'date-fns';

export const DEFAULT_TZ = 'Asia/Manila';

export function todayInZone(tz: string, now: Date = new Date()): string {
  const fmt = (zone: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  try {
    return fmt(tz);
  } catch {
    return fmt(DEFAULT_TZ);
  }
}

export function effectiveStreak(current: number, lastActive: string | null, today: string): number {
  if (!lastActive) return 0;
  return differenceInCalendarDays(parseISO(today), parseISO(lastActive)) <= 1 ? current : 0;
}

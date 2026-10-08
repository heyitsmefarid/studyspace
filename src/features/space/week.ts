import { getDay, parseISO, subDays } from 'date-fns';
import { todayInZone } from '@/features/gamification/streak';

/** Offset of `tz` from UTC at the instant `utcMs`, in ms (positive east of Greenwich). */
export function zoneOffsetMs(tz: string, utcMs: number): number {
  const parts: Record<string, string> = {};
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  for (const p of fmt.formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Monday 00:00 of the week containing `now`, in `tz`, as an ISO instant (the "this week" boundary). */
export function weekStartIso(tz: string, now: Date): string {
  const today = parseISO(todayInZone(tz, now));
  const monday = subDays(today, (getDay(today) + 6) % 7);
  const wall = Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const firstGuess = wall - zoneOffsetMs(tz, wall);
  return new Date(wall - zoneOffsetMs(tz, firstGuess)).toISOString(); // second pass settles DST edges
}

import { effectiveStreak, todayInZone } from '@/features/gamification/streak';

export interface SpaceStatsRow {
  user_id: string; focus_seconds_total: number; focus_seconds_week: number; cards_total: number; cards_week: number;
  quizzes_total: number; quizzes_week: number; achievements: number; current_streak: number; longest_streak: number;
  last_active_date: string | null; together_seconds_total: number;
}
export interface MemberBlock { userId: string; streak: number; weekSeconds: number; totalSeconds: number; cardsWeek: number; quizzesWeek: number; achievements: number }

const toBlock = (r: SpaceStatsRow, tz: string, now: Date): MemberBlock => ({
  userId: r.user_id, streak: effectiveStreak(r.current_streak, r.last_active_date, todayInZone(tz, now)),
  weekSeconds: r.focus_seconds_week, totalSeconds: r.focus_seconds_total, cardsWeek: r.cards_week, quizzesWeek: r.quizzes_week, achievements: r.achievements,
});

/** You / partner / together. The partner block is null until they have joined. */
export function spaceBlocks(rows: SpaceStatsRow[], me: { id: string; tz: string }, partner: { id: string; tz: string } | null, now: Date) {
  const mine = rows.find((r) => r.user_id === me.id);
  const theirs = partner ? rows.find((r) => r.user_id === partner.id) : undefined;
  return {
    me: mine ? toBlock(mine, me.tz, now) : null,
    partner: theirs && partner ? toBlock(theirs, partner.tz, now) : null,
    togetherSeconds: mine?.together_seconds_total ?? 0,
  };
}

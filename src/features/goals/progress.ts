export const GOAL_KINDS = ['weekly_minutes', 'weekly_cards', 'weekly_quizzes', 'custom'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];
export const GOAL_KIND_LABEL: Record<GoalKind, string> = {
  weekly_minutes: 'Minutes this week', weekly_cards: 'Cards this week', weekly_quizzes: 'Quizzes this week', custom: 'Custom',
};

export interface GoalLike { owner_id: string; kind: string; target: number; progress: number; is_shared: boolean; due_date: string | null; completed_at: string | null }
export interface WeekTotals { focus_seconds_week: number; cards_week: number; quizzes_week: number }

/** Weekly goals read this week's totals (shared goals sum both members); custom goals use their stored progress. */
export function goalProgress(g: GoalLike, weekly: Map<string, WeekTotals>) {
  const of = (r?: WeekTotals) => (!r ? 0
    : g.kind === 'weekly_minutes' ? Math.floor(r.focus_seconds_week / 60)
      : g.kind === 'weekly_cards' ? r.cards_week : r.quizzes_week);
  const value = g.kind === 'custom' ? Math.max(0, g.progress)
    : g.is_shared ? [...weekly.values()].reduce((s, r) => s + of(r), 0) : of(weekly.get(g.owner_id));
  return { value, target: g.target, ratio: g.target > 0 ? Math.min(1, value / g.target) : 0, done: value >= g.target };
}

/** Dashboard: up to `n` unfinished goals, nearest due date first, then least complete. */
export function pickCurrentGoals<T extends GoalLike>(goals: T[], progressOf: (g: T) => { ratio: number; done: boolean }, n = 3): T[] {
  return goals
    .map((g) => ({ g, p: progressOf(g) }))
    .filter(({ p }) => !p.done)
    .sort((a, b) => {
      const da = a.g.due_date ?? '9999-12-31';
      const db = b.g.due_date ?? '9999-12-31';
      return da === db ? a.p.ratio - b.p.ratio : da.localeCompare(db);
    })
    .slice(0, n)
    .map(({ g }) => g);
}

export interface GoalInput { title: string; kind: GoalKind; target: number; is_shared: boolean; due_date: string | null }

export function validateGoal(i: { title: string; kind: string; target: number; is_shared: boolean; due_date: string | null }):
  | { ok: true; value: GoalInput } | { ok: false; errors: Partial<Record<'title' | 'kind' | 'target', string>> } {
  const errors: Partial<Record<'title' | 'kind' | 'target', string>> = {};
  const title = i.title.trim();
  if (title.length < 1 || title.length > 120) errors.title = 'Give the goal a name (up to 120 characters).';
  if (!(GOAL_KINDS as readonly string[]).includes(i.kind)) errors.kind = 'Pick a kind of goal.';
  if (!Number.isInteger(i.target) || i.target < 1 || i.target > 100_000) errors.target = 'Use a whole number from 1 to 100,000.';
  if (Object.keys(errors).length) return { ok: false, errors };
  const kind = i.kind as GoalKind;
  return { ok: true, value: { title, kind, target: i.target, is_shared: i.is_shared, due_date: kind === 'custom' ? i.due_date : null } };
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Tables } from '@/lib/supabase';
import { assertOk, unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSpaceStats } from '@/features/space/api';
import type { GoalInput, WeekTotals } from './progress';

export type Goal = Tables<'study_goals'>;
export const goalKeys = { all: ['goals'] as const };

/** Your goals plus your partner's shared ones (RLS). */
export function useGoals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: goalKeys.all,
    enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('study_goals').select('*').order('created_at')),
  });
}

export function useWeeklyTotals(): Map<string, WeekTotals> {
  return new Map((useSpaceStats().data ?? []).map((r) => [r.user_id, r]));
}

export function useSaveGoal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...input }: GoalInput & { id?: string }) => {
      if (id) assertOk(await supabase.from('study_goals').update(input).eq('id', id));
      else assertOk(await supabase.from('study_goals').insert({ owner_id: user!.id, ...input }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: goalKeys.all }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => assertOk(await supabase.from('study_goals').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: goalKeys.all }),
  });
}

/** − / + on a custom goal; the first time it reaches its target, completed_at is set (and kept). */
export function useBumpGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ goal, delta }: { goal: Goal; delta: number }) => {
      const progress = Math.max(0, goal.progress + delta);
      const completed_at = goal.completed_at ?? (progress >= goal.target ? new Date().toISOString() : null);
      assertOk(await supabase.from('study_goals').update({ progress, completed_at }).eq('id', goal.id));
    },
    onMutate: ({ goal, delta }) => qc.setQueryData<Goal[]>(goalKeys.all, (l) => l?.map((g) => (g.id === goal.id ? { ...g, progress: Math.max(0, g.progress + delta) } : g))),
    onSettled: () => qc.invalidateQueries({ queryKey: goalKeys.all }),
  });
}

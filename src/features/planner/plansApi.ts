import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Json, type Tables } from '@/lib/supabase';
import { assertOk, unwrap } from '@/lib/errors';
import type { PlanResult } from '@/services/ai/schemas';
import { useAuth } from '@/features/auth/AuthProvider';
import { subjectById, useSubjects } from '@/features/subjects/api';
import { planToTasks, PREFERRED_START } from './planToTasks';
import { taskKeys } from './api';

export type StudyPlan = Tables<'study_plans'>;
export const planKeys = { all: ['plans'] as const };

export function usePlans() {
  const { user } = useAuth();
  return useQuery({
    queryKey: planKeys.all,
    enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('study_plans').select('*').eq('owner_id', user!.id)
      .order('created_at', { ascending: false }).limit(50)),
  });
}

export function useSavePlan() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...v }: { id?: string; title: string; subject_id: string | null; exam_date: string; inputs: unknown; plan: PlanResult }) => {
      const row = { ...v, title: v.title.slice(0, 200), inputs: v.inputs as Json, plan: v.plan as unknown as Json };
      return id
        ? unwrap(await supabase.from('study_plans').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id).select().single())
        : unwrap(await supabase.from('study_plans').insert({ ...row, owner_id: user!.id }).select().single());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: planKeys.all }),
  });
}

/** Tasks already created from the plan stay on the calendar (tasks.plan_id is ON DELETE SET NULL). */
export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => assertOk(await supabase.from('study_plans').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: planKeys.all }),
  });
}

export function useAddPlanToCalendar() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const subjects = useSubjects();
  return useMutation({
    mutationFn: async ({ plan, preferredTime }: { plan: StudyPlan; preferredTime: keyof typeof PREFERRED_START }) => {
      const examStart = new Date(`${plan.exam_date}T00:00:00`);
      const examEnd = new Date(examStart.getTime() + 86_400_000);
      let q = supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).eq('kind', 'exam')
        .gte('due_at', examStart.toISOString()).lt('due_at', examEnd.toISOString());
      if (plan.subject_id) q = q.eq('subject_id', plan.subject_id);
      const existing = await q;
      assertOk(existing);
      const rows = planToTasks({
        plan: plan.plan as unknown as PlanResult, ownerId: user!.id, subjectId: plan.subject_id,
        subjectName: subjectById(subjects.data, plan.subject_id)?.name ?? (plan.inputs as { subject?: string } | null)?.subject ?? 'Exam',
        examDate: plan.exam_date, planId: plan.id, preferredTime, examTaskExists: (existing.count ?? 0) > 0,
      });
      if (rows.length) assertOk(await supabase.from('tasks').insert(rows));
      assertOk(await supabase.from('study_plans').update({ added_to_calendar_at: new Date().toISOString() }).eq('id', plan.id));
      return rows.length;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: taskKeys.all }); void qc.invalidateQueries({ queryKey: planKeys.all }); },
  });
}

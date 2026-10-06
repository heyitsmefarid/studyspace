import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, parseISO, startOfDay } from 'date-fns';
import { supabase, type Tables, type TablesInsert } from '@/lib/supabase';
import { assertOk, unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { expandOccurrences, occurrenceKey, type Occurrence } from './recurrence';
import { toTaskRow, type TaskForm, type TaskKind } from './taskForm';

export type Task = Tables<'tasks'>;
export const taskKeys = {
  all: ['tasks'] as const,
  ranges: ['tasks', 'range'] as const,
  range: (s: string, e: string) => ['tasks', 'range', s, e] as const,
  undated: ['tasks', 'undated'] as const,
};
interface RangeData { tasks: Task[]; completions: Set<string> }

export function useTasksInRange(start: Date, end: Date) {
  const s = start.toISOString(), e = end.toISOString();
  const q = useQuery({
    queryKey: taskKeys.range(s, e),
    queryFn: async (): Promise<RangeData> => {
      const tasks = unwrap(await supabase.from('tasks').select('*')
        .or(`recurrence.neq.none,and(due_at.gte."${s}",due_at.lt."${e}"),and(start_at.gte."${s}",start_at.lt."${e}")`));
      const comps = unwrap(await supabase.from('task_completions').select('task_id, occurrence_date')
        .gte('occurrence_date', format(start, 'yyyy-MM-dd')).lte('occurrence_date', format(end, 'yyyy-MM-dd')));
      return { tasks, completions: new Set(comps.map((c) => occurrenceKey(c.task_id, c.occurrence_date))) };
    },
  });
  return {
    occurrences: q.data ? expandOccurrences(q.data.tasks, start, end) : [],
    completions: q.data?.completions ?? new Set<string>(),
    isPending: q.isPending,
  };
}

export function useUndatedTasks() {
  return useQuery({
    queryKey: taskKeys.undated,
    queryFn: async () => unwrap(await supabase.from('tasks').select('*, task_completions(occurrence_date)').is('due_at', null).is('start_at', null)
      .order('created_at', { ascending: false }).limit(100)),
  });
}

/** Open occurrences from the start of today through the next `days` days. */
export function useUpcoming({ days, kinds }: { days: number; kinds?: TaskKind[] }): Occurrence<Task>[] {
  const [start] = useState(() => startOfDay(new Date()));
  const range = useTasksInRange(start, addDays(start, days + 1));
  return range.occurrences.filter((o) =>
    !range.completions.has(occurrenceKey(o.task.id, o.date)) && (!kinds || kinds.includes(o.task.kind as TaskKind)));
}

export function useCreateTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: TaskForm | TablesInsert<'tasks'>) => {
      const row = 'owner_id' in input ? input : toTaskRow(input, user!.id);
      return unwrap(await supabase.from('tasks').insert(row).select().single());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useCreateTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: TablesInsert<'tasks'>[]) => unwrap(await supabase.from('tasks').insert(rows).select()),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, form }: { id: string; form: TaskForm }) => {
      const { owner_id: _owner, source: _source, ...patch } = toTaskRow(form, user!.id);
      return unwrap(await supabase.from('tasks').update(patch).eq('id', id).select().single());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

/** Moves a one-off task to another day, keeping its local time of day; an undated task becomes all-day on that date. */
export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ task, toDate }: { task: Task; toDate: string }) => {
      const current = task.start_at ?? task.due_at;
      const [y, m, d] = toDate.split('-').map(Number) as [number, number, number];
      if (!current) {
        const at = new Date(y, m - 1, d).toISOString();
        const patch = task.kind === 'study_session' ? { start_at: at, all_day: true } : { due_at: at, all_day: true };
        assertOk(await supabase.from('tasks').update(patch).eq('id', task.id));
        return;
      }
      const moved = parseISO(current);
      moved.setFullYear(y, m - 1, d);
      const patch = task.start_at ? { start_at: moved.toISOString() } : { due_at: moved.toISOString() };
      assertOk(await supabase.from('tasks').update(patch).eq('id', task.id));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => assertOk(await supabase.from('tasks').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useToggleComplete() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ taskId, date, done }: { taskId: string; date: string; done: boolean }) => {
      if (done) assertOk(await supabase.from('task_completions').insert({ task_id: taskId, user_id: user!.id, occurrence_date: date }));
      else assertOk(await supabase.from('task_completions').delete().eq('task_id', taskId).eq('occurrence_date', date));
    },
    onMutate: async ({ taskId, date, done }) => {
      await qc.cancelQueries({ queryKey: taskKeys.ranges });
      const snapshots = qc.getQueriesData<RangeData>({ queryKey: taskKeys.ranges });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        const next = new Set(data.completions);
        if (done) next.add(occurrenceKey(taskId, date)); else next.delete(occurrenceKey(taskId, date));
        qc.setQueryData<RangeData>(key, { ...data, completions: next });
      }
      return { snapshots };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => { void qc.invalidateQueries({ queryKey: taskKeys.all }); void qc.invalidateQueries({ queryKey: ['profiles'] }); },
  });
}

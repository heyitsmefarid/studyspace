import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Tables, type TablesUpdate } from '@/lib/supabase';
import { assertOk, unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { nextSubjectColor } from './colors';

export type Subject = Tables<'subjects'>;
export const subjectKeys = { all: ['subjects'] as const };

export function useSubjects() {
  return useQuery({ queryKey: subjectKeys.all, queryFn: async () => unwrap(await supabase.from('subjects').select('*').order('name')) });
}
export function useMySubjects() {
  const { user } = useAuth();
  const q = useSubjects();
  return { ...q, data: q.data?.filter((s) => s.owner_id === user?.id) };
}
export const subjectById = (list: Subject[] | undefined, id: string | null | undefined) => (id ? list?.find((s) => s.id === id) : undefined);

export function useCreateSubject() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }) => {
      const mine = (qc.getQueryData<Subject[]>(subjectKeys.all) ?? []).filter((s) => s.owner_id === user!.id);
      return unwrap(await supabase.from('subjects')
        .insert({ owner_id: user!.id, name: name.trim(), color: color ?? nextSubjectColor(mine.map((s) => s.color)) })
        .select().single());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: subjectKeys.all }),
  });
}
export function useUpdateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<'subjects'> }) => assertOk(await supabase.from('subjects').update(patch).eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: subjectKeys.all }),
  });
}
export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => assertOk(await supabase.from('subjects').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: subjectKeys.all }),
  });
}

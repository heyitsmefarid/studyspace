import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Tables } from '@/lib/supabase';
import { assertOk, unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';

export type Folder = Tables<'folders'>;
const keys = { all: ['folders'] as const };

export function useFolders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.all,
    enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('folders').select('*').eq('owner_id', user!.id).order('name')),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => { void qc.invalidateQueries({ queryKey: keys.all }); void qc.invalidateQueries({ queryKey: ['notes'] }); };
}

export function useCreateFolder() {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ name, subject_id = null }: { name: string; subject_id?: string | null }) =>
      unwrap(await supabase.from('folders').insert({ owner_id: user!.id, name: name.trim(), subject_id }).select().single()),
    onSuccess: invalidate,
  });
}

export function useRenameFolder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => assertOk(await supabase.from('folders').update({ name: name.trim() }).eq('id', id)),
    onSuccess: invalidate,
  });
}

export function useDeleteFolder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => assertOk(await supabase.from('folders').delete().eq('id', id)),
    onSuccess: invalidate,
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type TablesUpdate } from '@/lib/supabase';
import { assertOk } from '@/lib/errors';
import { mergePreferences, type PreferencesPatch } from '@/lib/preferences';
import { useAuth, type Profile } from './AuthProvider';

type ProfilePatch = Pick<TablesUpdate<'profiles'>, 'display_name' | 'avatar_path' | 'bio' | 'star_color' | 'timezone' | 'onboarded_at'>;

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => assertOk(await supabase.from('profiles').update(patch).eq('id', user!.id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  const { user, preferences } = useAuth();
  return useMutation({
    mutationFn: async (patch: PreferencesPatch) => {
      const next = mergePreferences(preferences, patch);
      assertOk(await supabase.from('profiles').update({ preferences: next }).eq('id', user!.id));
      return next;
    },
    onMutate: async (patch) => {
      const prev = qc.getQueryData<Profile[]>(['profiles']);
      qc.setQueryData<Profile[]>(['profiles'], (list) => list?.map((p) => (p.id === user!.id ? { ...p, preferences: mergePreferences(preferences, patch) } : p)));
      return { prev };
    },
    onError: (_e, _p, ctx) => qc.setQueryData(['profiles'], ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });
}

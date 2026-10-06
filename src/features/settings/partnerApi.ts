import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { assertOk, unwrapMaybe } from '@/lib/errors';

const pendingKey = ['pending-invite'] as const;

/** The email the first member has invited, until that person signs up. */
export function usePendingInvite(enabled: boolean) {
  return useQuery({
    queryKey: pendingKey,
    enabled,
    queryFn: async () => unwrapMaybe(await supabase.rpc('pending_invite')),
  });
}

export function useInvitePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => assertOk(await supabase.rpc('invite_partner', { p_email: email })),
    onSuccess: () => qc.invalidateQueries({ queryKey: pendingKey }),
  });
}

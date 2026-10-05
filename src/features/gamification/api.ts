import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';

export function useXpSince(sinceIso: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['xp-since', sinceIso],
    enabled: Boolean(user && sinceIso),
    queryFn: async () => unwrap(await supabase.from('xp_events').select('amount').gte('created_at', sinceIso!)).reduce((s, r) => s + r.amount, 0),
  }).data ?? 0;
}

export function useTotalFocusSeconds(userId: string | undefined) {
  return useQuery({
    queryKey: ['focus-total', userId],
    enabled: Boolean(userId),
    queryFn: async () => unwrap(await supabase.from('study_sessions').select('focus_seconds').eq('user_id', userId!)).reduce((s, r) => s + r.focus_seconds, 0),
  }).data ?? 0;
}

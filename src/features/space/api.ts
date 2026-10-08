import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { DEFAULT_TZ } from '@/features/gamification/streak';
import { useTableChange } from '@/features/realtime/useRealtime';
import { weekStartIso } from './week';

export const spaceKeys = { all: ['space'] as const, stats: (week: string) => ['space', 'stats', week] as const, feed: ['space', 'feed'] as const };

export function useSpaceStats() {
  const { profile } = useAuth();
  const [week] = useState(() => weekStartIso(profile?.timezone ?? DEFAULT_TZ, new Date()));
  return useQuery({
    queryKey: spaceKeys.stats(week),
    enabled: Boolean(profile),
    queryFn: async () => unwrap(await supabase.rpc('get_space_stats', { p_week_start: week })),
  });
}

export function useSpaceFeed() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: spaceKeys.feed,
    enabled: Boolean(profile),
    queryFn: async () => unwrap(await supabase.rpc('space_feed', { p_limit: 30 })),
  });
}

/** Mounted once: any study session change refreshes Our Space and the session lists. */
export function useSpaceSync() {
  const qc = useQueryClient();
  useTableChange('study_sessions', () => {
    void qc.invalidateQueries({ queryKey: spaceKeys.all });
    void qc.invalidateQueries({ queryKey: ['sessions'] });
  });
}

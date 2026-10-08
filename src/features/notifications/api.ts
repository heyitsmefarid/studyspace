import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase, type Tables } from '@/lib/supabase';
import { assertOk, unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { markRead, prependUnique, removeById } from './cache';

export type AppNotification = Tables<'notifications'>;
export const notificationKeys = { all: ['notifications'] as const, list: ['notifications', 'list'] as const };

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: notificationKeys.list,
    enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(200)),
  });
}

/** Unread counts: the bell shows `total`, the Chat nav item `messages`. */
export function useUnread() {
  const unread = (useNotifications().data ?? []).filter((n) => !n.read_at);
  const messageIds = unread.filter((n) => n.kind === 'message').map((n) => n.id);
  return { total: unread.length, messages: messageIds.length, messageIds };
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[] | 'all') => {
      const q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
      assertOk(await (ids === 'all' ? q : q.in('id', ids)));
    },
    onMutate: (ids) => {
      const at = new Date().toISOString();
      qc.setQueryData<AppNotification[]>(notificationKeys.list, (l) => l && markRead(l, ids, at));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => assertOk(await supabase.from('notifications').delete().eq('id', id)),
    onMutate: (id) => qc.setQueryData<AppNotification[]>(notificationKeys.list, (l) => l && removeById(l, id)),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function addIncomingNotification(qc: QueryClient, row: AppNotification) {
  if (qc.getQueryData(notificationKeys.list)) qc.setQueryData<AppNotification[]>(notificationKeys.list, (l) => l && prependUnique(l, row));
  else void qc.invalidateQueries({ queryKey: notificationKeys.all });
}

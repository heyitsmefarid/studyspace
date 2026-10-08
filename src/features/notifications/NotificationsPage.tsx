import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { groupByDay } from '@/lib/days';
import { useAuth } from '@/features/auth/AuthProvider';
import { DEFAULT_TZ } from '@/features/gamification/streak';
import { useDeleteNotification, useMarkRead, useNotifications, useUnread, type AppNotification } from './api';
import { NotificationItem } from './NotificationItem';

export default function NotificationsPage() {
  const { profile } = useAuth();
  const list = useNotifications();
  const { total } = useUnread();
  const markRead = useMarkRead();
  const remove = useDeleteNotification();
  const navigate = useNavigate();
  const [now] = useState(() => new Date());
  const go = (n: AppNotification) => { if (!n.read_at) markRead.mutate([n.id]); if (n.link) navigate(n.link); };
  const groups = groupByDay(list.data ?? [], (n) => n.created_at, profile?.timezone ?? DEFAULT_TZ, now);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notifications" actions={<Button variant="secondary" disabled={total === 0} onClick={() => markRead.mutate('all')}>Mark all read</Button>} />
      {list.isPending && <Skeleton className="h-60" />}
      {list.isError && <QueryError error={list.error} onRetry={list.refetch} retrying={list.isFetching} />}
      {!list.isPending && !list.isError && groups.length === 0 && <EmptyState title="All quiet in your sky" body="Reminders, messages and shared notes will land here." />}
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.key} aria-label={g.label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{g.label}</h2>
            <div className="stagger flex flex-col gap-1 [--stagger-step:30ms]">
              {g.items.map((n) => <NotificationItem key={n.id} n={n} onOpen={() => go(n)} onDelete={() => remove.mutate(n.id)} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

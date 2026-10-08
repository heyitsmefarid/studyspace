import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Popover as R } from 'radix-ui';
import { Bell as BellIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useMarkRead, useNotifications, useUnread, type AppNotification } from './api';
import { NotificationItem } from './NotificationItem';

export function Bell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const latest = (useNotifications().data ?? []).slice(0, 5);
  const { total } = useUnread();
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const go = (n: AppNotification) => {
    setOpen(false);
    if (!n.read_at) markRead.mutate([n.id]);
    if (n.link) navigate(n.link);
  };
  return (
    <R.Root open={open} onOpenChange={setOpen}>
      <R.Trigger asChild>
        <button className={cn('relative grid size-10 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-surface-2 hover:text-ink', className)}
          aria-label={total ? `Notifications, ${total} unread` : 'Notifications'}>
          <BellIcon className="size-5" />
          {total > 0 && (
            <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 animate-pop-in place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-primary-ink">
              {total > 9 ? '9+' : total}
            </span>
          )}
        </button>
      </R.Trigger>
      <R.Portal>
        <R.Content align="end" sideOffset={8}
          className="z-50 w-80 max-w-[calc(100vw-1rem)] rounded-2xl border border-line bg-raised p-2 shadow-glow data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="font-display text-lg">Notifications</p>
            {total > 0 && <button onClick={() => markRead.mutate('all')} className="text-xs text-primary hover:underline">Mark all read</button>}
          </div>
          {latest.length === 0
            ? <p className="px-2 py-6 text-center text-sm text-ink-muted">All quiet in your sky.</p>
            : <div className="flex flex-col gap-1">{latest.map((n) => <NotificationItem key={n.id} n={n} onOpen={() => go(n)} />)}</div>}
          <Link to="/notifications" onClick={() => setOpen(false)} className="mt-1 block rounded-xl px-2 py-2 text-center text-sm font-semibold text-primary hover:bg-surface-2">
            See all
          </Link>
        </R.Content>
      </R.Portal>
    </R.Root>
  );
}

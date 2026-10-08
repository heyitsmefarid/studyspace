import { Link } from 'react-router';
import { Sheet } from '@/components/ui/Sheet';
import { Badge } from '@/components/ui/Badge';
import { useUnread } from '@/features/notifications/api';
import { MORE_ITEMS } from './nav';

export function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { messages: unreadMessages } = useUnread();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="More">
      <div className="stagger grid grid-cols-2 gap-3 [--stagger-step:30ms]">
        {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => onOpenChange(false)}
            className="flex min-h-20 flex-col items-start justify-between rounded-2xl border border-line bg-surface-2 p-3 hover:border-line-strong"
          >
            <Icon className="size-5 text-primary" aria-hidden />
            <span className="flex w-full items-center justify-between text-sm font-semibold">
              {label}
              {to === '/chat' && unreadMessages > 0 && <Badge tone="coral">{unreadMessages}</Badge>}
            </span>
          </Link>
        ))}
      </div>
    </Sheet>
  );
}

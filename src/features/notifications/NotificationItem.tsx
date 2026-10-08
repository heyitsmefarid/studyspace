import { formatDistanceToNowStrict } from 'date-fns';
import { Award, CalendarClock, FileText, Flame, GraduationCap, Layers, MessageCircle, Timer, Trash2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { AppNotification } from './api';

const ICON: Record<string, LucideIcon> = {
  deadline: CalendarClock, exam: GraduationCap, study_reminder: Timer, message: MessageCircle,
  shared_note: FileText, shared_deck: Layers, achievement: Award, streak: Flame,
};

export function NotificationItem({ n, onOpen, onDelete }: { n: AppNotification; onOpen: () => void; onDelete?: () => void }) {
  const Icon = ICON[n.kind] ?? MessageCircle;
  return (
    <div className={cn('group flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-surface-2', !n.read_at && 'bg-primary-soft/60')}>
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-primary"><Icon className="size-4" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{n.title}</span>
          {n.body && <span className="block truncate text-sm text-ink-muted">{n.body}</span>}
          <span className="block text-xs text-ink-faint">{formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}</span>
        </span>
        {!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
      </button>
      {onDelete && (
        <button onClick={onDelete} aria-label="Delete notification" className="rounded-lg p-2 text-ink-faint hover:bg-surface hover:text-coral md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100">
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}

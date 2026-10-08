import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { formatDistanceToNowStrict } from 'date-fns';
import { Award, BookOpen, FileText, Layers, ListChecks, type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { WidgetCard } from '@/features/dashboard/widgets/WidgetCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSpaceFeed } from './api';
import { describeFeedItem, type FeedItem } from './feed';

const ICON: Record<string, LucideIcon> = { session: BookOpen, quiz: ListChecks, achievement: Award, shared_note: FileText, shared_deck: Layers };

export function ActivityFeed({ cheer }: { cheer?: (item: FeedItem) => ReactNode }) {
  const { user, partner } = useAuth();
  const feed = useSpaceFeed();
  const items = (feed.data ?? []) as FeedItem[];
  return (
    <WidgetCard title="Activity">
      {feed.isPending && <Skeleton className="h-40" />}
      {!feed.isPending && items.length === 0 && <p className="text-sm text-ink-muted">Nothing yet. Your sessions and shared notes will show up here.</p>}
      <ul className="stagger flex flex-col gap-2 [--stagger-step:30ms]">
        {items.map((it, i) => {
          const who = it.user_id === user?.id ? 'You' : partner?.display_name || 'Your partner';
          const { text, href } = describeFeedItem(it, who);
          const Icon = ICON[it.kind] ?? BookOpen;
          return (
            <li key={`${it.kind}-${it.ref_id ?? i}-${it.at}`} className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-primary"><Icon className="size-4" aria-hidden /></span>
              <span className="min-w-0 flex-1 text-sm">
                {href ? <Link to={href} className="hover:underline">{text}</Link> : text}
                <span className="block text-xs text-ink-faint">{formatDistanceToNowStrict(new Date(it.at), { addSuffix: true })}</span>
              </span>
              {it.user_id !== user?.id && cheer?.(it)}
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}

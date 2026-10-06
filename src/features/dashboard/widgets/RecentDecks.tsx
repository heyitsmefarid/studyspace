import { Link } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/Progress';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDecks, useDeckStats } from '@/features/flashcards/api';
import { WidgetCard } from './WidgetCard';

export function RecentDecks() {
  const decks = useDecks('mine');
  const stats = useDeckStats();
  const list = (decks.data ?? []).slice(0, 4);
  return (
    <WidgetCard title="Your decks" more={{ to: '/decks', label: 'All decks' }}>
      {decks.isPending ? <Skeleton className="h-32" /> : list.length === 0 ? (
        <p className="text-sm text-ink-muted">No decks yet. <Link to="/decks?new=1" className="text-primary hover:underline">Make one</Link></p>
      ) : (
        <ul className="flex flex-col gap-1">
          {list.map((d) => {
            const s = stats.data?.get(d.id);
            return (
              <li key={d.id}>
                <Link to={`/decks/${d.id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2">
                  <ProgressRing value={(s?.masteredPct ?? 0) / 100} size={36} stroke={3} color="var(--teal)" label={`${s?.masteredPct ?? 0}% mastered`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{d.title}</span>
                    <span className="block text-xs text-ink-faint">{d.card_count} card{d.card_count === 1 ? '' : 's'}</span>
                  </span>
                  {s && s.due > 0 && <Badge tone="gold">{s.due} due</Badge>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

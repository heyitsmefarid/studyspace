import { Link } from 'react-router';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/Skeleton';
import { useNotes } from '@/features/notes/api';
import { WidgetCard } from './WidgetCard';

export function RecentNotes() {
  const notes = useNotes({ scope: 'mine' });
  const list = [...(notes.data ?? [])].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 4);
  return (
    <WidgetCard title="Recent notes" more={{ to: '/notes', label: 'All notes' }}>
      {notes.isPending ? <Skeleton className="h-32" /> : list.length === 0 ? (
        <p className="text-sm text-ink-muted">No notes yet. <Link to="/notes?new=1" className="text-primary hover:underline">Write your first</Link></p>
      ) : (
        <ul className="flex flex-col gap-1">
          {list.map((n) => (
            <li key={n.id}>
              <Link to={`/notes/${n.id}`} className="block rounded-xl px-2 py-1.5 hover:bg-surface-2">
                <span className="block truncate text-sm font-medium">{n.title || 'Untitled'}</span>
                <span className="block truncate text-xs text-ink-faint">{formatDistanceToNowStrict(parseISO(n.updated_at), { addSuffix: true })}{n.excerpt ? ` · ${n.excerpt}` : ''}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

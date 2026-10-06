import { useState } from 'react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { subjectById, useSubjects } from '@/features/subjects/api';
import { SubjectDot } from '@/features/subjects/SubjectDot';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useNoteSearch, useNotes, useNotesByIds } from './api';

/** Searchable note list with checkboxes. `max = 1` behaves like a single choice. */
export function NotePicker({ selected, onChange, max = 5 }: { selected: string[]; onChange: (ids: string[]) => void; max?: number }) {
  const { user, partner } = useAuth();
  const [query, setQuery] = useState('');
  const term = useDebouncedValue(query.trim(), 250);
  const searching = term.length >= 2;
  const mine = useNotes({ scope: 'mine' });
  const shared = useNotes({ scope: 'shared' });
  const search = useNoteSearch(searching ? term : '');
  const chosen = useNotesByIds(selected);
  const subjects = useSubjects();

  const list = searching ? (search.data ?? []) : [...(mine.data ?? []).slice(0, 20), ...(shared.data ?? []).slice(0, 10)];
  const loading = searching ? search.isPending : mine.isPending;
  const full = selected.length >= max;

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (max === 1) onChange([id]);
    else if (!full) onChange([...selected, id]);
  };

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && max > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
              <span className="truncate">{chosen.data?.find((n) => n.id === id)?.title ?? 'Note'}</span>
              <button type="button" onClick={() => toggle(id)} aria-label="Remove note"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
        <Input aria-label="Search notes" placeholder="Search your notes…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>
      <p className="text-xs text-ink-faint">{max === 1 ? 'Pick one note.' : `Pick up to ${max} notes (${selected.length}/${max}).`}</p>
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-xl border border-line p-1" aria-label="Notes">
        {loading && [0, 1, 2].map((i) => <li key={i}><Skeleton className="h-11" /></li>)}
        {!loading && list.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-muted">{searching ? 'No notes match.' : 'No notes yet.'}</li>}
        {!loading && list.map((n) => {
          const on = selected.includes(n.id);
          const subject = subjectById(subjects.data, n.subject_id);
          const disabled = !on && full && max > 1;
          return (
            <li key={n.id}>
              <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2', on && 'bg-primary-soft/60', disabled && 'cursor-not-allowed opacity-50')}>
                <input type={max === 1 ? 'radio' : 'checkbox'} name="note-picker" checked={on} disabled={disabled} onChange={() => toggle(n.id)} className="size-4 accent-[var(--primary)]" />
                {subject && <SubjectDot color={subject.color} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{n.title || 'Untitled'}</span>
                  <span className="block text-xs text-ink-faint">
                    {n.owner_id !== user?.id ? `${partner?.display_name ?? 'Partner'}'s · ` : ''}
                    {formatDistanceToNowStrict(parseISO(n.updated_at), { addSuffix: true })}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

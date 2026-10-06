import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Plus, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMySubjects } from '@/features/subjects/api';
import { useCreateNote, useNoteSearch, useNotes } from './api';
import { useFolders } from './foldersApi';
import { NoteCard } from './NoteCard';
import { NotesSidebar, type NotesView } from './NotesSidebar';

function readView(p: URLSearchParams): NotesView {
  return {
    scope: p.get('scope') === 'shared' ? 'shared' : 'mine',
    subject: p.get('subject') ?? undefined,
    folder: p.get('folder') ?? undefined,
    pinned: p.get('pinned') === '1',
    fav: p.get('fav') === '1',
  };
}

function writeView(v: NotesView, q: string): URLSearchParams {
  const p = new URLSearchParams();
  if (v.scope === 'shared') p.set('scope', 'shared');
  if (v.subject) p.set('subject', v.subject);
  if (v.folder) p.set('folder', v.folder);
  if (v.pinned) p.set('pinned', '1');
  if (v.fav) p.set('fav', '1');
  if (q) p.set('q', q);
  return p;
}

const chip = (active: boolean) => cn('shrink-0 rounded-full border px-3 py-1.5 text-sm',
  active ? 'border-primary bg-primary-soft text-primary' : 'border-line text-ink-muted');

export default function NotesPage() {
  const { partner } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = readView(params);
  const [query, setQuery] = useState(params.get('q') ?? '');
  const debounced = useDebouncedValue(query, 300);
  const [foldersOpen, setFoldersOpen] = useState(false);
  const subjects = useMySubjects();
  const folders = useFolders();
  const create = useCreateNote();

  const notes = useNotes({ scope: view.scope, subjectId: view.subject, folderId: view.folder, pinned: view.pinned, favorite: view.fav });
  const all = useNotes({ scope: 'mine' });
  const search = useNoteSearch(debounced);
  const searching = debounced.trim().length >= 2;

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of all.data ?? []) if (n.subject_id) m.set(n.subject_id, (m.get(n.subject_id) ?? 0) + 1);
    return m;
  }, [all.data]);

  const setView = (v: NotesView) => setParams(writeView(v, debounced), { replace: true });
  useEffect(() => { setParams(writeView(readView(new URLSearchParams(window.location.search)), debounced), { replace: true }); }, [debounced, setParams]);

  const newNote = async () => {
    const n = await create.mutateAsync({ subject_id: view.subject ?? null, folder_id: view.folder ?? null });
    navigate(`/notes/${n.id}`);
  };
  const autoCreated = useRef(false);
  useEffect(() => {
    if (params.get('new') === '1' && !autoCreated.current) { autoCreated.current = true; void newNote(); }
  });

  const list = searching ? search.data : notes.data;
  const pending = searching ? search.isPending : notes.isPending;
  const total = all.data?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Notes"
        subtitle={`${total} ${total === 1 ? 'star' : 'stars'} in your notebook`}
        actions={<Button onClick={newNote} loading={create.isPending}><Plus className="size-4" /> New note</Button>}
      />
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
        <Input aria-label="Search notes" placeholder="Search notes…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        <button className={chip(view.scope === 'mine')} onClick={() => setView({ scope: 'mine' })}>Mine</button>
        <button className={chip(view.scope === 'shared')} onClick={() => setView({ scope: 'shared' })}>Shared</button>
        <button className={chip(Boolean(view.pinned))} onClick={() => setView({ ...view, pinned: !view.pinned })}>Pinned</button>
        <button className={chip(Boolean(view.fav))} onClick={() => setView({ ...view, fav: !view.fav })}>Favourites</button>
        {view.scope === 'mine' && (subjects.data ?? []).map((s) => (
          <button key={s.id} className={chip(view.subject === s.id)} onClick={() => setView({ ...view, subject: view.subject === s.id ? undefined : s.id })}>{s.name}</button>
        ))}
        {view.scope === 'mine' && (folders.data?.length ?? 0) > 0 && <button className={chip(Boolean(view.folder))} onClick={() => setFoldersOpen(true)}>Folders</button>}
      </div>
      <Sheet open={foldersOpen} onOpenChange={setFoldersOpen} title="Folders">
        <div className="flex flex-col gap-1">
          {(folders.data ?? []).map((f) => (
            <button key={f.id} className={chip(view.folder === f.id)} onClick={() => { setView({ ...view, folder: view.folder === f.id ? undefined : f.id }); setFoldersOpen(false); }}>{f.name}</button>
          ))}
        </div>
      </Sheet>

      <div className="flex gap-8">
        <NotesSidebar view={view} onChange={setView} counts={counts} />
        <section className="min-w-0 flex-1">
          {searching && <h2 className="mb-3 text-sm text-ink-muted">Results for “{debounced.trim()}”</h2>}
          {pending ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-36" />)}</div>
          ) : (list?.length ?? 0) === 0 ? (
            searching ? <EmptyState title="No notes match" body="Try fewer or different words." />
              : view.scope === 'shared'
                ? <EmptyState title="Nothing shared yet" body={`When ${partner?.display_name ?? 'your partner'} shares a note, it lands here.`} />
                : <EmptyState title="Every constellation starts with one star." body="Write your first note."
                    action={<Button onClick={newNote}><Plus className="size-4" /> Write your first note</Button>} />
          ) : (
            <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list!.map((n) => <NoteCard key={n.id} note={n} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

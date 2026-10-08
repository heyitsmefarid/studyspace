import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Plus, Search, Share2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryError } from '@/components/ui/QueryError';
import { ProgressRing } from '@/components/ui/Progress';
import { useAuth } from '@/features/auth/AuthProvider';
import { subjectById, useSubjects } from '@/features/subjects/api';
import { SubjectDot } from '@/features/subjects/SubjectDot';
import { useDeckStats, useDecks, type DeckStats, type DeckWithCount } from './api';
import { DeckConstellation } from './DeckConstellation';
import { DeckDialog } from './DeckDialog';
import type { CardState } from './srs';

const chip = (active: boolean) => cn('shrink-0 rounded-full border px-3 py-1 text-sm', active ? 'border-primary bg-primary-soft text-primary' : 'border-line text-ink-muted');

function DeckCard({ deck, stats }: { deck: DeckWithCount; stats?: DeckStats }) {
  const { user, partner } = useAuth();
  const subjects = useSubjects();
  const subject = subjectById(subjects.data, deck.subject_id);
  const states: CardState[] = stats?.states ?? Array.from({ length: deck.card_count }, () => 'new' as const);
  const ids = useMemo(() => states.map((_, i) => `${deck.id}:${i}`), [deck.id, states]);
  const due = stats?.due ?? 0;
  const fresh = stats?.fresh ?? deck.card_count;
  return (
    <Card interactive className="group flex flex-col gap-3 p-4">
      <Link to={`/decks/${deck.id}`} className="flex flex-col gap-3">
        <div className="rounded-xl bg-surface-2 px-2 py-1"><DeckConstellation cardIds={ids} states={states} size="sm" /></div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg">{deck.title}</h3>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
              {subject && <><SubjectDot color={subject.color} size={8} />{subject.name} ·</>}
              {deck.card_count} cards
              {deck.is_shared && deck.owner_id === user?.id && <Share2 className="size-3.5 text-teal" aria-label="Shared" />}
            </p>
          </div>
          <ProgressRing value={(stats?.masteredPct ?? 0) / 100} size={44} label={`${stats?.masteredPct ?? 0}% mastered`} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {due > 0 && <Badge tone="coral">{due} due</Badge>}
          {deck.owner_id !== user?.id && <Badge tone="primary">{partner?.display_name ?? 'Partner'}'s deck</Badge>}
          {deck.tags.slice(0, 3).map((t) => <Badge key={t}>#{t}</Badge>)}
        </div>
      </Link>
      {due + fresh > 0 ? (
        <Link to={`/decks/${deck.id}/study`} className="inline-flex h-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-ink">Study</Link>
      ) : (
        <p className="text-center text-xs text-ink-muted">Nothing due — study all from the deck page</p>
      )}
    </Card>
  );
}

export default function DecksPage() {
  const [params, setParams] = useSearchParams();
  const [scope, setScope] = useState<'mine' | 'shared'>('mine');
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const decks = useDecks(scope);
  const stats = useDeckStats();
  const subjects = useSubjects();
  const dialogOpen = params.get('new') === '1';
  const setDialogOpen = (o: boolean) => setParams(o ? { new: '1' } : {}, { replace: true });

  const all = decks.data ?? [];
  const tags = [...new Set(all.flatMap((d) => d.tags))].sort();
  const q = query.trim().toLowerCase();
  const list = all.filter((d) =>
    (!subject || d.subject_id === subject) && (!tag || d.tags.includes(tag)) &&
    (!q || d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || d.tags.some((t) => t.includes(q))));
  const totals = [...(stats.data?.values() ?? [])];
  const dueTotal = totals.reduce((t, s) => t + s.due, 0);
  const masteredAll = totals.reduce((t, s) => t + s.states.filter((x) => x === 'mastered').length, 0);
  const cardsAll = totals.reduce((t, s) => t + s.total, 0);
  const usedSubjects = (subjects.data ?? []).filter((s) => all.some((d) => d.subject_id === s.id));

  return (
    <div>
      <PageHeader
        title="Flashcards"
        subtitle={`${dueTotal} cards waiting · ${cardsAll ? Math.round((masteredAll / cardsAll) * 100) : 0}% of your sky lit`}
        actions={<Button onClick={() => setDialogOpen(true)}><Plus className="size-4" /> New deck</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs label="Whose decks" value={scope} onValueChange={setScope} items={[{ value: 'mine', label: 'Mine' }, { value: 'shared', label: 'Shared with me' }]} />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input aria-label="Search decks" placeholder="Search decks…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
      </div>
      {(usedSubjects.length > 0 || tags.length > 0) && (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {usedSubjects.map((s) => <button key={s.id} className={chip(subject === s.id)} onClick={() => setSubject(subject === s.id ? null : s.id)}>{s.name}</button>)}
          {tags.map((t) => <button key={t} className={chip(tag === t)} onClick={() => setTag(tag === t ? null : t)}>#{t}</button>)}
        </div>
      )}
      {decks.isError ? <QueryError error={decks.error} onRetry={decks.refetch} retrying={decks.isFetching} /> : decks.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-60" />)}</div>
      ) : list.length === 0 ? (
        scope === 'shared'
          ? <EmptyState title="No shared decks yet" body="When your partner shares a deck, you can study it here with your own progress." />
          : <EmptyState title="No decks yet — a deck is a constellation waiting to be drawn."
              action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={() => setDialogOpen(true)}>Create a deck</Button>
                <Link to="/notes" className="inline-flex h-11 items-center rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold">Generate from a note</Link></div>} />
      ) : (
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => <DeckCard key={d.id} deck={d} stats={stats.data?.get(d.id)} />)}
        </div>
      )}
      {dialogOpen && <DeckDialog open={dialogOpen} onOpenChange={setDialogOpen} />}
    </div>
  );
}

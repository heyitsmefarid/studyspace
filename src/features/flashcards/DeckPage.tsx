import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Copy, MoreHorizontal, Pencil, Plus, Search, Share2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
import { Menu } from '@/components/ui/Menu';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryError } from '@/components/ui/QueryError';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/features/auth/AuthProvider';
import { subjectById, useSubjects } from '@/features/subjects/api';
import { SubjectDot } from '@/features/subjects/SubjectDot';
import { useCopyDeck, useDeck, useDeleteCard, useDeleteDeck, useMoveCard, useMyProgress, useUpdateDeck, type Flashcard } from './api';
import { AskNovaButton } from '@/features/ai/AskNovaButton';
import { GenerateFromNoteButton } from './GenerateFlashcardsDialog';
import { DeckConstellation } from './DeckConstellation';
import { DeckDialog } from './DeckDialog';
import { CardEditor } from './CardEditor';
import { CardRow } from './CardRow';
import { deckMastery, stateFor, type CardState } from './srs';

export default function DeckPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, partner } = useAuth();
  const q = useDeck(id);
  const progress = useMyProgress(id);
  const subjects = useSubjects();
  const update = useUpdateDeck();
  const removeDeck = useDeleteDeck();
  const removeCard = useDeleteCard(id ?? '');
  const move = useMoveCard(id ?? '');
  const copy = useCopyDeck();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Flashcard | 'new' | null>(null);
  const [deckDialog, setDeckDialog] = useState(false);
  const [confirmDeck, setConfirmDeck] = useState(false);
  const [toDelete, setToDelete] = useState<Flashcard | null>(null);

  const cards = useMemo(() => q.data?.cards ?? [], [q.data]);
  const [now] = useState(() => Date.now());
  const states: CardState[] = useMemo(() => cards.map((c) => {
    const p = progress.data?.get(c.id);
    return p ? stateFor(p.interval_minutes, p.review_count) : 'new';
  }), [cards, progress.data]);
  const due = cards.filter((c) => { const p = progress.data?.get(c.id); return p && p.review_count > 0 && (!p.due_at || new Date(p.due_at).getTime() <= now); }).length;
  const fresh = states.filter((s) => s === 'new').length;
  const mastery = deckMastery(states);

  if (q.isPending) return <div className="flex flex-col gap-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-56" /><Skeleton className="h-40" /></div>;
  if (q.isError) return <QueryError error={q.error} onRetry={q.refetch} retrying={q.isFetching} />;
  if (!q.data) return <EmptyState title="This deck drifted away" body="It may have been deleted, or it isn't shared with you." action={<Link to="/decks" className="text-primary underline">Back to decks</Link>} />;

  const { deck } = q.data;
  const editable = deck.owner_id === user?.id;
  const subject = subjectById(subjects.data, deck.subject_id);
  const s = search.trim().toLowerCase();
  const visible = cards.map((c, i) => ({ c, i })).filter(({ c }) => !s || c.front.toLowerCase().includes(s) || c.back.toLowerCase().includes(s));

  return (
    <div>
      <Link to="/decks" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="size-4" /> Flashcards</Link>
      {!editable && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary">
          <span>{partner?.display_name ?? 'Your partner'}'s shared deck — your progress is yours</span>
          <Button size="sm" loading={copy.isPending} onClick={async () => { const d = await copy.mutateAsync({ deck, cards }); navigate(`/decks/${d.id}`); }}>
            <Copy className="size-4" /> Copy to mine
          </Button>
        </div>
      )}
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl">{deck.title}</h1>
          {deck.description && <p className="mt-1 text-ink-muted">{deck.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-faint">
            {subject && <span className="inline-flex items-center gap-1.5"><SubjectDot color={subject.color} size={8} />{subject.name}</span>}
            {deck.tags.map((t) => <Badge key={t}>#{t}</Badge>)}
          </div>
        </div>
        {editable && (
          <Menu
            trigger={<Button variant="ghost" size="icon" aria-label="Deck actions"><MoreHorizontal className="size-5" /></Button>}
            items={[
              { label: 'Edit deck', icon: Pencil, onSelect: () => setDeckDialog(true) },
              { label: deck.is_shared ? 'Stop sharing' : `Share with ${partner?.display_name ?? 'partner'}`, icon: Share2, onSelect: () => update.mutate({ id: deck.id, patch: { is_shared: !deck.is_shared } }) },
              { label: 'Delete deck', icon: Trash2, danger: true, onSelect: () => setConfirmDeck(true) },
            ]}
          />
        )}
      </header>

      <Card className="mb-4">
        <div className="mb-3 grid grid-cols-4 gap-2 text-center">
          {[['Cards', cards.length], ['Due', due], ['New', fresh], ['Mastered', `${mastery.masteredPct}%`]].map(([label, v]) => (
            <div key={label as string}><p className="font-display text-2xl tabular">{v}</p><p className="text-xs text-ink-muted">{label}</p></div>
          ))}
        </div>
        <DeckConstellation cardIds={cards.map((c) => c.id)} states={states} size="lg" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to={`/decks/${deck.id}/study`} className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink">Study now{due + fresh > 0 ? ` (${due + Math.min(fresh, 20)})` : ''}</Link>
          <Link to={`/decks/${deck.id}/study?all=1`} className="inline-flex h-11 items-center rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold">Study all</Link>
          {cards.length >= 4
            ? <Link to={`/quiz/take?mode=deck&deck=${deck.id}`} className="inline-flex h-11 items-center rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold">Quiz me</Link>
            : <span className="inline-flex h-11 items-center px-2 text-xs text-ink-faint">Add 4+ cards to quiz yourself</span>}
          {cards.length > 0 && <AskNovaButton context={{ type: 'deck', id: deck.id }} label="Ask Nova" />}
        </div>
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input aria-label="Search cards" placeholder="Search cards…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {editable && <Button onClick={() => setEditing('new')}><Plus className="size-4" /> Add card</Button>}
        {editable && <GenerateFromNoteButton deckId={deck.id} />}
      </div>
      {cards.length === 0 ? (
        <EmptyState title="This constellation has no stars yet." action={editable ? <Button onClick={() => setEditing('new')}>Add a card</Button> : undefined} />
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map(({ c, i }) => (
            <CardRow key={c.id} card={c} state={states[i] ?? 'new'} editable={editable} first={i === 0} last={i === cards.length - 1}
              onEdit={() => setEditing(c)} onDelete={() => setToDelete(c)} onMove={(dir) => move.mutate({ cards, index: i, direction: dir })} />
          ))}
        </ul>
      )}

      {editing && <CardEditor deckId={deck.id} card={editing === 'new' ? undefined : editing} open onOpenChange={(o) => !o && setEditing(null)} nextPosition={cards.length} />}
      {deckDialog && <DeckDialog deck={deck} open onOpenChange={setDeckDialog} />}
      <ConfirmDialog open={confirmDeck} onOpenChange={setConfirmDeck} danger title="Delete this deck?" confirmLabel="Delete"
        body="All its cards and your review history for them will be removed." onConfirm={async () => { await removeDeck.mutateAsync(deck.id); navigate('/decks'); }} />
      <ConfirmDialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)} danger title="Delete this card?" confirmLabel="Delete"
        body={toDelete?.front ?? ''} onConfirm={() => removeCard.mutateAsync(toDelete!.id)} />
    </div>
  );
}

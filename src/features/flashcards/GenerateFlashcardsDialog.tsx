import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { generateFlashcards } from '@/services/ai/aiService';
import { MAX_SOURCE_CHARS, type GeneratedCard } from '@/services/ai/schemas';
import { useAiTask } from '@/features/ai/useAiTask';
import { AiStatus } from '@/features/ai/AiStatus';
import { ProviderBadge } from '@/features/ai/ProviderBadge';
import { useAuth } from '@/features/auth/AuthProvider';
import { NotePicker } from '@/features/notes/NotePicker';
import { useNotesByIds } from '@/features/notes/api';
import { subjectById, useSubjects } from '@/features/subjects/api';
import { truncateAtBoundary } from '@/lib/text';
import { useBulkInsertCards, useCreateDeck, useDeck, useDecks } from './api';
import { validateCard, type CardForm } from './cardForm';
import { CardDraftGrid, type CardDraft } from './CardDraftGrid';

export interface FlashcardSource { text: string; title: string; subject?: string; noteId?: string; subjectId?: string | null }

const toDrafts = (cards: GeneratedCard[]): CardDraft[] =>
  cards.map((c) => ({ key: crypto.randomUUID(), question: c.question, answer: c.answer, topic: c.topic === 'General' ? '' : c.topic, difficulty: c.difficulty, keep: true }));

function Body({ onOpenChange, source, targetDeckId, initialCards }: {
  onOpenChange: (o: boolean) => void; source: FlashcardSource; targetDeckId?: string; initialCards?: GeneratedCard[];
}) {
  const navigate = useNavigate();
  const decks = useDecks('mine');
  const createDeck = useCreateDeck();
  const bulk = useBulkInsertCards();
  const [count, setCount] = useState(12);
  const [dest, setDest] = useState<string>(targetDeckId ?? 'new');
  const [newTitle, setNewTitle] = useState(`${source.title || 'Untitled'} — cards`.slice(0, 200));
  const [drafts, setDrafts] = useState<CardDraft[] | null>(() => (initialCards ? toDrafts(initialCards) : null));
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [confirmRegen, setConfirmRegen] = useState(false);
  const deck = useDeck(dest === 'new' ? undefined : dest);
  const existing = (deck.data?.cards ?? []).map((c) => c.front.slice(0, 300)).slice(0, 300);

  const gen = useAiTask(generateFlashcards, { onSuccess: (r) => { setDrafts(toDrafts(r.cards)); setErrors({}); } });
  const generate = () => { setDrafts(null); void gen.run({ text: source.text, title: source.title, subject: source.subject, count, existing }); };

  const kept = drafts?.filter((d) => d.keep) ?? [];
  const saving = createDeck.isPending || bulk.isPending;
  const destTitle = dest === 'new' ? newTitle.trim() || 'Nova cards' : decks.data?.find((d) => d.id === dest)?.title ?? deck.data?.deck.title ?? 'your deck';

  async function save() {
    const values: CardForm[] = [];
    const errs: Record<string, Record<string, string>> = {};
    for (const d of kept) {
      const r = validateCard({ type: 'qa', front: d.question, back: d.answer, topic: d.topic || undefined, difficulty: d.difficulty });
      if (r.ok) values.push(r.value); else errs[d.key] = r.errors;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error('Fix the highlighted cards first.'); return; }
    let deckId = dest;
    if (dest === 'new') {
      const created = await createDeck.mutateAsync({ title: destTitle.slice(0, 200), subject_id: source.subjectId ?? null, source_note_id: source.noteId ?? null });
      deckId = created.id;
      setDest(created.id); // a retry after a failed insert reuses this deck
    }
    await bulk.mutateAsync({ deckId, cards: values, startPosition: deck.data?.cards.length ?? 0 });
    toast.success(`Saved ${values.length} card${values.length === 1 ? '' : 's'} to ${destTitle}`, {
      action: { label: 'Study now', onClick: () => navigate(`/decks/${deckId}/study`) },
    });
    onOpenChange(false);
  }

  const options = (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">From <strong className="text-ink">{source.title || 'Untitled'}</strong>. Nova writes cards that test understanding, not copy-paste.</p>
      <Field label={`How many cards? (${count})`}>
        {(id) => <input id={id} type="range" min={5} max={30} step={1} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-[var(--primary)]" />}
      </Field>
      <Field label="Save to">
        {(id) => (
          <Select id={id} value={dest} onChange={(e) => setDest(e.target.value)}>
            <option value="new">A new deck</option>
            {(decks.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.title} ({d.card_count})</option>)}
          </Select>
        )}
      </Field>
      {dest === 'new' && <Field label="New deck title">{(id) => <Input id={id} maxLength={200} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />}</Field>}
      {dest !== 'new' && existing.length > 0 && <p className="text-xs text-ink-faint">Nova will skip questions this deck already has.</p>}
    </div>
  );

  const stage = drafts ? 'review' : gen.status === 'idle' ? 'options' : 'generating';
  const footer = stage === 'options' ? (
    <><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
      <Button onClick={generate}><Sparkles className="size-4" /> Generate</Button></>
  ) : stage === 'review' ? (
    <><Button variant="secondary" onClick={() => setConfirmRegen(true)}><RefreshCw className="size-4" /> Regenerate</Button>
      <Button onClick={save} loading={saving} disabled={kept.length === 0}>Save {kept.length} card{kept.length === 1 ? '' : 's'}</Button></>
  ) : gen.status !== 'loading' ? <Button variant="secondary" onClick={gen.reset}>Back to options</Button> : undefined;

  return (
    <>
      <Dialog open onOpenChange={onOpenChange} size="xl" title="Generate flashcards with Nova" footer={footer}>
        {stage === 'options' && options}
        {stage === 'generating' && <AiStatus task={gen} loadingLabel="Nova is drawing your cards…" emptyTitle="No new cards this time" />}
        {stage === 'review' && drafts && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{drafts.length} cards · review before saving</p>
              <ProviderBadge meta={gen.meta} />
            </div>
            {!initialCards && dest === 'new' && <Field label="New deck title">{(id) => <Input id={id} maxLength={200} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />}</Field>}
            {initialCards && (
              <Field label="Save to">
                {(id) => (
                  <Select id={id} value={dest} onChange={(e) => setDest(e.target.value)}>
                    <option value="new">A new deck — {newTitle}</option>
                    {(decks.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.title} ({d.card_count})</option>)}
                  </Select>
                )}
              </Field>
            )}
            <CardDraftGrid drafts={drafts} errors={errors} onChange={setDrafts} />
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={confirmRegen}
        onOpenChange={setConfirmRegen}
        title="Regenerate these cards?"
        body={initialCards ? 'Nova will write a fresh set from the note; your edits here will be lost.' : 'Your edits to this set will be lost.'}
        confirmLabel="Regenerate"
        onConfirm={() => { setConfirmRegen(false); generate(); }}
      />
    </>
  );
}

/** Generate → review → save flashcards. Mounts fresh each time it opens. */
export function GenerateFlashcardsDialog({ open, onOpenChange, source, targetDeckId, initialCards }: {
  open: boolean; onOpenChange: (o: boolean) => void; source: FlashcardSource | null; targetDeckId?: string; initialCards?: GeneratedCard[];
}) {
  if (!open || !source) return null;
  return <Body onOpenChange={onOpenChange} source={source} targetDeckId={targetDeckId} initialCards={initialCards} />;
}

/** Deck page entry point: pick one note, then run the generate → review → save flow into this deck. */
export function GenerateFromNoteButton({ deckId }: { deckId: string }) {
  const { user } = useAuth();
  const subjects = useSubjects();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [source, setSource] = useState<FlashcardSource | null>(null);
  const note = useNotesByIds(picked);

  const next = () => {
    const n = note.data?.[0];
    if (!n) return;
    if (!n.content_text.trim()) { toast.info('That note is empty — pick another one.'); return; }
    const mine = n.owner_id === user?.id;
    setSource({
      text: truncateAtBoundary(n.content_text.trim(), MAX_SOURCE_CHARS).text, title: n.title, noteId: n.id,
      subject: subjectById(subjects.data, n.subject_id)?.name, subjectId: mine ? n.subject_id : null,
    });
    setPicking(false);
  };

  return (
    <>
      <Button variant="gold" onClick={() => { setPicked([]); setPicking(true); }}><Sparkles className="size-4" /> Generate with Nova</Button>
      <Dialog open={picking} onOpenChange={setPicking} title="Generate cards from a note"
        footer={<><Button variant="secondary" onClick={() => setPicking(false)}>Cancel</Button>
          <Button onClick={next} disabled={!note.data?.length} loading={picked.length > 0 && note.isPending}>Continue</Button></>}>
        <NotePicker selected={picked} onChange={setPicked} max={1} />
      </Dialog>
      <GenerateFlashcardsDialog open={source !== null} onOpenChange={(o) => { if (!o) setSource(null); }} source={source} targetDeckId={deckId} />
    </>
  );
}

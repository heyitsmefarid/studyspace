import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Tables } from '@/lib/supabase';
import { assertOk, unwrap } from '@/lib/errors';
import { fetchAll } from '@/lib/fetchAll';
import { useAuth } from '@/features/auth/AuthProvider';
import type { CardForm } from './cardForm';
import { deckMastery, progressToRow, stateFor, type CardState, type Grade, type Progress } from './srs';

export type Deck = Tables<'decks'>;
export type Flashcard = Tables<'flashcards'>;
export type DeckWithCount = Deck & { card_count: number };
export interface DeckStats { total: number; due: number; fresh: number; states: CardState[]; masteredPct: number }

export const deckKeys = {
  all: ['decks'] as const,
  list: (scope: string) => ['decks', 'list', scope] as const,
  stats: ['decks', 'stats'] as const,
  detail: (id: string) => ['decks', 'detail', id] as const,
  progress: (id: string) => ['decks', 'progress', id] as const,
};

export function useDecks(scope: 'mine' | 'shared') {
  const { user } = useAuth();
  return useQuery({
    queryKey: deckKeys.list(scope),
    enabled: Boolean(user),
    queryFn: async () => {
      let q = supabase.from('decks').select('*, flashcards(count)').order('updated_at', { ascending: false });
      q = scope === 'mine' ? q.eq('owner_id', user!.id) : q.neq('owner_id', user!.id);
      return unwrap(await q).map(({ flashcards, ...d }) => ({ ...d, card_count: (flashcards as unknown as { count: number }[])[0]?.count ?? 0 })) as DeckWithCount[];
    },
  });
}

export function useDeckStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: deckKeys.stats,
    enabled: Boolean(user),
    queryFn: async () => {
      const cards = await fetchAll((from, to) => supabase.from('flashcards').select('id, deck_id').order('id').range(from, to));
      const progress = await fetchAll((from, to) => supabase.from('flashcard_progress')
        .select('card_id, state, due_at, interval_minutes, review_count').order('card_id').range(from, to));
      const byCard = new Map(progress.map((p) => [p.card_id, p]));
      const now = Date.now();
      const stats = new Map<string, DeckStats>();
      for (const c of cards) {
        const s = stats.get(c.deck_id) ?? { total: 0, due: 0, fresh: 0, states: [], masteredPct: 0 };
        const p = byCard.get(c.id);
        s.total++;
        if (!p || p.review_count === 0) { s.fresh++; s.states.push('new'); }
        else {
          s.states.push(stateFor(p.interval_minutes, p.review_count));
          if (!p.due_at || new Date(p.due_at).getTime() <= now) s.due++;
        }
        stats.set(c.deck_id, s);
      }
      for (const s of stats.values()) s.masteredPct = deckMastery(s.states).masteredPct;
      return stats;
    },
  });
}

export function useDeck(id: string | undefined) {
  return useQuery({
    queryKey: deckKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const deck = unwrap(await supabase.from('decks').select('*').eq('id', id!).single());
      const cards = unwrap(await supabase.from('flashcards').select('*').eq('deck_id', id!).order('position').order('created_at'));
      return { deck, cards };
    },
  });
}

export function useMyProgress(deckId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: deckKeys.progress(deckId ?? ''),
    enabled: Boolean(deckId && user),
    queryFn: async () => {
      const rows = unwrap(await supabase.from('flashcard_progress').select('*, flashcards!inner(deck_id)').eq('flashcards.deck_id', deckId!));
      return new Map(rows.map(({ flashcards: _f, ...r }) => [r.card_id, r as Tables<'flashcard_progress'>]));
    },
  });
}

const cardRow = (deckId: string, ownerId: string, c: CardForm, position: number) => ({
  deck_id: deckId, owner_id: ownerId, type: c.type, front: c.front, back: c.back,
  options: c.type === 'qa' ? null : c.options ?? null,
  correct_answer: c.type === 'qa' ? null : c.correct_answer ?? null,
  topic: c.topic || null, difficulty: c.difficulty ?? null,
  front_image_path: c.front_image_path ?? null, back_image_path: c.back_image_path ?? null, position,
});

export function useCreateDeck() {
  const qc = useQueryClient();
  const { user, preferences } = useAuth();
  return useMutation({
    mutationFn: async (input: { title: string; description?: string; subject_id?: string | null; tags?: string[]; is_shared?: boolean; source_note_id?: string | null }) =>
      unwrap(await supabase.from('decks').insert({ owner_id: user!.id, is_shared: preferences.privacy.shareByDefault, ...input }).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: deckKeys.all }),
  });
}

export function useUpdateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Deck, 'title' | 'description' | 'subject_id' | 'tags' | 'is_shared'>> }) =>
      assertOk(await supabase.from('decks').update(patch).eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: deckKeys.all }),
  });
}

export function useDeleteDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => assertOk(await supabase.from('decks').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: deckKeys.all }),
  });
}

export function useBulkInsertCards() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ deckId, cards, startPosition = 0 }: { deckId: string; cards: CardForm[]; startPosition?: number }) =>
      assertOk(await supabase.from('flashcards').insert(cards.map((c, i) => cardRow(deckId, user!.id, c, startPosition + i)))),
    onSuccess: () => qc.invalidateQueries({ queryKey: deckKeys.all }),
  });
}

export function useCopyDeck() {
  const qc = useQueryClient();
  const create = useCreateDeck();
  const bulk = useBulkInsertCards();
  return useMutation({
    mutationFn: async ({ deck, cards }: { deck: Deck; cards: Flashcard[] }) => {
      const copy = await create.mutateAsync({ title: `${deck.title} (copy)`.slice(0, 200), description: deck.description, tags: deck.tags });
      await bulk.mutateAsync({ deckId: copy.id, cards: cards.map((c) => ({
        type: c.type as CardForm['type'], front: c.front, back: c.back, options: (c.options as string[] | null) ?? undefined,
        correct_answer: c.correct_answer ?? undefined, topic: c.topic ?? undefined, difficulty: (c.difficulty as CardForm['difficulty']) ?? undefined,
        front_image_path: null, back_image_path: null,
      })) });
      return copy;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: deckKeys.all }),
  });
}

export function useSaveCard(deckId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, card, position }: { id?: string; card: CardForm; position: number }) => {
      const row = cardRow(deckId, user!.id, card, position);
      if (id) assertOk(await supabase.from('flashcards').update(row).eq('id', id));
      else assertOk(await supabase.from('flashcards').insert(row));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: deckKeys.all }),
  });
}

export function useDeleteCard(deckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => assertOk(await supabase.from('flashcards').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: deckKeys.detail(deckId) }),
  });
}

export function useMoveCard(deckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cards, index, direction }: { cards: Flashcard[]; index: number; direction: -1 | 1 }) => {
      const other = cards[index + direction];
      const me = cards[index];
      if (!other || !me) return;
      assertOk(await supabase.from('flashcards').update({ position: index + direction }).eq('id', me.id));
      assertOk(await supabase.from('flashcards').update({ position: index }).eq('id', other.id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: deckKeys.detail(deckId) }),
  });
}

export async function recordReview(a: { userId: string; card: Flashcard; next: Progress; grade: Grade; wasCorrect: boolean | null; sessionKey: string }) {
  assertOk(await supabase.from('flashcard_progress').upsert(progressToRow(a.userId, a.card.id, a.next)));
  assertOk(await supabase.from('review_events').insert({
    user_id: a.userId, card_id: a.card.id, deck_id: a.card.deck_id, grade: a.grade, was_correct: a.wasCorrect, session_key: a.sessionKey,
  }));
}

export async function completeFlashcardSession(sessionKey: string): Promise<number> {
  return unwrap(await supabase.rpc('complete_flashcard_session', { p_session_key: sessionKey })) ?? 0;
}

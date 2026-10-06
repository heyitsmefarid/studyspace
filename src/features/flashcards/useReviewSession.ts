import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthProvider';
import { friendlyMessage } from '@/lib/errors';
import { deckKeys, recordReview, useDeck, useMyProgress, type Flashcard } from './api';
import { createReviewWriter } from './reviewWriter';
import { buildQueue, previewIntervals, progressFromRow, requeueOffset, schedule, type Grade, type Progress } from './srs';

export function useReviewSession({ deckId, all = false, shuffle = false }: { deckId: string; all?: boolean; shuffle?: boolean }) {
  const { user, preferences } = useAuth();
  const qc = useQueryClient();
  const deck = useDeck(deckId);
  const progressQ = useMyProgress(deckId);
  const [sessionKey] = useState(() => crypto.randomUUID());
  const [startedAt] = useState(() => new Date());
  // the queue is derived once from the loaded data; after the first grade it lives in state
  const [edited, setEdited] = useState<string[] | null>(null);
  const [local, setLocal] = useState(new Map<string, Progress>());
  const [stats, setStats] = useState({ done: 0, correct: 0, reviewed: 0, masteredNow: 0 });
  const [finished, setFinished] = useState(false);
  const [writer] = useState(() => createReviewWriter((err) => toast.error(`Couldn't save that review: ${friendlyMessage(err)}`)));

  const derived = useMemo(() => {
    if (!deck.data || !progressQ.data) return null;
    const cards = deck.data.cards.map((c) => ({ id: c.id, position: c.position, progress: progressQ.data.has(c.id) ? progressFromRow(progressQ.data.get(c.id)) : null }));
    return buildQueue(cards, startedAt, { newLimit: preferences.study.newCardsPerDay, all, shuffle });
  }, [deck.data, progressQ.data, startedAt, all, shuffle, preferences.study.newCardsPerDay]);
  const queue = edited ?? derived; // progress isn't refetched mid-session, so the derived queue is stable until the first grade

  const byId = useMemo(() => new Map((deck.data?.cards ?? []).map((c) => [c.id, c])), [deck.data]);
  const currentId = queue?.[0];
  const card: Flashcard | null = currentId ? byId.get(currentId) ?? null : null;
  const progress = currentId ? local.get(currentId) ?? progressFromRow(progressQ.data?.get(currentId)) : progressFromRow(undefined);

  function grade(g: Grade, wasCorrect: boolean | null) {
    if (!card || !queue) return;
    const next = schedule(progress, g, new Date());
    setLocal((m) => new Map(m).set(card.id, next));
    setStats((s) => ({
      done: s.done + (g === 0 ? 0 : 1),
      reviewed: s.reviewed + 1,
      correct: s.correct + (g >= 1 ? 1 : 0),
      masteredNow: s.masteredNow + (next.state === 'mastered' && progress.state !== 'mastered' ? 1 : 0),
    }));
    const rest = queue.slice(1);
    if (g === 0) rest.splice(requeueOffset(rest.length), 0, card.id);
    setEdited(rest);
    writer.enqueue(card.id, () => recordReview({ userId: user!.id, card, next, grade: g, wasCorrect, sessionKey }));
  }

  function finish() {
    setFinished(true);
    void qc.invalidateQueries({ queryKey: deckKeys.all });
  }

  const status = deck.isPending || progressQ.isPending || !queue ? 'loading'
    : finished || (stats.reviewed > 0 && queue.length === 0) ? 'done'
    : queue.length === 0 ? 'empty' : 'active';

  return {
    status, card, progress, previews: previewIntervals(progress, startedAt),
    done: stats.done, remaining: queue?.length ?? 0, correct: stats.correct, reviewed: stats.reviewed,
    masteredNow: stats.masteredNow, grade, finish, sessionKey, deck: deck.data?.deck,
    /** Resolves once every review of this session has been written (the session XP counts them). */
    whenSaved: writer.flush,
  } as const;
}

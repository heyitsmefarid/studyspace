import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { prefersReducedMotion } from '@/lib/motion';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/Progress';
import { ConstellationLoader } from '@/components/sky/ConstellationLoader';
import { completeFlashcardSession } from './api';
import { FlipCard } from './FlipCard';
import { ReviewSummary, type ReviewSummaryData } from './ReviewSummary';
import { useReviewSession } from './useReviewSession';
import { createExitGate, runExit } from './exitGate';
import type { Grade } from './srs';

const GRADES: { g: Grade; label: string; cls: string }[] = [
  { g: 0, label: 'Again', cls: 'bg-coral-soft text-coral' },
  { g: 1, label: 'Hard', cls: 'bg-surface-2 text-ink' },
  { g: 2, label: 'Good', cls: 'bg-primary text-primary-ink' },
  { g: 3, label: 'Easy', cls: 'bg-gold-soft text-gold' },
];
const GRADE_TINT: Record<Grade, string> = { 0: 'card-tint-coral', 1: 'card-tint-gold', 2: 'card-tint-primary', 3: 'card-tint-teal' };
const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

export function ReviewSession({ deckId, all = false, shuffle = false, embedded = false, onReview, onFinish }: {
  deckId: string; all?: boolean; shuffle?: boolean; embedded?: boolean;
  onReview?: (wasCorrect: boolean) => void; onFinish?: (summary: ReviewSummaryData) => void;
}) {
  const s = useReviewSession({ deckId, all, shuffle });
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReviewSummaryData | null>(null);
  const finishing = useRef(false);
  const [gate] = useState(() => createExitGate(prefersReducedMotion() ? 0 : 220));
  const [leaving, setLeaving] = useState<Grade | null>(null);
  const card = s.card;
  const whenSaved = s.whenSaved;
  const isChoice = card?.type === 'mcq' || card?.type === 'tf';
  const options = card?.type === 'tf' ? ['True', 'False'] : Array.isArray(card?.options) ? (card!.options as string[]) : [];
  const wasCorrect = isChoice && chosen !== null ? same(chosen, card?.correct_answer) : null;
  const answered = isChoice ? chosen !== null : revealed;

  function grade(g: Grade) {
    if (!card) return;
    onReview?.(g >= 1);
    s.grade(g, wasCorrect);
    setRevealed(false);
    setChosen(null);
  }

  /** Grades after the card's exit animation; extra presses during the exit are ignored. */
  function gradeOut(g: Grade) {
    runExit(gate, g, setLeaving, grade);
  }

  function choose(o: string) {
    if (chosen !== null) return;
    setChosen(o);
    setRevealed(true);
  }

  useEffect(() => {
    if (s.status !== 'done' || finishing.current) return;
    finishing.current = true;
    (async () => {
      await whenSaved();
      const xp = s.reviewed >= 5 ? await completeFlashcardSession(s.sessionKey).catch(() => 0) : 0;
      void qc.invalidateQueries({ queryKey: ['profiles'] });
      const data: ReviewSummaryData = { reviewed: s.reviewed, correct: s.correct, accuracy: s.reviewed ? s.correct / s.reviewed : 0, masteredNow: s.masteredNow, xp, sessionKey: s.sessionKey };
      if (onFinish) onFinish(data); else setSummary(data);
    })();
  }, [s.status, s.reviewed, s.correct, s.masteredNow, s.sessionKey, whenSaved, qc, onFinish]);

  // a grade pressed during the exit animation still counts if the session unmounts first
  useEffect(() => () => gate.flush(), [gate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable || !card) return;
      if (!answered && card.type === 'qa' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setRevealed(true); return; }
      if (!answered && isChoice) {
        if (card.type === 'tf' && /^[tf]$/i.test(e.key)) { choose(e.key.toLowerCase() === 't' ? 'True' : 'False'); return; }
        const n = Number(e.key);
        if (n >= 1 && n <= options.length) { choose(options[n - 1]!); return; }
      }
      if (answered) {
        if (['1', '2', '3', '4'].includes(e.key)) { gradeOut((Number(e.key) - 1) as Grade); return; }
        if (e.key === 'Enter' && isChoice) gradeOut(wasCorrect ? 2 : 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (summary) return <ReviewSummary data={summary} deckId={deckId} />;
  if (s.status === 'loading') return <div className="grid min-h-64 place-items-center"><ConstellationLoader label="Gathering your cards…" /></div>;
  if (s.status === 'empty') {
    return (
      <EmptyState title="All caught up ✦ — nothing is due."
        action={<div className="flex flex-wrap justify-center gap-2">
          <Link to={`/decks/${deckId}/study?all=1`} className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink">Study all anyway</Link>
          {!embedded && <Link to={`/decks/${deckId}`} className="inline-flex h-11 items-center rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold">Back to deck</Link>}
        </div>} />
    );
  }
  if (s.status === 'done' || !card) return <div className="grid min-h-64 place-items-center"><ConstellationLoader label="Counting your stars…" /></div>;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {!embedded && <p className="truncate text-sm text-ink-muted">{s.deck?.title}</p>}
          <ProgressBar value={s.done / Math.max(1, s.done + s.remaining)} label="Session progress" className="mt-1" />
        </div>
        <span className="shrink-0 text-sm text-ink-muted tabular">{s.remaining} left</span>
        <Button variant="secondary" size="sm" onClick={() => { gate.flush(); s.finish(); }}>Finish</Button>
      </div>

      <div key={card.id} className={cn(leaving === null ? 'animate-[card-in_320ms_var(--ease-soft)_both]' : 'animate-[card-out_220ms_var(--ease-soft)_both]', leaving !== null && GRADE_TINT[leaving])}>
        <FlipCard card={card} revealed={revealed} onReveal={() => setRevealed(true)} />
      </div>

      {isChoice && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {options.map((o, i) => {
            const isRight = same(o, card.correct_answer);
            return (
              <button key={o} onClick={() => choose(o)} disabled={chosen !== null}
                className={cn('min-h-12 rounded-xl border px-4 py-3 text-left text-sm transition',
                  chosen === null && 'border-line bg-surface hover:border-primary',
                  chosen !== null && isRight && 'animate-pop-in border-teal bg-teal-soft text-teal',
                  chosen !== null && chosen === o && !isRight && 'animate-shake border-coral bg-coral-soft text-coral',
                  chosen !== null && chosen !== o && !isRight && 'border-line opacity-60')}>
                <span className="mr-2 text-ink-faint tabular">{card.type === 'tf' ? o[0] : i + 1}</span>{o}
              </button>
            );
          })}
        </div>
      )}

      {answered && (
        <div className="mt-5 grid grid-cols-4 gap-2" role="group" aria-label="How well did you know it?">
          {GRADES.map(({ g, label, cls }) => (
            <button key={g} onClick={() => gradeOut(g)}
              className={cn('flex min-h-14 flex-col items-center justify-center rounded-xl text-sm font-semibold', cls,
                isChoice && g === (wasCorrect ? 2 : 0) && 'ring-2 ring-primary')}>
              {label}<span className="text-xs font-normal opacity-80 tabular">{g + 1} · {s.previews[g]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

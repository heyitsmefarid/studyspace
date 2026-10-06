import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Pause, Play, SkipForward, Square, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatClock, formatDuration } from '@/lib/dates';
import { friendlyMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { OrbitTimer } from '@/components/sky/OrbitTimer';
import { useAuth } from '@/features/auth/AuthProvider';
import { subjectById, useSubjects } from '@/features/subjects/api';
import { SubjectDot } from '@/features/subjects/SubjectDot';
import { ReviewSession } from '@/features/flashcards/ReviewSession';
import { QuizRunner } from '@/features/quizzes/QuizRunner';
import { useQuizSource } from '@/features/quizzes/useQuizSource';
import { saveAttempt } from '@/features/quizzes/api';
import type { AnswerRecord } from '@/features/quizzes/scoring';
import { useNote } from '@/features/notes/api';
import { NoteEditor } from '@/features/notes/editor/Editor';
import { phaseProgress, remainingMs, totalFocusMs, type Phase } from './timer';
import type { ActiveStudy } from './useStudySession';
import { chimeEnabled, playChime } from './chime';

const TIPS = [
  'One tab, one task. Everything else can wait for the break.',
  'Stuck? Explain it out loud as if teaching your partner.',
  'Write down stray thoughts and come back to them later.',
  'Small, steady sessions beat one heroic cram.',
  'Close your eyes and recall the last thing you learned.',
];
const PHASE_LABEL: Record<Phase, string> = { focus: 'Focus', short_break: 'Short break', long_break: 'Long break' };
const noop = () => {};

function QuizContent({ quizId, onAnswered }: { quizId: string; onAnswered: (answers: AnswerRecord[]) => void }) {
  const params = useMemo(() => new URLSearchParams('mode=practice'), []);
  const q = useQuizSource(params, quizId);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  if (result) return <p className="py-6 text-center">Quiz saved — <strong>{result.score}/{result.total}</strong>. Keep focusing ✦</p>;
  if (q.status === 'loading') return <Skeleton className="h-60" />;
  if (q.status === 'error' || !q.source) return <p className="text-sm text-coral">{q.error ?? "Couldn't load that quiz."}</p>;
  const source = q.source;
  return (
    <QuizRunner
      embedded
      source={source}
      onSubmit={(answers, durationSeconds, startedAt) => {
        onAnswered(answers);
        setResult({ score: answers.filter((a) => a.correct).length, total: answers.length });
        saveAttempt({ quizId: source.quizId, subjectId: source.subjectId, title: source.title, mode: 'practice', startedAt, durationSeconds, answers })
          .catch((e: unknown) => toast.error(friendlyMessage(e)));
      }}
    />
  );
}

function NoteContent({ noteId }: { noteId: string }) {
  const { user } = useAuth();
  const note = useNote(noteId);
  if (note.isPending) return <Skeleton className="h-60" />;
  if (!note.data) return <p className="text-sm text-coral">That note is gone.</p>;
  return (
    <div>
      <h2 className="mb-2 font-display text-xl">{note.data.title}</h2>
      <NoteEditor note={note.data} uid={user!.id} editable={false} onChange={noop} />
    </div>
  );
}

export function SessionRunner({ active, now, dispatch, count, onFinish }: {
  active: ActiveStudy; now: number; dispatch: (a: { type: 'pause' | 'resume' | 'skip'; now: number }) => void;
  count: (kind: 'card' | 'question', correct: boolean) => void; onFinish: () => void;
}) {
  const subjects = useSubjects();
  const { timer } = active;
  const [exitOpen, setExitOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [deckDone, setDeckDone] = useState(false);
  const [small] = useState(() => !window.matchMedia('(min-width: 640px)').matches);
  const subject = subjectById(subjects.data, active.subjectId);
  const isBreak = timer.phase !== 'focus';
  const remaining = remainingMs(timer, now);
  const focusMs = totalFocusMs(timer, now);
  const elapsedMs = now - Date.parse(active.startedAtIso);

  // Chime on phase changes (not on mount / restore).
  const prevPhase = useRef(timer.phase);
  useEffect(() => {
    if (prevPhase.current === timer.phase) return;
    prevPhase.current = timer.phase;
    if (chimeEnabled()) playChime();
  }, [timer.phase]);

  // Live tab title; restored when the runner closes.
  useEffect(() => {
    const original = document.title;
    return () => { document.title = original; };
  }, []);
  useEffect(() => {
    document.title = `${formatClock(remaining ?? focusMs)} · ${PHASE_LABEL[timer.phase]} · StudySpace`;
  }, [remaining, focusMs, timer.phase]);

  // Space toggles pause (ignored while typing or when a control has focus).
  const toggle = () => dispatch({ type: timer.running ? 'pause' : 'resume', now: Date.now() });
  const toggleRef = useRef(toggle);
  useEffect(() => { toggleRef.current = toggle; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.code !== 'Space' || t?.closest('input, textarea, select, button, [contenteditable="true"], [role="radio"]')) return;
      e.preventDefault();
      toggleRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const announce = isBreak
    ? `Break time — ${Math.round((remaining ?? 0) / 60000)} minutes. Stretch, hydrate, look at something far away.`
    : 'Back to focus.';

  return (
    <div className={cn('fixed inset-0 z-40 overflow-y-auto bg-bg transition-colors duration-1000', isBreak && 'study-eclipse')}>
      <div aria-hidden className="study-starfield pointer-events-none fixed inset-0" />
      <div className="relative mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate font-semibold">
              {subject && <SubjectDot color={subject.color} />}{subject?.name ?? 'Study session'}
            </p>
            <p className="text-xs text-ink-muted tabular">Session {formatDuration(elapsedMs / 1000)} · focus {formatDuration(focusMs / 1000)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExitOpen(true)}><X className="size-4" /> Exit</Button>
        </header>

        <p className="sr-only" aria-live="polite">{announce}</p>

        <div className="flex flex-col items-center gap-5">
          <OrbitTimer progress={phaseProgress(timer, now)} phase={timer.phase} remaining={remaining} elapsed={focusMs} completed={timer.completedFocus} size={small ? 240 : 300} />
          {!timer.running && <p className="text-sm font-semibold text-gold">Paused</p>}
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant={timer.running ? 'secondary' : 'primary'} onClick={toggle} aria-keyshortcuts="Space">
              {timer.running ? <><Pause className="size-4" /> Pause</> : <><Play className="size-4" /> Resume</>}
            </Button>
            {isBreak && <Button variant="secondary" onClick={() => dispatch({ type: 'skip', now: Date.now() })}><SkipForward className="size-4" /> Skip break</Button>}
            <Button variant="gold" onClick={() => setFinishOpen(true)}><Square className="size-4" /> Finish</Button>
          </div>
        </div>

        {isBreak && <p className="text-center text-ink-muted">Stretch, hydrate, look at something far away ✦</p>}
        {/* Hidden (not unmounted) during breaks so a review or quiz keeps its place. */}
        <section className={cn('rounded-3xl border border-line bg-surface/90 p-4 backdrop-blur', isBreak && 'hidden')}>
          {!active.content && <p className="text-center text-ink-muted">{TIPS[Math.floor(now / 120_000) % TIPS.length]}</p>}
          {active.content?.type === 'deck' && (deckDone
            ? <p className="py-6 text-center">Deck reviewed ✦ Keep focusing, or <Link to={`/decks/${active.content.id}`} className="text-primary underline">open the deck</Link> after you finish.</p>
            : <ReviewSession deckId={active.content.id} embedded onReview={(ok) => count('card', ok)} onFinish={() => setDeckDone(true)} />)}
          {active.content?.type === 'quiz' && <QuizContent quizId={active.content.id} onAnswered={(answers) => answers.forEach((a) => count('question', a.correct))} />}
          {active.content?.type === 'note' && <NoteContent noteId={active.content.id} />}
        </section>
      </div>

      <Dialog open={exitOpen} onOpenChange={setExitOpen} title="Leave study mode?" size="sm"
        description={`You've focused for ${formatDuration(focusMs / 1000)}.`}
        footer={<><Button variant="secondary" onClick={() => setExitOpen(false)}>Keep studying</Button>
          <Button onClick={() => { setExitOpen(false); onFinish(); }}>Finish &amp; save</Button></>}>
        <p className="text-sm text-ink-muted">Finishing saves your session as a new star.</p>
      </Dialog>
      <Dialog open={finishOpen} onOpenChange={setFinishOpen} title="Finish this session?" size="sm"
        description={`Focus so far: ${formatDuration(focusMs / 1000)}.`}
        footer={<><Button variant="secondary" onClick={() => setFinishOpen(false)}>Not yet</Button>
          <Button variant="gold" onClick={() => { setFinishOpen(false); onFinish(); }}>Finish</Button></>}>
        <p className="text-sm text-ink-muted">{focusMs < 60_000 ? "Sessions under a minute aren't saved." : 'Nice work — let’s add it to your sky.'}</p>
      </Dialog>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/dates';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/Progress';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { isCorrect, sameAnswer, type AnswerRecord } from './scoring';
import type { QuizSource } from './useQuizSource';

const MODE_TEXT: Record<string, string> = {
  practice: 'Instant feedback after each question.', timed: 'Beat the clock — results at the end.',
  random: 'A random mix.', subject: 'Everything in this subject.', deck: 'Built from your flashcards.',
};

export function QuizRunner({ source, onSubmit, embedded = false }: {
  source: QuizSource; onSubmit: (answers: AnswerRecord[], durationSeconds: number, startedAt: string) => void; embedded?: boolean;
}) {
  const qs = source.questions;
  const [started, setStarted] = useState(embedded);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(new Map<string, { chosen: string; timeMs: number }>());
  const [startedAt, setStartedAt] = useState<number | null>(() => (embedded ? Date.now() : null));
  const [shownAt, setShownAt] = useState(() => (embedded ? Date.now() : 0));
  const [now, setNow] = useState(() => (embedded ? Date.now() : 0));
  const [confirm, setConfirm] = useState(false);
  const submitted = useRef(false);
  const practice = source.mode === 'practice';
  const q = qs[index]!;
  const current = answers.get(q.id);
  const locked = practice && Boolean(current);
  const limitMs = source.timeLimitSeconds ? source.timeLimitSeconds * 1000 : null;
  const remaining = limitMs !== null && startedAt !== null ? limitMs - (now - startedAt) : null;

  function begin() { const t = Date.now(); setStarted(true); setStartedAt(t); setShownAt(t); setNow(t); }

  function submit() {
    if (submitted.current || startedAt === null) return;
    submitted.current = true;
    const records: AnswerRecord[] = qs.map((question) => {
      const a = answers.get(question.id);
      return { questionId: question.id, chosen: a?.chosen ?? null, correct: isCorrect(question, a?.chosen ?? null), timeMs: a?.timeMs ?? 0, question };
    });
    onSubmit(records, (Date.now() - startedAt) / 1000, new Date(startedAt).toISOString());
  }

  useEffect(() => {
    if (!started || limitMs === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [started, limitMs]);

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !submitted.current) { toast("Time's up"); submit(); }
  });

  function choose(o: string) {
    if (locked) return;
    setAnswers((m) => new Map(m).set(q.id, { chosen: o, timeMs: Date.now() - shownAt }));
  }
  function go(dir: 1 | -1) {
    const j = index + dir;
    if (j < 0 || j >= qs.length) return;
    setIndex(j); setShownAt(Date.now());
  }
  function finish() {
    if (answers.size < qs.length) setConfirm(true); else submit();
  }

  useEffect(() => {
    if (!started) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
      if (q.type === 'tf' && /^[tf]$/i.test(e.key)) return choose(e.key.toLowerCase() === 't' ? 'True' : 'False');
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) return choose(q.options[n - 1]!);
      if (e.key === 'Enter' && current) { if (index < qs.length - 1) go(1); else finish(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!started) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <h1 className="font-display text-3xl">{source.title}</h1>
        <p className="mt-2 text-ink-muted">{qs.length} questions · {MODE_TEXT[source.mode]}</p>
        {source.timeLimitSeconds && <p className="mt-1 text-sm text-ink-muted"><Clock className="mr-1 inline size-4" />{Math.round(source.timeLimitSeconds / 60)} minutes</p>}
        <Button size="lg" className="mt-6" onClick={begin} autoFocus>Start</Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-ink-muted tabular">{index + 1}/{qs.length}</span>
        <ProgressBar value={answers.size / qs.length} label="Answered" className="flex-1" />
        {remaining !== null && (
          <span aria-live={remaining < 60_000 ? 'polite' : 'off'} className={cn('font-display tabular', remaining < 60_000 && 'text-coral')}>
            {formatClock(remaining)}
          </span>
        )}
      </div>
      <Card>
        {q.topic && <Badge tone="primary">{q.topic}</Badge>}
        <h2 className="mt-2 font-display text-xl leading-snug">{q.question}</h2>
        <div className="mt-4 flex flex-col gap-2">
          {q.options.map((o, i) => {
            const picked = current?.chosen === o;
            const right = sameAnswer(o, q.correctAnswer);
            return (
              <button key={o} onClick={() => choose(o)} disabled={locked}
                className={cn('min-h-12 rounded-xl border px-4 py-3 text-left text-sm transition',
                  !locked && (picked ? 'border-primary bg-primary-soft' : 'border-line hover:border-primary'),
                  locked && right && 'border-teal bg-teal-soft text-teal',
                  locked && picked && !right && 'border-coral bg-coral-soft text-coral',
                  locked && !picked && !right && 'border-line opacity-60')}>
                <span className="mr-2 text-ink-faint tabular">{q.type === 'tf' ? o[0] : i + 1}</span>{o}
              </button>
            );
          })}
        </div>
        {locked && (
          <div className={cn('mt-4 rounded-xl p-3 text-sm', isCorrect(q, current!.chosen) ? 'bg-teal-soft text-teal' : 'bg-coral-soft text-coral')} role="status">
            <strong>{isCorrect(q, current!.chosen) ? 'Correct!' : `Not quite — it's “${q.correctAnswer}”.`}</strong>
            {q.explanation && <p className="mt-1 text-ink">{q.explanation}</p>}
          </div>
        )}
      </Card>
      <div className="mt-4 flex justify-between gap-2">
        <Button variant="ghost" onClick={() => go(-1)} disabled={index === 0 || practice}>Back</Button>
        {index < qs.length - 1
          ? <Button onClick={() => go(1)} disabled={practice && !current}>Next</Button>
          : <Button onClick={finish} disabled={practice && !current}>Submit</Button>}
      </div>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={`${qs.length - answers.size} unanswered`}
        body="Submit anyway? Unanswered questions count as wrong." confirmLabel="Submit" onConfirm={submit} />
    </div>
  );
}

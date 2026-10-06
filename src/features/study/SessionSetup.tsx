import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { BookOpen, FileText, Layers, ListChecks, Timer } from 'lucide-react';
import { cn } from '@/lib/cn';
import { supabase } from '@/lib/supabase';
import { unwrapMaybe } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { useAuth } from '@/features/auth/AuthProvider';
import { SubjectPicker } from '@/features/subjects/SubjectPicker';
import { useDecks, useDeckStats } from '@/features/flashcards/api';
import { useQuizzes } from '@/features/quizzes/api';
import { NotePicker } from '@/features/notes/NotePicker';
import type { Task } from '@/features/planner/api';
import { chimeEnabled, setChimeEnabled } from './chime';
import type { TimerMode } from './timer';
import type { StartStudy } from './useStudySession';

type ContentKind = 'none' | 'deck' | 'quiz' | 'note';
export interface SetupChoices {
  subjectId: string | null; kind: ContentKind; deckId: string; quizId: string; noteId: string | null; timerMode: TimerMode;
  focusMin: number; shortMin: number; longMin: number; longEvery: number; customMin: number;
}

const KINDS: { value: ContentKind; label: string; icon: typeof Timer }[] = [
  { value: 'none', label: 'Just a timer', icon: Timer },
  { value: 'deck', label: 'Flashcards', icon: Layers },
  { value: 'quiz', label: 'Quiz', icon: ListChecks },
  { value: 'note', label: 'A note', icon: FileText },
];
const TIMER_MODES: { value: TimerMode; label: string }[] = [
  { value: 'pomodoro', label: 'Pomodoro' }, { value: 'custom', label: 'Custom' }, { value: 'stopwatch', label: 'Stopwatch' },
];

function Segmented<T extends string>({ label, value, onChange, items }: {
  label: string; value: T; onChange: (v: T) => void; items: { value: T; label: string; icon?: typeof Timer }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-line bg-surface-2 p-1">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button key={it.value} type="button" role="radio" aria-checked={value === it.value} onClick={() => onChange(it.value)}
            className={cn('flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-xs font-semibold text-ink-muted sm:flex-row sm:gap-1.5 sm:text-sm',
              value === it.value && 'bg-primary-soft text-primary')}>
            {Icon && <Icon className="size-4" aria-hidden />} {it.label}
          </button>
        );
      })}
    </div>
  );
}

const minutes = (v: string, min: number, max: number, dflt: number) => Math.min(max, Math.max(min, Math.round(Number(v)) || dflt));

function SetupForm({ task, initial, onStart }: { task: Task | null; initial?: SetupChoices; onStart: (s: StartStudy, choices: SetupChoices) => void }) {
  const { preferences } = useAuth();
  const mine = useDecks('mine');
  const shared = useDecks('shared');
  const stats = useDeckStats();
  const myQuizzes = useQuizzes('mine');
  const sharedQuizzes = useQuizzes('shared');
  const p = preferences.study;
  const [c, setC] = useState<SetupChoices>(() => initial ?? {
    subjectId: task?.subject_id ?? null, kind: 'none', deckId: '', quizId: '', noteId: null,
    timerMode: task?.duration_minutes ? 'custom' : 'pomodoro',
    focusMin: p.focusMin, shortMin: p.shortMin, longMin: p.longMin, longEvery: p.longEvery, customMin: task?.duration_minutes ?? 45,
  });
  const [chime, setChime] = useState(chimeEnabled);
  const set = <K extends keyof SetupChoices>(k: K, v: SetupChoices[K]) => setC((prev) => ({ ...prev, [k]: v }));
  const decks = [...(mine.data ?? []), ...(shared.data ?? [])];
  const quizzes = [...(myQuizzes.data ?? []), ...(sharedQuizzes.data ?? [])];
  const contentId = c.kind === 'deck' ? c.deckId : c.kind === 'quiz' ? c.quizId : c.kind === 'note' ? c.noteId : 'none';

  function start() {
    const taskDate = task
      ? task.recurrence === 'none' && (task.start_at ?? task.due_at) ? format(parseISO((task.start_at ?? task.due_at)!), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
      : null;
    onStart({
      subjectId: c.subjectId, taskId: task?.id ?? null, taskDate,
      content: c.kind === 'none' || !contentId ? null : { type: c.kind, id: contentId },
      config: { mode: c.timerMode, focusMin: c.focusMin, shortMin: c.shortMin, longMin: c.longMin, longEvery: c.longEvery, customMin: c.customMin },
    }, c);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <header className="text-center">
        <span aria-hidden className="font-display text-3xl text-gold">✦</span>
        <h1 className="font-display text-3xl">Ready to add a star?</h1>
        {task && <p className="mt-1 text-ink-muted">From your planner: <strong className="text-ink">{task.title}</strong></p>}
      </header>
      <Card className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5"><p className="text-sm font-medium">Subject</p><SubjectPicker value={c.subjectId} onChange={(v) => set('subjectId', v)} /></div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">What are you studying?</p>
          <Segmented label="What are you studying?" value={c.kind} onChange={(v) => set('kind', v)} items={KINDS} />
          {c.kind === 'deck' && (
            <Select aria-label="Deck" value={c.deckId} onChange={(e) => set('deckId', e.target.value)}>
              <option value="">Choose a deck…</option>
              {decks.map((d) => {
                const s = stats.data?.get(d.id);
                return <option key={d.id} value={d.id}>{d.title}{s ? ` — ${s.due + s.fresh} to review` : ''}</option>;
              })}
            </Select>
          )}
          {c.kind === 'quiz' && (
            <Select aria-label="Quiz" value={c.quizId} onChange={(e) => set('quizId', e.target.value)}>
              <option value="">Choose a quiz…</option>
              {quizzes.filter((q) => q.question_count > 0).map((q) => <option key={q.id} value={q.id}>{q.title} ({q.question_count})</option>)}
            </Select>
          )}
          {c.kind === 'note' && <NotePicker selected={c.noteId ? [c.noteId] : []} onChange={(ids) => set('noteId', ids[0] ?? null)} max={1} />}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Timer</p>
          <Segmented label="Timer" value={c.timerMode} onChange={(v) => set('timerMode', v)} items={TIMER_MODES} />
          {c.timerMode === 'pomodoro' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Focus (min)">{(id) => <Input id={id} type="number" min={5} max={120} value={c.focusMin} onChange={(e) => set('focusMin', minutes(e.target.value, 5, 120, 25))} />}</Field>
              <Field label="Short break">{(id) => <Input id={id} type="number" min={1} max={30} value={c.shortMin} onChange={(e) => set('shortMin', minutes(e.target.value, 1, 30, 5))} />}</Field>
              <Field label="Long break">{(id) => <Input id={id} type="number" min={5} max={60} value={c.longMin} onChange={(e) => set('longMin', minutes(e.target.value, 5, 60, 15))} />}</Field>
              <Field label="Long every">{(id) => <Input id={id} type="number" min={2} max={8} value={c.longEvery} onChange={(e) => set('longEvery', minutes(e.target.value, 2, 8, 4))} />}</Field>
            </div>
          )}
          {c.timerMode === 'custom' && (
            <Field label="Minutes">{(id) => <Input id={id} type="number" min={1} max={600} value={c.customMin} onChange={(e) => set('customMin', minutes(e.target.value, 1, 600, 45))} />}</Field>
          )}
          {c.timerMode === 'stopwatch' && <p className="text-sm text-ink-muted">Counts up until you finish. Pauses don&apos;t count.</p>}
        </div>

        <Switch label="Chime between phases" hint="A soft two-note sound." checked={chime} onCheckedChange={(v) => { setChime(v); setChimeEnabled(v); }} />

        <Button size="lg" variant="gold" onClick={start} disabled={c.kind !== 'none' && !contentId}>
          <BookOpen className="size-5" /> Start session
        </Button>
      </Card>
    </div>
  );
}

/** Loads the planner task from `?task=` first so the form can start from its subject and length. */
export function SessionSetup({ taskId, initial, onStart }: { taskId: string | null; initial?: SetupChoices; onStart: (s: StartStudy, choices: SetupChoices) => void }) {
  const { user } = useAuth();
  const task = useQuery({
    queryKey: ['study-task', taskId],
    enabled: Boolean(taskId),
    queryFn: async () => unwrapMaybe(await supabase.from('tasks').select('*').eq('id', taskId!).maybeSingle()),
  });
  if (taskId && task.isPending) return <div className="mx-auto max-w-xl"><Skeleton className="h-96" /></div>;
  // Only my own tasks can be linked (study_sessions.task_id must be mine); a partner's shared task starts a free session.
  const t = task.data && task.data.owner_id === user?.id ? task.data : null;
  return <SetupForm key={t?.id ?? 'free'} task={t} initial={initial} onStart={onStart} />;
}

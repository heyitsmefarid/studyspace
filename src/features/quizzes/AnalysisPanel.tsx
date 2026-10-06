import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { addDays, format } from 'date-fns';
import { toast } from 'sonner';
import { CalendarPlus, Layers, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { analyzeQuizResults } from '@/services/ai/aiService';
import { AnalysisSchema, type Analysis } from '@/services/ai/schemas';
import { useAuth } from '@/features/auth/AuthProvider';
import { subjectById, useSubjects } from '@/features/subjects/api';
import { useAiTask } from '@/features/ai/useAiTask';
import { AiStatus } from '@/features/ai/AiStatus';
import { ProviderBadge } from '@/features/ai/ProviderBadge';
import { useBulkInsertCards, useCreateDeck, useDecks } from '@/features/flashcards/api';
import { validateCard, type CardForm } from '@/features/flashcards/cardForm';
import { useCreateTask } from '@/features/planner/api';
import { PREFERRED_START } from '@/features/planner/planToTasks';
import { useSaveAnalysis, type QuizAttempt } from './api';
import { buildAnalysisInput } from './analysisInput';

const savedAnalysis = (raw: unknown): Analysis | null => {
  if (!raw || typeof raw !== 'object') return null;
  const p = AnalysisSchema.safeParse(raw);
  return p.success ? p.data : null;
};

function SuggestedCards({ cards, quizTitle, subjectId }: { cards: Analysis['suggestedFlashcards']; quizTitle: string; subjectId: string | null }) {
  const navigate = useNavigate();
  const decks = useDecks('mine');
  const createDeck = useCreateDeck();
  const bulk = useBulkInsertCards();
  const [picked, setPicked] = useState<boolean[]>(() => cards.map(() => true));
  const [dest, setDest] = useState('new');
  const [done, setDone] = useState(false);
  const newTitle = `Review — ${quizTitle}`.slice(0, 200);
  const chosen = cards.filter((_, i) => picked[i]);

  async function add() {
    const values = chosen.map((c) => validateCard({ type: 'qa', front: c.question, back: c.answer, topic: c.topic === 'General' ? undefined : c.topic }))
      .flatMap((r) => (r.ok ? [r.value] : [])) as CardForm[];
    if (values.length === 0) return;
    let deckId = dest;
    let title = decks.data?.find((d) => d.id === dest)?.title ?? newTitle;
    const startPosition = decks.data?.find((d) => d.id === dest)?.card_count ?? 0;
    if (dest === 'new') {
      const d = await createDeck.mutateAsync({ title: newTitle, subject_id: subjectId });
      deckId = d.id; title = d.title;
      setDest(d.id);
    }
    await bulk.mutateAsync({ deckId, cards: values, startPosition });
    setDone(true);
    toast.success(`Added ${values.length} card${values.length === 1 ? '' : 's'} to ${title}`, {
      action: { label: 'Study now', onClick: () => navigate(`/decks/${deckId}/study`) },
    });
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Suggested flashcards</h3>
      <ul className="flex flex-col gap-1.5">
        {cards.map((c, i) => (
          <li key={`${i}-${c.question}`}>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2">
              <input type="checkbox" checked={picked[i] ?? false} disabled={done} className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                onChange={(e) => setPicked(picked.map((p, j) => (j === i ? e.target.checked : p)))} />
              <span className="text-sm"><span className="font-medium">{c.question}</span><span className="block text-ink-muted">{c.answer}</span></span>
            </label>
          </li>
        ))}
      </ul>
      {done ? (
        <p className="mt-2 text-sm text-teal">Added ✓</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Select aria-label="Add to deck" value={dest} onChange={(e) => setDest(e.target.value)} className="h-10 w-auto max-w-full text-sm">
            <option value="new">New deck: {newTitle}</option>
            {(decks.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </Select>
          <Button size="sm" onClick={add} loading={createDeck.isPending || bulk.isPending} disabled={chosen.length === 0}>
            <Layers className="size-4" /> Add {chosen.length} card{chosen.length === 1 ? '' : 's'}
          </Button>
        </div>
      )}
    </section>
  );
}

function NextSession({ session, subjectId }: { session: NonNullable<Analysis['nextSession']>; subjectId: string | null }) {
  const { user, preferences } = useAuth();
  const navigate = useNavigate();
  const create = useCreateTask();
  const [scheduled, setScheduled] = useState(false);

  async function schedule() {
    const day = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const time = PREFERRED_START[preferences.study.preferredTimes[0] ?? 'evening'];
    await create.mutateAsync({
      owner_id: user!.id, title: `Review: ${session.topic}`.slice(0, 200), description: session.why.slice(0, 2000), kind: 'study_session',
      subject_id: subjectId, start_at: new Date(`${day}T${time}:00`).toISOString(), due_at: null, all_day: false,
      duration_minutes: Math.min(720, Math.max(5, session.durationMinutes)), priority: 'high', source: 'ai_plan', recurrence: 'none',
    });
    setScheduled(true);
    toast.success(`Scheduled for tomorrow at ${time}`, { action: { label: 'Open planner', onClick: () => navigate(`/planner?view=day&date=${day}`) } });
  }

  return (
    <section className="rounded-xl border border-line bg-surface-2 p-3">
      <h3 className="text-sm font-semibold">Next session</h3>
      <p className="mt-1 text-sm"><span className="capitalize">{session.activity}</span> · {session.topic} · {session.durationMinutes} min</p>
      {session.why && <p className="mt-0.5 text-sm text-ink-muted">{session.why}</p>}
      <Button size="sm" variant="secondary" className="mt-2" onClick={schedule} loading={create.isPending} disabled={scheduled}>
        <CalendarPlus className="size-4" /> {scheduled ? 'Scheduled ✓' : 'Schedule for tomorrow'}
      </Button>
    </section>
  );
}

function AnalysisView({ a, quizTitle, subjectId }: { a: Analysis; quizTitle: string; subjectId: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      {a.encouragement && <p className="rounded-xl bg-gold-soft px-4 py-3 text-ink">{a.encouragement}</p>}
      {(a.weakTopics.length > 0 || a.strongTopics.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <section>
            <h3 className="mb-1.5 text-sm font-semibold text-coral">Needs work</h3>
            {a.weakTopics.length ? (
              <ul className="flex flex-col gap-1.5 text-sm">{a.weakTopics.map((t) => <li key={t.topic}><strong>{t.topic}</strong>{t.reason && <span className="text-ink-muted"> — {t.reason}</span>}</li>)}</ul>
            ) : <p className="text-sm text-ink-faint">Nothing stood out.</p>}
          </section>
          <section>
            <h3 className="mb-1.5 text-sm font-semibold text-teal">Strong</h3>
            {a.strongTopics.length ? (
              <ul className="flex flex-col gap-1.5 text-sm">{a.strongTopics.map((t) => <li key={t.topic}><strong>{t.topic}</strong>{t.reason && <span className="text-ink-muted"> — {t.reason}</span>}</li>)}</ul>
            ) : <p className="text-sm text-ink-faint">Not enough to call yet.</p>}
          </section>
        </div>
      )}
      {a.commonMistakes.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-sm font-semibold">Common mistakes</h3>
          <ul className="list-disc pl-5 text-sm">{a.commonMistakes.map((m) => <li key={m}>{m}</li>)}</ul>
        </section>
      )}
      {a.reviewTopics.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-sm font-semibold">Review next</h3>
          <div className="flex flex-wrap gap-1.5">
            {a.reviewTopics.map((t) => (
              <Link key={t} to={`/tutor?mode=explain_simply&prompt=${encodeURIComponent(`Explain ${t}`)}`}
                className="rounded-full border border-line bg-surface-2 px-3 py-1 text-sm hover:border-primary hover:text-primary">
                {t}
              </Link>
            ))}
          </div>
        </section>
      )}
      {a.suggestedFlashcards.length > 0 && <SuggestedCards cards={a.suggestedFlashcards} quizTitle={quizTitle} subjectId={subjectId} />}
      {a.nextSession && <NextSession session={a.nextSession} subjectId={subjectId} />}
    </div>
  );
}

export function AnalysisPanel({ attempt }: { attempt: QuizAttempt }) {
  const { user, preferences } = useAuth();
  const subjects = useSubjects();
  const save = useSaveAnalysis();
  const saved = savedAnalysis(attempt.ai_analysis);
  const task = useAiTask(analyzeQuizResults, { onSuccess: (analysis) => save.mutate({ attemptId: attempt.id, analysis }) });
  const subject = subjectById(subjects.data, attempt.subject_id);
  // Subjects are owner-scoped: only file new cards/sessions under the subject if it's mine.
  const mySubjectId = subject && subject.owner_id === user?.id ? subject.id : null;
  const auto = preferences.ai.autoAnalyzeQuizzes;
  const started = useRef(false);
  const analysis = saved ?? (task.status === 'success' ? task.data ?? null : null);

  const runAnalysis = () => { started.current = true; void task.run(buildAnalysisInput(attempt, subject?.name)); };
  useEffect(() => {
    if (saved || started.current || !auto || subjects.isPending || attempt.total === 0) return;
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- analyse once per attempt, when subjects are known
  }, [saved, auto, subjects.isPending, attempt.id]);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg">✦ Nova&apos;s read on this quiz</h2>
        {!saved && <ProviderBadge meta={task.meta} />}
      </div>
      {analysis ? (
        <AnalysisView a={analysis} quizTitle={attempt.title} subjectId={mySubjectId} />
      ) : task.status === 'idle' ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-muted">Nova can spot patterns in your answers and suggest what to review.</p>
          <Button variant="gold" onClick={runAnalysis} disabled={attempt.total === 0}><Sparkles className="size-4" /> Get Nova&apos;s analysis</Button>
        </div>
      ) : (
        <AiStatus task={task} loadingLabel="Nova is reading your answers…" emptyTitle="Nothing to add this time" />
      )}
    </Card>
  );
}

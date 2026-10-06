import { useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Play, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/features/auth/AuthProvider';
import { SubjectPicker } from '@/features/subjects/SubjectPicker';
import { AskNovaButton } from '@/features/ai/AskNovaButton';
import { useInsertQuizWithQuestions, useQuiz, useSaveQuestions, useUpdateQuiz, type Quiz } from './api';
import { validateQuestion, type QuestionForm } from './questionForm';
import type { QuestionSnapshot } from './scoring';
import { emptyQuestion, QuestionEditor, toQuestionInput, type QuestionDraft } from './QuestionEditor';

const fromSnapshot = (q: QuestionSnapshot): QuestionDraft => ({
  key: q.id, type: q.type, question: q.question, options: q.type === 'mcq' ? q.options : ['True', 'False'],
  correct_answer: q.correctAnswer, explanation: q.explanation, topic: q.topic ?? '', difficulty: q.difficulty ?? '',
});

function Editor({ quiz, initial }: { quiz: Quiz; initial: QuestionSnapshot[] }) {
  const { user, partner } = useAuth();
  const navigate = useNavigate();
  const editable = quiz.owner_id === user?.id;
  const saveQuestions = useSaveQuestions(quiz.id);
  const updateQuiz = useUpdateQuiz();
  const copy = useInsertQuizWithQuestions();
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description);
  const [subjectId, setSubjectId] = useState<string | null>(quiz.subject_id);
  const [minutes, setMinutes] = useState(quiz.time_limit_seconds ? String(Math.round(quiz.time_limit_seconds / 60)) : '');
  const [shared, setShared] = useState(quiz.is_shared);
  const [drafts, setDrafts] = useState<QuestionDraft[]>(() => initial.map(fromSnapshot));
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [dirty, setDirty] = useState(false);
  const blocker = useBlocker(dirty);

  const change = (fn: () => void) => { fn(); setDirty(true); };
  const validated = () => {
    const out: QuestionForm[] = [];
    const errs: Record<string, Record<string, string>> = {};
    for (const d of drafts) {
      const r = validateQuestion(toQuestionInput(d));
      if (r.ok) out.push(r.value); else errs[d.key] = r.errors;
    }
    return { out, errs };
  };

  async function save() {
    const { out, errs } = validated();
    setErrors(errs);
    const firstBad = drafts.find((d) => errs[d.key]);
    if (firstBad) { document.getElementById(`question-${firstBad.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (!title.trim()) return toast.error('Give the quiz a title.');
    const mins = Number(minutes);
    await updateQuiz.mutateAsync({ id: quiz.id, patch: { title: title.trim(), description: description.trim(), subject_id: subjectId, is_shared: shared, time_limit_seconds: minutes && mins > 0 ? Math.min(240, Math.max(1, mins)) * 60 : null } });
    await saveQuestions.mutateAsync(out);
    setDirty(false);
    toast.success('Quiz saved ✦');
  }

  if (!editable) {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary">
          <span>{partner?.display_name ?? 'Your partner'}'s shared quiz · read-only</span>
          <Button size="sm" loading={copy.isPending} onClick={async () => {
            const qs = initial.map((q) => ({ type: q.type, question: q.question, options: q.options, correct_answer: q.correctAnswer, explanation: q.explanation, topic: q.topic ?? undefined, difficulty: q.difficulty ?? undefined }));
            const z = await copy.mutateAsync({ quiz: { title: `${quiz.title} (copy)`.slice(0, 200), description: quiz.description, source: quiz.source, time_limit_seconds: quiz.time_limit_seconds }, questions: qs });
            navigate(`/quizzes/${z.id}`);
          }}><Copy className="size-4" /> Copy to mine</Button>
        </div>
        <h1 className="font-display text-3xl">{quiz.title}</h1>
        <p className="mt-1 text-ink-muted">{initial.length} questions</p>
        <Link to={`/quizzes/${quiz.id}/take?mode=practice`} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink"><Play className="size-4" /> Practice</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link to="/quizzes" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="size-4" /> Quizzes</Link>
        <span className="flex-1" />
        <AskNovaButton context={{ type: 'quiz', id: quiz.id }} label="Ask Nova" size="sm" variant="ghost" />
        <Link to={`/quizzes/${quiz.id}/take?mode=practice`} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 text-sm font-semibold"><Play className="size-4" /> Practice</Link>
        <Button onClick={save} loading={saveQuestions.isPending || updateQuiz.isPending}>Save quiz</Button>
      </div>
      <Card className="mb-4 flex flex-col gap-4">
        <Field label="Title">{(id) => <Input id={id} maxLength={200} value={title} onChange={(e) => change(() => setTitle(e.target.value))} />}</Field>
        <Field label="Description">{(id) => <Textarea id={id} maxLength={1000} value={description} onChange={(e) => change(() => setDescription(e.target.value))} className="min-h-16" />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><p className="mb-1.5 text-sm font-medium">Subject</p><SubjectPicker value={subjectId} onChange={(v) => change(() => setSubjectId(v))} /></div>
          <Field label="Time limit (minutes, optional)">{(id) => <Input id={id} type="number" min={1} max={240} value={minutes} onChange={(e) => change(() => setMinutes(e.target.value))} />}</Field>
        </div>
        <Switch label={`Share with ${partner?.display_name ?? 'your partner'}`} checked={shared} onCheckedChange={(v) => change(() => setShared(v))} />
      </Card>
      <div className="flex flex-col gap-3">
        {drafts.map((d, i) => (
          <QuestionEditor key={d.key} index={i} draft={d} errors={errors[d.key]} first={i === 0} last={i === drafts.length - 1}
            onChange={(nd) => change(() => setDrafts((list) => list.map((x) => (x.key === d.key ? nd : x))))}
            onRemove={() => change(() => setDrafts((list) => list.filter((x) => x.key !== d.key)))}
            onMove={(dir) => change(() => setDrafts((list) => { const l = [...list]; const j = i + dir; [l[i], l[j]] = [l[j]!, l[i]!]; return l; }))} />
        ))}
        {drafts.length === 0 && <EmptyState title="No questions yet" body="Add one by hand, or let Nova write them from your notes." />}
        <Button variant="secondary" className="self-start" onClick={() => change(() => setDrafts((l) => [...l, emptyQuestion()]))}><Plus className="size-4" /> Add question</Button>
      </div>
      <ConfirmDialog open={blocker.state === 'blocked'} onOpenChange={(o) => { if (!o) blocker.reset?.(); }} title="Leave without saving?"
        body="Your changes to this quiz will be lost." confirmLabel="Leave" danger onConfirm={() => blocker.proceed?.()} />
    </div>
  );
}

export default function QuizEditorPage() {
  const { id } = useParams();
  const q = useQuiz(id);
  if (q.isPending) return <div className="flex flex-col gap-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-48" /></div>;
  if (!q.data) return <EmptyState title="This quiz drifted away" action={<Link to="/quizzes" className="text-primary underline">Back to quizzes</Link>} />;
  return <Editor key={q.data.quiz.id} quiz={q.data.quiz} initial={q.data.questions} />;
}

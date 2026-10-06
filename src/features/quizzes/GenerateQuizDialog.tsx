import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Select } from '@/components/ui/Field';
import { truncateAtBoundary } from '@/lib/text';
import { generateQuiz } from '@/services/ai/aiService';
import { MAX_SOURCE_CHARS, type GeneratedQuestion } from '@/services/ai/schemas';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAiTask } from '@/features/ai/useAiTask';
import { AiStatus } from '@/features/ai/AiStatus';
import { ProviderBadge } from '@/features/ai/ProviderBadge';
import { NotePicker } from '@/features/notes/NotePicker';
import { useNotesByIds } from '@/features/notes/api';
import { useInsertQuizWithQuestions } from './api';
import { validateQuestion, type QuestionForm } from './questionForm';
import { toQuestionInput, type QuestionDraft } from './QuestionEditor';
import { QuizDraftEditor } from './QuizDraftEditor';

type Difficulty = 'mixed' | 'easy' | 'medium' | 'hard';

const toDraft = (q: GeneratedQuestion): QuestionDraft => ({
  key: crypto.randomUUID(), type: q.type, question: q.question, options: q.type === 'mcq' ? q.options : ['True', 'False'],
  correct_answer: q.correctAnswer, explanation: q.explanation, topic: q.topic === 'General' ? '' : q.topic, difficulty: q.difficulty,
});

function Body({ onOpenChange, initialNoteIds }: { onOpenChange: (o: boolean) => void; initialNoteIds: string[] }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const insert = useInsertQuizWithQuestions();
  const [noteIds, setNoteIds] = useState(initialNoteIds);
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<{ mcq: boolean; tf: boolean }>({ mcq: true, tf: true });
  const [difficulty, setDifficulty] = useState<Difficulty>('mixed');
  const [drafts, setDrafts] = useState<QuestionDraft[] | null>(null);
  const [title, setTitle] = useState('');
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [confirmRegen, setConfirmRegen] = useState(false);
  const notes = useNotesByIds(noteIds);

  // Keep the picker's order; join each note under its title.
  const picked = noteIds.map((id) => notes.data?.find((n) => n.id === id)).filter((n) => n !== undefined);
  const joined = picked.filter((n) => n.content_text.trim()).map((n) => `## ${n.title || 'Untitled'}\n\n${n.content_text.trim()}`).join('\n\n');
  const { text, truncated } = truncateAtBoundary(joined, MAX_SOURCE_CHARS);
  const first = picked[0];
  const aiTitle = picked.length === 1 ? first!.title || 'Untitled' : 'Mixed notes';
  const typeList = (['mcq', 'tf'] as const).filter((t) => types[t]);

  const gen = useAiTask(generateQuiz, {
    onSuccess: (r) => {
      setDrafts(r.questions.map(toDraft));
      setTitle((r.title ?? `${first?.title || 'Nova'} quiz`).slice(0, 200));
      setErrors({});
    },
  });
  const generate = () => { setDrafts(null); void gen.run({ text, title: aiTitle, count, types: typeList, difficulty }); };
  const canGenerate = text.trim().length > 0 && typeList.length > 0;

  async function save() {
    if (!drafts) return;
    const values: QuestionForm[] = [];
    const errs: Record<string, Record<string, string>> = {};
    for (const d of drafts) {
      const r = validateQuestion(toQuestionInput(d));
      if (r.ok) values.push(r.value); else errs[d.key] = r.errors;
    }
    setErrors(errs);
    const firstBad = drafts.find((d) => errs[d.key]);
    if (firstBad) { document.getElementById(`question-${firstBad.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const quiz = await insert.mutateAsync({
      quiz: {
        title: title.trim() || 'Nova quiz', source: 'ai', source_note_ids: noteIds,
        // Subjects belong to their owner — a quiz built from a partner's note starts without one.
        subject_id: first && first.owner_id === user?.id ? first.subject_id : null,
      },
      questions: values,
    });
    onOpenChange(false);
    navigate(`/quizzes/${quiz.id}`);
    toast.success('Quiz saved', { action: { label: 'Practice now', onClick: () => navigate(`/quizzes/${quiz.id}/take?mode=practice`) } });
  }

  const stage = drafts ? 'review' : gen.status === 'idle' ? 'options' : 'generating';
  const footer = stage === 'options' ? (
    <><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
      <Button onClick={generate} disabled={!canGenerate}><Sparkles className="size-4" /> Generate</Button></>
  ) : stage === 'review' ? (
    <><Button variant="secondary" onClick={() => setConfirmRegen(true)}><RefreshCw className="size-4" /> Regenerate</Button>
      <Button onClick={save} loading={insert.isPending} disabled={!drafts?.length}>Save quiz</Button></>
  ) : gen.status !== 'loading' ? <Button variant="secondary" onClick={gen.reset}>Back to options</Button> : undefined;

  return (
    <>
      <Dialog open onOpenChange={onOpenChange} size="xl" title="Generate a quiz with Nova" footer={footer}>
        {stage === 'options' && (
          <div className="flex flex-col gap-4">
            <NotePicker selected={noteIds} onChange={setNoteIds} />
            {truncated && <Badge tone="gold" className="self-start">Long notes — Nova reads the first ~24k characters</Badge>}
            {picked.length > 0 && !joined && <p className="text-sm text-coral">Those notes are empty — add some content first.</p>}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={`Questions (${count})`}>
                {(id) => <input id={id} type="range" min={5} max={25} value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-11 w-full accent-[var(--primary)]" />}
              </Field>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">Question types</legend>
                {([['mcq', 'Multiple choice'], ['tf', 'True / False']] as const).map(([t, label]) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={types[t]} onChange={(e) => setTypes({ ...types, [t]: e.target.checked })} className="size-4 accent-[var(--primary)]" />
                    {label}
                  </label>
                ))}
                {typeList.length === 0 && <p role="alert" className="text-xs text-coral">Pick at least one type.</p>}
              </fieldset>
              <Field label="Difficulty">
                {(id) => (
                  <Select id={id} value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                    <option value="mixed">Mixed</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                  </Select>
                )}
              </Field>
            </div>
          </div>
        )}
        {stage === 'generating' && <AiStatus task={gen} loadingLabel="Nova is writing your quiz…" emptyTitle="No questions this time" />}
        {stage === 'review' && drafts && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{drafts.length} questions · review before saving</p>
              <ProviderBadge meta={gen.meta} />
            </div>
            <QuizDraftEditor title={title} onTitle={setTitle} drafts={drafts} errors={errors} onChange={setDrafts} />
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={confirmRegen}
        onOpenChange={setConfirmRegen}
        title="Regenerate this quiz?"
        body="Nova will write a fresh set of questions; your edits here will be lost."
        confirmLabel="Regenerate"
        onConfirm={() => { setConfirmRegen(false); generate(); }}
      />
    </>
  );
}

/** Notes → quiz → review → save. Mounts fresh each time it opens. */
export function GenerateQuizDialog({ open, onOpenChange, initialNoteIds = [] }: { open: boolean; onOpenChange: (o: boolean) => void; initialNoteIds?: string[] }) {
  if (!open) return null;
  return <Body onOpenChange={onOpenChange} initialNoteIds={initialNoteIds} />;
}

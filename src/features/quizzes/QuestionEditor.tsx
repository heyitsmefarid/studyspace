import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';

export interface QuestionDraft {
  key: string; type: 'mcq' | 'tf'; question: string; options: string[]; correct_answer: string;
  explanation: string; topic: string; difficulty: '' | 'easy' | 'medium' | 'hard';
}

export const emptyQuestion = (): QuestionDraft => ({
  key: crypto.randomUUID(), type: 'mcq', question: '', options: ['', '', '', ''], correct_answer: '', explanation: '', topic: '', difficulty: '',
});

export function toQuestionInput(d: QuestionDraft) {
  return {
    type: d.type, question: d.question, options: d.type === 'mcq' ? d.options : undefined, correct_answer: d.correct_answer,
    explanation: d.explanation, topic: d.topic || undefined, difficulty: d.difficulty || undefined,
  };
}

export function QuestionEditor({ index, draft, errors, onChange, onRemove, onMove, first, last }: {
  index: number; draft: QuestionDraft; errors?: Record<string, string>; onChange: (d: QuestionDraft) => void;
  onRemove: () => void; onMove?: (dir: -1 | 1) => void; first?: boolean; last?: boolean;
}) {
  const set = <K extends keyof QuestionDraft>(k: K, v: QuestionDraft[K]) => onChange({ ...draft, [k]: v });
  return (
    <Card className={cn('flex flex-col gap-3', errors && Object.keys(errors).length > 0 && 'border-coral')} id={`question-${draft.key}`}>
      <div className="flex items-center gap-2">
        <span className="font-display text-lg">Q{index + 1}</span>
        <div role="radiogroup" aria-label="Question type" className="inline-flex rounded-xl border border-line bg-surface-2 p-0.5">
          {(['mcq', 'tf'] as const).map((t) => (
            <button key={t} role="radio" aria-checked={draft.type === t}
              onClick={() => onChange({ ...draft, type: t, correct_answer: t === 'tf' ? (draft.correct_answer === 'True' || draft.correct_answer === 'False' ? draft.correct_answer : '') : draft.correct_answer })}
              className={cn('h-8 rounded-lg px-3 text-xs font-semibold', draft.type === t ? 'bg-primary-soft text-primary' : 'text-ink-muted')}>
              {t === 'mcq' ? 'Multiple choice' : 'True/False'}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {onMove && <Button variant="ghost" size="sm" aria-label="Move up" disabled={first} onClick={() => onMove(-1)}><ArrowUp className="size-4" /></Button>}
        {onMove && <Button variant="ghost" size="sm" aria-label="Move down" disabled={last} onClick={() => onMove(1)}><ArrowDown className="size-4" /></Button>}
        <Button variant="ghost" size="sm" aria-label={`Remove question ${index + 1}`} onClick={onRemove}><Trash2 className="size-4" /></Button>
      </div>
      <Field label="Question" error={errors?.question}>
        {(id) => <Textarea id={id} maxLength={1000} value={draft.question} onChange={(e) => set('question', e.target.value)} className="min-h-16" />}
      </Field>
      {draft.type === 'mcq' ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Options — pick the correct one</legend>
          {draft.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name={`correct-${draft.key}`} aria-label={`Option ${i + 1} is correct`} checked={o !== '' && draft.correct_answer === o}
                onChange={() => set('correct_answer', o)} className="size-4 accent-[var(--primary)]" />
              <Input aria-label={`Option ${i + 1}`} value={o} maxLength={200} className="h-10"
                onChange={(e) => { const opts = [...draft.options]; const was = draft.correct_answer === opts[i]; opts[i] = e.target.value; onChange({ ...draft, options: opts, correct_answer: was ? e.target.value : draft.correct_answer }); }} />
              {draft.options.length > 2 && <Button variant="ghost" size="icon" aria-label={`Remove option ${i + 1}`} onClick={() => set('options', draft.options.filter((_, j) => j !== i))}><X className="size-4" /></Button>}
            </div>
          ))}
          {draft.options.length < 6 && <Button size="sm" variant="ghost" className="self-start" onClick={() => set('options', [...draft.options, ''])}><Plus className="size-4" /> Add option</Button>}
        </fieldset>
      ) : (
        <fieldset className="flex gap-4">
          <legend className="mb-1 text-sm font-medium">Answer</legend>
          {(['True', 'False'] as const).map((v) => (
            <label key={v} className="flex items-center gap-2 text-sm">
              <input type="radio" name={`tf-${draft.key}`} checked={draft.correct_answer === v} onChange={() => set('correct_answer', v)} className="size-4 accent-[var(--primary)]" />{v}
            </label>
          ))}
        </fieldset>
      )}
      {(errors?.options || errors?.correct_answer) && <p role="alert" className="text-xs text-coral">{errors.options ?? errors.correct_answer}</p>}
      <Field label="Explanation">{(id) => <Textarea id={id} maxLength={2000} value={draft.explanation} onChange={(e) => set('explanation', e.target.value)} className="min-h-16" />}</Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Topic">{(id) => <Input id={id} maxLength={60} value={draft.topic} onChange={(e) => set('topic', e.target.value)} />}</Field>
        <Field label="Difficulty">
          {(id) => (
            <Select id={id} value={draft.difficulty} onChange={(e) => set('difficulty', e.target.value as QuestionDraft['difficulty'])}>
              <option value="">—</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </Select>
          )}
        </Field>
      </div>
    </Card>
  );
}

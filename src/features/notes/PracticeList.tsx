import { useState } from 'react';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { PracticeQuestion } from '@/services/ai/schemas';

function PracticeItem({ q, index }: { q: PracticeQuestion; index: number }) {
  const [hint, setHint] = useState(false);
  const [answer, setAnswer] = useState(false);
  return (
    <li className="rounded-xl border border-line bg-surface-2 p-3">
      <p className="text-sm font-semibold"><span className="tabular text-ink-faint">{index + 1}.</span> {q.question}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {q.hint && <Button variant="ghost" size="sm" aria-expanded={hint} onClick={() => setHint(!hint)}>{hint ? 'Hide hint' : 'Show hint'}</Button>}
        <Button variant="ghost" size="sm" aria-expanded={answer} onClick={() => setAnswer(!answer)}>{answer ? 'Hide answer' : 'Show answer'}</Button>
      </div>
      {hint && q.hint && <p className="mt-2 rounded-lg bg-gold-soft px-3 py-2 text-sm text-ink">💡 {q.hint}</p>}
      {answer && (
        <div className="mt-2 rounded-lg bg-teal-soft px-3 py-2 text-sm text-ink">
          <p className="whitespace-pre-wrap">{q.answer}</p>
          {q.explanation && <p className="mt-1 text-ink-muted">{q.explanation}</p>}
        </div>
      )}
    </li>
  );
}

export function PracticeList({ questions, onSaveAsFlashcards }: { questions: PracticeQuestion[]; onSaveAsFlashcards: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-muted">Answer each one out loud or on paper before you peek.</p>
      <ol className="flex flex-col gap-2">
        {questions.map((q, i) => <PracticeItem key={`${i}-${q.question}`} q={q} index={i} />)}
      </ol>
      <Button variant="secondary" onClick={onSaveAsFlashcards}><Layers className="size-4" /> Save as flashcards</Button>
    </div>
  );
}

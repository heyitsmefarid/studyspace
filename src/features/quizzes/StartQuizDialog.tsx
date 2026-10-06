import { useState } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { useSubjects } from '@/features/subjects/api';
import { useDecks } from '@/features/flashcards/api';
import { useQuizzes } from './api';

type Kind = 'random' | 'subject' | 'deck';

export function StartQuizDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<Kind>('random');
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState('');
  const [quizIds, setQuizIds] = useState<string[]>([]);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [deck, setDeck] = useState('');
  const mine = useQuizzes('mine');
  const shared = useQuizzes('shared');
  const subjects = useSubjects();
  const myDecks = useDecks('mine');
  const sharedDecks = useDecks('shared');
  const quizzes = [...(mine.data ?? []), ...(shared.data ?? [])];
  const decks = [...(myDecks.data ?? []), ...(sharedDecks.data ?? [])];
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  function start() {
    const p = new URLSearchParams({ mode: kind, n: String(Math.min(50, Math.max(5, count))) });
    if (minutes && Number(minutes) > 0) p.set('minutes', String(Number(minutes)));
    if (kind === 'random') { p.set('quizzes', quizIds.join(',')); p.set('subjects', subjectIds.join(',')); }
    if (kind === 'subject') p.set('subject', subject);
    if (kind === 'deck') p.set('deck', deck);
    onOpenChange(false);
    navigate(`/quiz/take?${p}`);
  }
  const canStart = kind === 'random' ? quizIds.length + subjectIds.length > 0 : kind === 'subject' ? Boolean(subject) : Boolean(deck);
  const pill = (active: boolean) => cn('rounded-full border px-3 py-1.5 text-sm', active ? 'border-primary bg-primary-soft text-primary' : 'border-line text-ink-muted');

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Quick quiz" size="lg"
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={start} disabled={!canStart}>Start</Button></>}>
      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Quiz source" className="inline-flex self-start rounded-xl border border-line bg-surface-2 p-1">
          {([['random', 'Random mix'], ['subject', 'By subject'], ['deck', 'From a deck']] as const).map(([v, l]) => (
            <button key={v} role="radio" aria-checked={kind === v} onClick={() => setKind(v)}
              className={cn('h-9 rounded-lg px-3 text-sm font-semibold', kind === v ? 'bg-primary-soft text-primary' : 'text-ink-muted')}>{l}</button>
          ))}
        </div>
        {kind === 'random' && (
          <>
            <div><p className="mb-2 text-sm font-medium">Quizzes</p>
              <div className="flex flex-wrap gap-2">{quizzes.map((q) => <button key={q.id} aria-pressed={quizIds.includes(q.id)} className={pill(quizIds.includes(q.id))} onClick={() => setQuizIds(toggle(quizIds, q.id))}>{q.title}</button>)}
                {quizzes.length === 0 && <p className="text-sm text-ink-muted">No quizzes yet.</p>}</div></div>
            <div><p className="mb-2 text-sm font-medium">Subjects</p>
              <div className="flex flex-wrap gap-2">{(subjects.data ?? []).map((s) => <button key={s.id} aria-pressed={subjectIds.includes(s.id)} className={pill(subjectIds.includes(s.id))} onClick={() => setSubjectIds(toggle(subjectIds, s.id))}>{s.name}</button>)}</div></div>
          </>
        )}
        {kind === 'subject' && (
          <Field label="Subject">{(id) => <Select id={id} value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">Choose…</option>{(subjects.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}</Field>
        )}
        {kind === 'deck' && (
          <Field label="Deck" hint="Needs at least 4 cards.">{(id) => <Select id={id} value={deck} onChange={(e) => setDeck(e.target.value)}><option value="">Choose…</option>{decks.map((d) => <option key={d.id} value={d.id}>{d.title} ({d.card_count})</option>)}</Select>}</Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Questions">{(id) => <Input id={id} type="number" min={5} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} />}</Field>
          <Field label="Timer (minutes, optional)">{(id) => <Input id={id} type="number" min={1} max={240} value={minutes} onChange={(e) => setMinutes(e.target.value)} />}</Field>
        </div>
      </div>
    </Dialog>
  );
}

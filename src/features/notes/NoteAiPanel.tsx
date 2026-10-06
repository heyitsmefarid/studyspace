import { useState, type RefObject } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  AlignLeft, BookOpenCheck, ClipboardCopy, Feather, FilePlus2, Layers, Lightbulb, ListChecks, MessageCircleQuestion, PenLine, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { explainConcept, generatePracticeQuestions, generateStudyGuide, generateSummary, simplifyText } from '@/services/ai/aiService';
import { MAX_SOURCE_CHARS, type GeneratedCard } from '@/services/ai/schemas';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAiTask } from '@/features/ai/useAiTask';
import { AiStatus } from '@/features/ai/AiStatus';
import { ProviderBadge } from '@/features/ai/ProviderBadge';
import { MarkdownView } from '@/features/ai/MarkdownView';
import { AskNovaButton } from '@/features/ai/AskNovaButton';
import { GenerateFlashcardsDialog, type FlashcardSource } from '@/features/flashcards/GenerateFlashcardsDialog';
import { GenerateQuizDialog } from '@/features/quizzes/GenerateQuizDialog';
import { useCreateNote, type Note } from './api';
import type { NoteEditorHandle } from './editor/Editor';
import { markdownToTiptap } from './markdown';
import { useNoteSource } from './useNoteSource';
import { PracticeList } from './PracticeList';

type TextAction = 'summarize' | 'explain' | 'simplify' | 'study_guide';
type Action = TextAction | 'practice';

const TEXT_ACTIONS: Record<TextAction, { label: string; result: string; desc: string; icon: LucideIcon }> = {
  summarize: { label: 'Summarize', result: 'Summary', desc: 'Key points, key terms, one thing to remember', icon: AlignLeft },
  explain: { label: 'Explain', result: 'Explanation', desc: 'Intuition, an analogy and a worked example', icon: Lightbulb },
  simplify: { label: 'Simplify', result: 'Simplified', desc: 'Same facts in easier words', icon: Feather },
  study_guide: { label: 'Study guide', result: 'Study guide', desc: 'Concepts, common mistakes and a self-check', icon: BookOpenCheck },
};

function ActionButton({ icon: Icon, label, desc, active, onClick }: { icon: LucideIcon; label: string; desc: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface-2', active && 'bg-primary-soft')}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-ink-muted">{desc}</span>
      </span>
    </button>
  );
}

export function NoteAiPanel({ note, editorRef, editable }: { note: Note; editorRef: RefObject<NoteEditorHandle | null>; editable: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createNote = useCreateNote();
  const src = useNoteSource(note, editorRef);
  const [active, setActive] = useState<Action | null>(null);
  const [lastLabel, setLastLabel] = useState('');
  const [explainOpen, setExplainOpen] = useState(false);
  const [focus, setFocus] = useState('');
  const [cards, setCards] = useState<{ source: FlashcardSource; initial?: GeneratedCard[] } | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);

  const tasks = {
    summarize: useAiTask(generateSummary),
    explain: useAiTask(explainConcept),
    simplify: useAiTask(simplifyText),
    study_guide: useAiTask(generateStudyGuide),
  };
  const practice = useAiTask(generatePracticeQuestions);
  const mine = note.owner_id === user?.id;
  // Subjects belong to their owner, so material from a partner's note is filed without one.
  const subjectId = mine ? note.subject_id : null;
  const empty = !note.content_text.trim();
  const longNote = !src.useSelection && note.content_text.length > MAX_SOURCE_CHARS;

  const read = () => {
    const s = src.source();
    if (!s) toast.info('Write something first — Nova works from your note.');
    else setLastLabel(s.label);
    return s;
  };
  const runText = (a: TextAction) => {
    const s = read();
    if (!s) return;
    setActive(a);
    const input = { text: s.text, title: s.title, subject: s.subject };
    if (a === 'explain') void tasks.explain.run({ ...input, focus: focus.trim() || undefined });
    else void tasks[a].run(input);
  };
  const runPractice = () => {
    const s = read();
    if (!s) return;
    setActive('practice');
    void practice.run({ text: s.text, title: s.title, subject: s.subject });
  };
  const openCards = (initial?: GeneratedCard[]) => {
    const s = read();
    if (!s) return;
    setCards({ source: { text: s.text, title: s.title, subject: s.subject, noteId: note.id, subjectId }, initial });
  };

  const textTask = active && active !== 'practice' ? tasks[active] : null;
  const result = textTask?.status === 'success' ? textTask.data?.text ?? '' : '';
  const resultLabel = active && active !== 'practice' ? TEXT_ACTIONS[active].result : '';

  const insert = () => {
    editorRef.current?.insertContent([
      { type: 'horizontalRule' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: `✦ Nova ${resultLabel.toLowerCase()}` }] },
      ...markdownToTiptap(result),
    ]);
    toast.success('Added to your note');
  };
  const saveAsNote = async () => {
    const n = await createNote.mutateAsync({
      title: `${note.title || 'Untitled'} — ${resultLabel}`.slice(0, 200),
      content: { type: 'doc', content: markdownToTiptap(result) },
      content_text: result,
      subject_id: subjectId,
    });
    toast.success('Saved as a new note', { action: { label: 'Open', onClick: () => navigate(`/notes/${n.id}`) } });
  };
  const copy = () => navigator.clipboard.writeText(result).then(() => toast.success('Copied'), () => toast.error("Couldn't copy"));

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="font-display text-lg">✦ Nova</h2>
          <p className="text-xs text-ink-muted">{src.useSelection ? 'Reads your selection (or the whole note if nothing is selected)' : 'Reads the whole note'}</p>
        </div>
        <Switch label="Use my selection" hint="Highlight text in the note first." checked={src.useSelection} onCheckedChange={src.setUseSelection} />
        {longNote && <Badge tone="gold" className="self-start">Long note — Nova reads the first ~24k characters</Badge>}
        {empty && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-muted">Write something first — Nova works from your note.</p>}
        <div className="-mx-1 flex flex-col gap-0.5">
          {(Object.keys(TEXT_ACTIONS) as TextAction[]).map((a) => {
            const m = TEXT_ACTIONS[a];
            if (a !== 'explain') return <ActionButton key={a} icon={m.icon} label={m.label} desc={m.desc} active={active === a} onClick={() => runText(a)} />;
            return (
              <div key={a}>
                <ActionButton icon={m.icon} label={m.label} desc={m.desc} active={active === a || explainOpen} onClick={() => setExplainOpen(!explainOpen)} />
                {explainOpen && (
                  <form className="mx-3 mb-2 mt-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); runText('explain'); }}>
                    <Input aria-label="What should Nova focus on?" placeholder="Focus (optional)" value={focus} maxLength={500} onChange={(e) => setFocus(e.target.value)} className="h-9 text-sm" />
                    <Button type="submit" size="sm">Go</Button>
                  </form>
                )}
              </div>
            );
          })}
          <ActionButton icon={MessageCircleQuestion} label="Practice questions" desc="Open questions with hints and model answers" active={active === 'practice'} onClick={runPractice} />
          <ActionButton icon={Layers} label="Generate flashcards" desc="Review and edit before they're saved" onClick={() => openCards()} />
          <ActionButton icon={ListChecks} label="Generate quiz" desc="From this note, or mix in others" onClick={() => setQuizOpen(true)} />
        </div>
        <AskNovaButton context={{ type: 'note', id: note.id }} />
      </Card>

      {textTask && (
        <div className="flex flex-col gap-3">
          <AiStatus task={textTask} />
          {result && (
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg">{resultLabel}</h3>
                <ProviderBadge meta={textTask.meta} />
              </div>
              {lastLabel && <p className="-mt-2 text-xs text-ink-faint">From: {lastLabel}</p>}
              <MarkdownView markdown={result} className="text-sm" />
              <div className="flex flex-wrap gap-2">
                {editable && <Button size="sm" onClick={insert}><PenLine className="size-4" /> Insert into note</Button>}
                <Button size="sm" variant="secondary" onClick={saveAsNote} loading={createNote.isPending}><FilePlus2 className="size-4" /> Save as new note</Button>
                <Button size="sm" variant="ghost" onClick={copy}><ClipboardCopy className="size-4" /> Copy</Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {active === 'practice' && (
        <div className="flex flex-col gap-3">
          <AiStatus task={practice} loadingLabel="Nova is writing practice questions…" />
          {practice.status === 'success' && practice.data && (
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg">Practice</h3>
                <ProviderBadge meta={practice.meta} />
              </div>
              <PracticeList
                questions={practice.data.questions}
                onSaveAsFlashcards={() => openCards(practice.data!.questions.map((q) => ({ question: q.question, answer: q.answer, difficulty: 'medium', topic: q.topic })))}
              />
            </Card>
          )}
        </div>
      )}

      <GenerateFlashcardsDialog open={cards !== null} onOpenChange={(o) => { if (!o) setCards(null); }} source={cards?.source ?? null} initialCards={cards?.initial} />
      <GenerateQuizDialog open={quizOpen} onOpenChange={setQuizOpen} initialNoteIds={[note.id]} />
    </div>
  );
}

import { Field, Input } from '@/components/ui/Field';
import { QuestionEditor, type QuestionDraft } from './QuestionEditor';

export function QuizDraftEditor({ title, onTitle, drafts, errors, onChange }: {
  title: string; onTitle: (t: string) => void; drafts: QuestionDraft[]; errors: Record<string, Record<string, string>>;
  onChange: (d: QuestionDraft[]) => void;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const next = [...drafts];
    const [item] = next.splice(i, 1);
    next.splice(i + dir, 0, item!);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-4">
      <Field label="Quiz title">{(id) => <Input id={id} maxLength={200} value={title} onChange={(e) => onTitle(e.target.value)} />}</Field>
      {drafts.map((d, i) => (
        <QuestionEditor
          key={d.key}
          index={i}
          draft={d}
          errors={errors[d.key]}
          onChange={(next) => onChange(drafts.map((x) => (x.key === d.key ? next : x)))}
          onRemove={() => onChange(drafts.filter((x) => x.key !== d.key))}
          onMove={(dir) => move(i, dir)}
          first={i === 0}
          last={i === drafts.length - 1}
        />
      ))}
    </div>
  );
}

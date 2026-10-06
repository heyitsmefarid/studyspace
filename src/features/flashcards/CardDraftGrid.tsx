import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Field';

export interface CardDraft {
  key: string; question: string; answer: string; topic: string; difficulty: 'easy' | 'medium' | 'hard'; keep: boolean;
}

export function CardDraftGrid({ drafts, errors, onChange }: {
  drafts: CardDraft[]; errors: Record<string, Record<string, string>>; onChange: (d: CardDraft[]) => void;
}) {
  const patch = (key: string, p: Partial<CardDraft>) => onChange(drafts.map((d) => (d.key === key ? { ...d, ...p } : d)));
  const kept = drafts.filter((d) => d.keep).length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-muted">{kept} of {drafts.length} selected</span>
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => onChange(drafts.map((d) => ({ ...d, keep: true })))}>Select all</Button>
        <Button variant="ghost" size="sm" onClick={() => onChange(drafts.map((d) => ({ ...d, keep: false })))}>Select none</Button>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        {drafts.map((d, i) => {
          const err = errors[d.key] ?? {};
          return (
            <li key={d.key}>
              <Card className={cn('flex h-full flex-col gap-2 p-3', !d.keep && 'opacity-50', Object.keys(err).length > 0 && 'border-coral')}>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.keep}
                    onChange={(e) => patch(d.key, { keep: e.target.checked })}
                    aria-label={`Keep card ${i + 1}`}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span className="text-xs font-semibold text-ink-muted">Card {i + 1}</span>
                  <span className="flex-1" />
                  <Button variant="ghost" size="icon" className="size-8" aria-label={`Delete card ${i + 1}`} onClick={() => onChange(drafts.filter((x) => x.key !== d.key))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Textarea aria-label={`Card ${i + 1} question`} value={d.question} maxLength={1000} invalid={Boolean(err.front)}
                  onChange={(e) => patch(d.key, { question: e.target.value })} className="min-h-16 text-sm font-semibold" />
                {err.front && <p role="alert" className="text-xs text-coral">{err.front}</p>}
                <Textarea aria-label={`Card ${i + 1} answer`} value={d.answer} maxLength={2000} invalid={Boolean(err.back)}
                  onChange={(e) => patch(d.key, { answer: e.target.value })} className="min-h-16 text-sm" />
                {err.back && <p role="alert" className="text-xs text-coral">{err.back}</p>}
                <div className="mt-auto grid grid-cols-[1fr_auto] gap-2">
                  <Input aria-label={`Card ${i + 1} topic`} placeholder="Topic" value={d.topic} maxLength={60} className="h-9 text-sm"
                    onChange={(e) => patch(d.key, { topic: e.target.value })} />
                  <Select aria-label={`Card ${i + 1} difficulty`} value={d.difficulty} className="h-9 w-auto text-sm"
                    onChange={(e) => patch(d.key, { difficulty: e.target.value as CardDraft['difficulty'] })}>
                    <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                  </Select>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

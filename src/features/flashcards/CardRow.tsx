import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Flashcard } from './api';
import type { CardState } from './srs';

const TYPE_LABEL: Record<string, string> = { qa: 'Q/A', mcq: 'Multiple choice', tf: 'True/False' };
const STATE_COLOR: Record<CardState, string> = { new: 'var(--ink-faint)', learning: 'var(--coral)', reviewing: 'var(--teal)', mastered: 'var(--gold)' };

export function CardRow({ card, state, editable, first, last, onEdit, onDelete, onMove }: {
  card: Flashcard; state: CardState; editable: boolean; first: boolean; last: boolean;
  onEdit: () => void; onDelete: () => void; onMove: (dir: -1 | 1) => void;
}) {
  const answer = card.type === 'qa' ? card.back : card.correct_answer;
  return (
    <li className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3">
      <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: STATE_COLOR[state] }} title={state} aria-label={`State: ${state}`} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap gap-1.5">
          <Badge>{TYPE_LABEL[card.type] ?? card.type}</Badge>
          {card.topic && <Badge tone="primary">{card.topic}</Badge>}
        </div>
        <p className="text-sm font-medium text-ink">{card.front}</p>
        {answer && <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{answer}</p>}
      </div>
      {editable && (
        <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row">
          <Button variant="ghost" size="sm" aria-label="Move up" disabled={first} onClick={() => onMove(-1)}><ArrowUp className="size-4" /></Button>
          <Button variant="ghost" size="sm" aria-label="Move down" disabled={last} onClick={() => onMove(1)}><ArrowDown className="size-4" /></Button>
          <Button variant="ghost" size="sm" aria-label="Edit card" onClick={onEdit}><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="sm" aria-label="Delete card" onClick={onDelete}><Trash2 className="size-4" /></Button>
        </div>
      )}
    </li>
  );
}

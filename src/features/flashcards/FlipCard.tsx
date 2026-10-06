import { Badge } from '@/components/ui/Badge';
import type { Flashcard } from './api';
import { CardImage } from './CardImage';

const TYPE_LABEL: Record<string, string> = { qa: 'Question', mcq: 'Multiple choice', tf: 'True or false?' };

export function FlipCard({ card, revealed, onReveal }: { card: Flashcard; revealed: boolean; onReveal: () => void }) {
  const isQa = card.type === 'qa';
  const answer = isQa ? card.back : [card.correct_answer, card.back].filter(Boolean).join(' — ');
  const face = 'flip-face flex min-h-64 flex-col items-center justify-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center shadow-glow';
  const front = (
    <div className={`${face} flip-front`}>
      <div className="flex gap-2"><Badge>{TYPE_LABEL[card.type] ?? 'Card'}</Badge>{card.topic && <Badge tone="primary">{card.topic}</Badge>}</div>
      <CardImage path={card.front_image_path} alt="" />
      <p className="font-display text-2xl leading-snug">{card.front}</p>
      {isQa && !revealed && <p className="text-sm text-ink-faint">Tap or press Space to reveal</p>}
    </div>
  );
  return (
    <div className="flip">
      <div className="flip-inner" data-revealed={revealed}>
        {isQa ? (
          <button type="button" onClick={onReveal} aria-label={revealed ? 'Answer shown' : 'Show answer'} className="block w-full">{front}</button>
        ) : front}
        <div className={`${face} flip-back`} aria-live="polite">
          <Badge tone="teal">Answer</Badge>
          <CardImage path={card.back_image_path} alt="" />
          <p className="text-xl leading-relaxed">{answer || '—'}</p>
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';

export interface ReviewSummaryData { reviewed: number; correct: number; accuracy: number; masteredNow: number; xp: number; sessionKey: string }

export function ReviewSummary({ data, deckId }: { data: ReviewSummaryData; deckId: string }) {
  const tiles: [string, string, string?][] = [
    ['Cards reviewed', String(data.reviewed)],
    ['Accuracy', `${Math.round(data.accuracy * 100)}%`],
    ['Newly mastered', String(data.masteredNow), 'text-gold'],
    ['XP', `+${data.xp}`, 'text-gold'],
  ];
  return (
    <div className="mx-auto max-w-xl text-center">
      <div className="relative mx-auto mb-4 h-24 w-48" aria-hidden>
        {Array.from({ length: 7 }, (_, i) => (
          <svg key={i} viewBox="0 0 24 24" className="animate-rise absolute size-5"
            style={{ left: `${8 + i * 13}%`, top: `${(i * 37) % 60}%`, animationDelay: `${i * 0.08}s` }}>
            <path d="M12 2c.6 4.4 1.9 5.7 6.3 6.3-4.4.6-5.7 1.9-6.3 6.3-.6-4.4-1.9-5.7-6.3-6.3C10.1 7.7 11.4 6.4 12 2z" fill="var(--gold)" />
          </svg>
        ))}
      </div>
      <h1 className="font-display text-3xl">Session complete</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value, cls]) => (
          <Card key={label} className="p-4"><p className={`font-display text-2xl tabular ${cls ?? ''}`}>{value}</p><p className="text-xs text-ink-muted">{label}</p></Card>
        ))}
      </div>
      {data.xp === 0 && <p className="mt-3 text-sm text-ink-muted">Review 5+ cards in a session to earn XP.</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link to={`/decks/${deckId}/study?all=1`} className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink">Study more</Link>
        <Link to={`/quiz/take?mode=deck&deck=${deckId}`} className="inline-flex h-11 items-center rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold">Quiz me on this deck</Link>
        <Link to={`/decks/${deckId}`} className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold text-ink-muted">Back to deck</Link>
      </div>
    </div>
  );
}

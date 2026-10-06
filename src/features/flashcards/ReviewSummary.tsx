import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';
import { useCountUp } from '@/lib/countUp';

function Tile({ label, value, prefix = '', suffix = '', cls }: { label: string; value: number; prefix?: string; suffix?: string; cls?: string }) {
  const shown = useCountUp(value);
  return <Card className="p-4"><p className={`font-display text-2xl tabular ${cls ?? ''}`}>{prefix}{shown}{suffix}</p><p className="text-xs text-ink-muted">{label}</p></Card>;
}

export interface ReviewSummaryData { reviewed: number; correct: number; accuracy: number; masteredNow: number; xp: number; sessionKey: string }

export function ReviewSummary({ data, deckId }: { data: ReviewSummaryData; deckId: string }) {
  const stars = Math.min(12, Math.max(1, data.reviewed));
  return (
    <div className="mx-auto max-w-xl text-center">
      <div className="relative mx-auto mb-4 h-24 w-64" aria-hidden>
        {Array.from({ length: stars }, (_, i) => (
          <svg key={i} viewBox="0 0 24 24" className="absolute size-5 animate-pop-in"
            style={{ left: `${(i / Math.max(1, stars - 1)) * 90}%`, top: `${(i * 37) % 60}%`, animationDelay: `${i * 90}ms` }}>
            <path d="M12 2c.6 4.4 1.9 5.7 6.3 6.3-4.4.6-5.7 1.9-6.3 6.3-.6-4.4-1.9-5.7-6.3-6.3C10.1 7.7 11.4 6.4 12 2z" fill="var(--gold)" />
          </svg>
        ))}
      </div>
      <h1 className="font-display text-3xl">Session complete</h1>
      <div className="stagger mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Cards reviewed" value={data.reviewed} />
        <Tile label="Accuracy" value={Math.round(data.accuracy * 100)} suffix="%" />
        <Tile label="Newly mastered" value={data.masteredNow} cls="text-gold" />
        <Tile label="XP" value={data.xp} prefix="+" cls="text-gold" />
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

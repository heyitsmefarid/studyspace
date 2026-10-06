import { hashString } from '@/features/flashcards/constellation';
import type { AnswerRecord, TopicStat } from './scoring';

/** Stars appear in answer order (capped so a long quiz never waits). */
const pop = (index: number, x: number, y: number) => ({ animationDelay: `${Math.min(index, 30) * 50}ms`, transformOrigin: `${x}px ${y}px` });

export function ResultsSky({ answers, breakdown }: { answers: AnswerRecord[]; breakdown: Record<string, TopicStat> }) {
  const topics = Object.keys(breakdown);
  const W = 640, H = 240;
  const centers = new Map(topics.map((t, i) => {
    const a = (i / Math.max(1, topics.length)) * Math.PI * 2 - Math.PI / 2;
    const r = topics.length === 1 ? 0 : 80;
    return [t, { x: W / 2 + Math.cos(a) * r * 2.4, y: H / 2 + Math.sin(a) * r }];
  }));
  const label = `Quiz sky: ${answers.filter((a) => a.correct).length} of ${answers.length} stars lit across ${topics.length} topics`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
      {topics.map((t) => {
        const c = centers.get(t)!;
        const s = breakdown[t]!;
        const halo = s.total >= 2 ? (s.accuracy >= 0.8 ? 'var(--teal)' : s.accuracy < 0.6 ? 'var(--coral)' : null) : null;
        return (
          <g key={t}>
            {halo && <circle cx={c.x} cy={c.y} r={42} fill={halo} opacity={0.08} className="animate-fade-in" />}
            <text x={c.x} y={Math.min(H - 6, c.y + 54)} textAnchor="middle" fontSize="12" fill="var(--ink-muted)">{t} · {s.correct}/{s.total}</text>
          </g>
        );
      })}
      {answers.map((a, index) => {
        const t = a.question.topic?.trim() || 'General';
        const c = centers.get(t) ?? { x: W / 2, y: H / 2 };
        const h = hashString(a.questionId);
        const ang = ((h % 360) / 360) * Math.PI * 2;
        const d = 8 + ((h >>> 9) % 26);
        const x = c.x + Math.cos(ang) * d, y = c.y + Math.sin(ang) * d;
        return a.correct
          ? <circle key={a.questionId} cx={x} cy={y} r={3} fill="var(--gold)" className="animate-pop-in" style={{ filter: 'drop-shadow(0 0 4px var(--gold))', ...pop(index, x, y) }} />
          : <circle key={a.questionId} cx={x} cy={y} r={2.5} fill="none" stroke="var(--ink-faint)" className="animate-pop-in" style={pop(index, x, y)} />;
      })}
    </svg>
  );
}

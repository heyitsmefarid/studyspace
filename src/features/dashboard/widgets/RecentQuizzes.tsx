import { Link } from 'react-router';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/Skeleton';
import { useRecentAttempts } from '@/features/quizzes/api';
import { WidgetCard } from './WidgetCard';

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 160, h = 36, step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - v * (h - 6)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-40" role="img" aria-label={`Accuracy trend: ${values.map((v) => `${Math.round(v * 100)}%`).join(', ')}`}>
      <polyline points={pts.join(' ')} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => { const [x, y] = p.split(','); return <circle key={i} cx={x} cy={y} r="2.5" fill="var(--gold)" />; })}
    </svg>
  );
}

export function RecentQuizzes() {
  const attempts = useRecentAttempts(5);
  const list = attempts.data ?? [];
  return (
    <WidgetCard title="Recent quizzes" more={{ to: '/quizzes', label: 'Quizzes' }}>
      {attempts.isPending ? <Skeleton className="h-32" /> : list.length === 0 ? (
        <p className="text-sm text-ink-muted">Take a quiz and your results show up here.</p>
      ) : (
        <>
          <Sparkline values={[...list].reverse().map((a) => Number(a.accuracy))} />
          <ul className="flex flex-col gap-1">
            {list.map((a) => (
              <li key={a.id}>
                <Link to={`/attempts/${a.id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.title}</span>
                    <span className="block text-xs text-ink-faint">{a.finished_at ? formatDistanceToNowStrict(parseISO(a.finished_at), { addSuffix: true }) : ''}</span>
                  </span>
                  <span className="shrink-0 font-display text-lg tabular">{Math.round(Number(a.accuracy) * 100)}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </WidgetCard>
  );
}

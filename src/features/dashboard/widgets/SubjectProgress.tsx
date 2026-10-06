import { Skeleton } from '@/components/ui/Skeleton';
import { ProgressBar } from '@/components/ui/Progress';
import { useMySubjects } from '@/features/subjects/api';
import { SubjectDot } from '@/features/subjects/SubjectDot';
import { useDecks, useDeckStats } from '@/features/flashcards/api';
import { useRecentAttempts } from '@/features/quizzes/api';
import { subjectMastery } from '../stats';
import { WidgetCard } from './WidgetCard';

export function SubjectProgress() {
  const subjects = useMySubjects();
  const decks = useDecks('mine');
  const stats = useDeckStats();
  const attempts = useRecentAttempts(50);
  if (subjects.isPending) return <WidgetCard title="Subjects"><Skeleton className="h-24" /></WidgetCard>;
  const mastery = subjectMastery(decks.data ?? [], stats.data ?? new Map());
  const rows = (subjects.data ?? []).map((s) => {
    const acc = (attempts.data ?? []).filter((a) => a.subject_id === s.id).map((a) => Number(a.accuracy));
    return { ...s, mastery: mastery.get(s.id), quiz: acc.length ? acc.reduce((t, x) => t + x, 0) / acc.length : null };
  });
  return (
    <WidgetCard title="Subjects" more={{ to: '/stats', label: 'Stats' }}>
      {rows.length === 0 ? <p className="text-sm text-ink-muted">Add subjects in Settings to track progress per class.</p> : (
        <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {rows.map((s) => (
            <li key={s.id}>
              <div className="mb-1 flex items-center gap-2 text-sm">
                <SubjectDot color={s.color} />
                <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                <span className="shrink-0 text-xs text-ink-muted tabular">
                  {s.mastery !== undefined ? `${Math.round(s.mastery * 100)}% mastered` : 'no cards yet'}
                  {s.quiz !== null ? ` · quiz avg ${Math.round(s.quiz * 100)}%` : ''}
                </span>
              </div>
              <ProgressBar value={s.mastery ?? 0} tone="teal" label={`${s.name} card mastery`} />
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

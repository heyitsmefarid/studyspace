import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Clock, MoreHorizontal, Pencil, Plus, Share2, Shuffle, Sparkles, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Menu } from '@/components/ui/Menu';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressRing } from '@/components/ui/Progress';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/features/auth/AuthProvider';
import { subjectById, useSubjects } from '@/features/subjects/api';
import { useBestScores, useCreateQuiz, useDeleteQuiz, useQuizzes, useRecentAttempts, useUpdateQuiz, type QuizWithCount } from './api';
import { StartQuizDialog } from './StartQuizDialog';

const SOURCE: Record<string, { label: string; tone: 'neutral' | 'primary' | 'teal' }> = {
  manual: { label: 'Manual', tone: 'neutral' }, ai: { label: '✦ Nova', tone: 'primary' }, deck: { label: 'Deck', tone: 'teal' },
};

function QuizCard({ quiz, best }: { quiz: QuizWithCount; best?: number }) {
  const { user, partner } = useAuth();
  const subjects = useSubjects();
  const update = useUpdateQuiz();
  const remove = useDeleteQuiz();
  const [confirm, setConfirm] = useState(false);
  const mine = quiz.owner_id === user?.id;
  const src = SOURCE[quiz.source] ?? SOURCE.manual!;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/quizzes/${quiz.id}`} className="min-w-0">
          <h3 className="truncate font-display text-lg">{quiz.title}</h3>
          <p className="mt-0.5 text-xs text-ink-faint">{quiz.question_count} questions{subjectById(subjects.data, quiz.subject_id) ? ` · ${subjectById(subjects.data, quiz.subject_id)!.name}` : ''}</p>
        </Link>
        <div className="flex items-center gap-1">
          {best !== undefined && <ProgressRing value={best} size={40} label={`Best ${Math.round(best * 100)}%`} />}
          {mine && (
            <Menu trigger={<Button variant="ghost" size="icon" aria-label={`Actions for ${quiz.title}`}><MoreHorizontal className="size-4" /></Button>}
              items={[
                { label: 'Edit', icon: Pencil, onSelect: () => { location.assign(`/quizzes/${quiz.id}`); } },
                { label: quiz.is_shared ? 'Stop sharing' : `Share with ${partner?.display_name ?? 'partner'}`, icon: Share2, onSelect: () => update.mutate({ id: quiz.id, patch: { is_shared: !quiz.is_shared } }) },
                { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setConfirm(true) },
              ]} />
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={src.tone}>{src.label}</Badge>
        {quiz.time_limit_seconds && <Badge><Clock className="size-3" /> {Math.round(quiz.time_limit_seconds / 60)} min</Badge>}
        {!mine && <Badge tone="primary">{partner?.display_name ?? 'Partner'}'s quiz</Badge>}
      </div>
      <div className="mt-auto flex gap-2">
        <Link to={`/quizzes/${quiz.id}/take?mode=practice`} className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-ink">Practice</Link>
        <Link to={`/quizzes/${quiz.id}/take?mode=timed`} className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-line bg-surface-2 text-sm font-semibold">Timed</Link>
      </div>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} danger title="Delete this quiz?" confirmLabel="Delete" body="Your past results stay." onConfirm={() => remove.mutateAsync(quiz.id)} />
    </Card>
  );
}

export default function QuizzesPage() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<'mine' | 'shared'>('mine');
  const [quick, setQuick] = useState(false);
  const quizzes = useQuizzes(scope);
  const best = useBestScores();
  const recent = useRecentAttempts(5);
  const create = useCreateQuiz();

  const newQuiz = async () => { const z = await create.mutateAsync({ title: 'Untitled quiz', source: 'manual' }); navigate(`/quizzes/${z.id}`); };

  return (
    <div>
      <PageHeader title="Quizzes" actions={<>
        <span data-slot="generate-quiz" />
        <Button variant="secondary" onClick={() => setQuick(true)}><Shuffle className="size-4" /> Quick quiz</Button>
        <Button onClick={newQuiz} loading={create.isPending}><Plus className="size-4" /> New quiz</Button>
      </>} />
      {(recent.data?.length ?? 0) > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-ink-muted">Recent results</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {recent.data!.map((a) => (
              <Link key={a.id} to={`/attempts/${a.id}`} className="min-w-44 shrink-0 rounded-xl border border-line bg-surface p-3 hover:border-line-strong">
                <p className="truncate text-sm font-semibold">{a.title}</p>
                <p className="font-display text-2xl tabular">{Math.round(Number(a.accuracy) * 100)}%</p>
                <p className="text-xs text-ink-faint">{a.finished_at ? formatDistanceToNowStrict(parseISO(a.finished_at), { addSuffix: true }) : ''}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
      <Tabs label="Whose quizzes" value={scope} onValueChange={setScope} items={[{ value: 'mine', label: 'Mine' }, { value: 'shared', label: 'Shared with me' }]} className="mb-4" />
      {quizzes.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : (quizzes.data?.length ?? 0) === 0 ? (
        <EmptyState title={scope === 'mine' ? 'No quizzes yet' : 'Nothing shared yet'}
          body={scope === 'mine' ? 'Make one by hand, from a deck, or let Nova write one from your notes.' : 'Quizzes your partner shares show up here.'}
          action={scope === 'mine' ? <div className="flex flex-wrap justify-center gap-2"><Button onClick={newQuiz}><Plus className="size-4" /> New quiz</Button>
            <Button variant="secondary" onClick={() => setQuick(true)}><Sparkles className="size-4" /> Quiz from a deck</Button></div> : undefined} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {quizzes.data!.map((q) => <QuizCard key={q.id} quiz={q} best={best.data?.get(q.id)} />)}
        </div>
      )}
      {quick && <StartQuizDialog open={quick} onOpenChange={setQuick} />}
    </div>
  );
}

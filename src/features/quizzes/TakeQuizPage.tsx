import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { friendlyMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConstellationLoader } from '@/components/sky/ConstellationLoader';
import { quizKeys, saveAttempt, type SaveAttemptInput } from './api';
import { QuizRunner } from './QuizRunner';
import { useQuizSource } from './useQuizSource';

export default function TakeQuizPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const src = useQuizSource(params, id);
  const [pending, setPending] = useState<SaveAttemptInput | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function persist(input: SaveAttemptInput) {
    setSaving(true); setSaveError(null);
    try {
      const attempt = await saveAttempt(input);
      try { localStorage.setItem(`ss.lastQuizUrl.${attempt.id}`, location.pathname + location.search); } catch { /* storage unavailable */ }
      void qc.invalidateQueries({ queryKey: quizKeys.attempts });
      void qc.invalidateQueries({ queryKey: ['profiles'] });
      navigate(`/attempts/${attempt.id}`, { replace: true });
    } catch (err) {
      setPending(input);
      setSaveError(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (src.status === 'loading') return <div className="grid min-h-64 place-items-center"><ConstellationLoader label="Shuffling your questions…" /></div>;
  if (src.status === 'error' || !src.source) {
    return <EmptyState title="Can't start this quiz" body={src.error} action={<Link to="/quizzes" className="text-primary underline">Back to quizzes</Link>} />;
  }
  const source = src.source;

  if (saveError && pending) {
    return (
      <EmptyState title="Your answers are safe — saving failed" body={saveError}
        action={<Button loading={saving} onClick={() => persist(pending)}>Retry save</Button>} />
    );
  }

  return (
    <QuizRunner source={source} onSubmit={(answers, durationSeconds, startedAt) => persist({
      quizId: source.quizId, subjectId: source.subjectId, title: source.title, mode: source.mode, startedAt, durationSeconds, answers,
    })} />
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDuration } from '@/lib/dates';
import { useCountUp } from '@/lib/countUp';
import { friendlyMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Comet } from '@/components/sky/Comet';
import { ConstellationLoader } from '@/components/sky/ConstellationLoader';
import { useAuth } from '@/features/auth/AuthProvider';
import { useXpSince } from '@/features/gamification/api';
import { effectiveStreak, todayInZone, DEFAULT_TZ } from '@/features/gamification/streak';
import { subjectById, useSubjects } from '@/features/subjects/api';
import { taskKeys } from '@/features/planner/api';
import { saveStudySession } from './api';
import type { FinishedStudy } from './finish';

function NewStar() {
  const dim: [number, number][] = [[30, 70], [70, 30], [120, 60], [170, 25], [210, 75], [250, 40]];
  return (
    <svg viewBox="0 0 280 110" className="h-28 w-full max-w-sm" aria-hidden>
      <polyline points={dim.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="3 5" />
      {dim.map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.5" fill="var(--ink-faint)" />)}
      <g className="animate-star-arc" style={{ transformOrigin: '140px 90px' }}>
        <circle cx="140" cy="90" r="7" fill="var(--gold)" style={{ filter: 'drop-shadow(0 0 10px var(--gold))' }} />
      </g>
    </svg>
  );
}

/** Saves the finished session (retryable — it is never dropped), then celebrates it. */
export function SessionSummary({ data, onSaved, onAgain, onDiscard }: {
  data: FinishedStudy; onSaved: (d: FinishedStudy) => void; onAgain: () => void; onDiscard: () => void;
}) {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const subjects = useSubjects();
  const [status, setStatus] = useState<'saving' | 'saved' | 'error'>('saving');
  const [error, setError] = useState('');
  const started = useRef(false);
  const xp = useXpSince(status === 'saved' ? data.startedAtIso : null);
  const shownXp = useCountUp(xp);

  async function save() {
    try {
      await saveStudySession({
        id: data.sessionId, subjectId: data.subjectId, taskId: data.taskId, mode: data.timer.config.mode, startedAt: data.startedAtIso, endedAt: data.endedAtIso,
        focusSeconds: data.focusSeconds, cardsStudied: data.counters.cards, questionsAnswered: data.counters.questions, correctAnswers: data.counters.correct,
      });
      if (data.taskId && data.taskDate) {
        // Completing the planner task is best-effort; an existing completion is fine.
        await supabase.from('task_completions')
          .upsert({ task_id: data.taskId, user_id: user!.id, occurrence_date: data.taskDate }, { onConflict: 'task_id,occurrence_date', ignoreDuplicates: true });
      }
      await refreshProfile();
      for (const key of [['sessions'], ['xp-since'], ['focus-total'], taskKeys.all]) void qc.invalidateQueries({ queryKey: key });
      setStatus('saved');
      onSaved(data);
    } catch (e) {
      setError(friendlyMessage(e));
      setStatus('error');
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void save();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save exactly once per finished session
  }, []);

  if (status === 'saving') return <div className="grid min-h-[50dvh] place-items-center"><ConstellationLoader label="Adding your star…" /></div>;
  if (status === 'error') {
    return (
      <Card className="mx-auto flex max-w-md flex-col gap-3 text-center">
        <h1 className="font-display text-2xl">Your session isn&apos;t saved yet</h1>
        <p className="text-sm text-ink-muted">{error}</p>
        <p className="text-sm">Focus time: <strong>{formatDuration(data.focusSeconds)}</strong> — it&apos;s kept here until it saves.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => { setStatus('saving'); void save(); }}><RotateCcw className="size-4" /> Retry save</Button>
          <Button variant="ghost" onClick={() => { if (window.confirm('Discard this session? It won’t be saved and earns no XP.')) onDiscard(); }}>
            <Trash2 className="size-4" /> Discard session
          </Button>
        </div>
      </Card>
    );
  }

  const answered = data.counters.cards + data.counters.questions;
  const streak = profile ? effectiveStreak(profile.current_streak, profile.last_active_date, todayInZone(profile.timezone ?? DEFAULT_TZ)) : 0;
  const stats: [string, string][] = [
    ['Focus', formatDuration(data.focusSeconds)],
    ['Cards', String(data.counters.cards)],
    ['Questions', String(data.counters.questions)],
    ['Accuracy', answered > 0 ? `${Math.round((data.counters.correct / answered) * 100)}%` : '—'],
  ];

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
      <NewStar />
      <div>
        <h1 className="font-display text-3xl">A new star joins your sky</h1>
        <p className="mt-1 text-ink-muted">{subjectById(subjects.data, data.subjectId)?.name ?? 'Study session'} · {formatDuration(data.focusSeconds)} of focus</p>
        {data.capped && <p className="mt-1 text-xs text-ink-faint">Sessions are capped at 16 hours, so only the last 16 were counted.</p>}
      </div>
      <p className="font-display text-5xl text-gold tabular" aria-label={`${xp} XP earned`}>+{shownXp} XP</p>
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, v]) => (
          <Card key={label} className="p-3"><p className="font-display text-2xl tabular">{v}</p><p className="text-xs text-ink-muted">{label}</p></Card>
        ))}
      </div>
      <Comet streak={streak} />
      <div className="flex flex-wrap justify-center gap-2">
        <Link to="/" className="inline-flex h-11 items-center rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold">Back home</Link>
        <Button variant="gold" onClick={onAgain}>Study again</Button>
      </div>
    </div>
  );
}

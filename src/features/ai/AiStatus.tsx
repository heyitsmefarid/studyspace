import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConstellationLoader } from '@/components/sky/ConstellationLoader';
import type { AiTaskState } from './useAiTask';
import { describeAiError } from './describe';

type StatusTask = Pick<AiTaskState<unknown, unknown>, 'status' | 'error' | 'retry' | 'cancel'>;

/** "Try again" that stays disabled for `seconds`, counting down live. Remounts (and restarts) per error. */
function RetryButton({ seconds, onRetry }: { seconds: number; onRetry: () => void }) {
  const [deadline] = useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const waiting = left > 0;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waiting]);
  return (
    <Button variant="secondary" size="sm" disabled={waiting} onClick={onRetry}>
      <RotateCcw className="size-4" /> {waiting ? `Try again in ${left}s` : 'Try again'}
    </Button>
  );
}

export function AiStatus({ task, loadingLabel = 'Nova is thinking…', emptyTitle, emptyBody }: {
  task: StatusTask; loadingLabel?: string; emptyTitle?: string; emptyBody?: string;
}) {
  if (task.status === 'idle' || task.status === 'success') return null;

  if (task.status === 'loading') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
        <ConstellationLoader label={loadingLabel} />
        <Button variant="ghost" size="sm" onClick={task.cancel}>Cancel</Button>
      </div>
    );
  }

  if (task.status === 'empty') {
    return (
      <div role="status" aria-live="polite">
        <EmptyState
          title={emptyTitle ?? 'Nova came back empty-handed'}
          body={task.error?.message ?? emptyBody}
          action={<Button variant="secondary" size="sm" onClick={task.retry}><RotateCcw className="size-4" /> Try again</Button>}
        />
      </div>
    );
  }

  if (!task.error) return null;
  const d = describeAiError(task.error);
  const wait = (task.error.code === 'RATE_LIMITED' || task.error.code === 'PROVIDER_UNAVAILABLE') ? task.error.retryAfter ?? 0 : 0;
  return (
    <div role="status" aria-live="polite">
      <Card className="border-coral/40 bg-coral-soft">
        <p className="font-semibold text-coral">{d.title}</p>
        {d.body && <p className="mt-1 text-sm text-ink">{d.body}</p>}
        {(d.canRetry || d.action) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {d.canRetry && <RetryButton seconds={wait} onRetry={task.retry} />}
            {d.action && (
              <Link to={d.action.to} className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-ink">{d.action.label}</Link>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

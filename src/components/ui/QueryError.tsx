import { Button } from './Button';
import { friendlyMessage } from '@/lib/errors';

/** Keep load failures distinct from empty results, with a retry that preserves the current page. */
export function QueryError({ error, onRetry, retrying = false }: {
  error: unknown; onRetry: () => unknown; retrying?: boolean;
}) {
  return (
    <div role="alert" className="my-4 flex flex-col items-start gap-3 rounded-2xl border border-coral/30 bg-surface p-5">
      <p className="font-semibold">Couldn't load this content</p>
      <p className="text-sm text-ink-muted">{friendlyMessage(error)}</p>
      <Button variant="secondary" loading={retrying} onClick={() => { void onRetry(); }}>Try again</Button>
    </div>
  );
}

import { Link, useRouteError } from 'react-router';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export function RouteError() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : 'Something unexpected happened.';
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <EmptyState
        title="A star fell out of orbit"
        body={message}
        action={
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()}>Try again</Button>
            <Link to="/" className="inline-flex h-11 items-center rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold">Home</Link>
          </div>
        }
      />
    </div>
  );
}

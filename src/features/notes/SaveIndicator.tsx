import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { SaveStatus } from './autosaver';

export function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-1.5 text-xs', status === 'error' ? 'text-coral' : 'text-ink-faint')}>
      {(status === 'pending' || status === 'saving') && <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-primary" />}
      {status === 'saved' && <Check aria-hidden className="size-3.5 animate-pop-in text-teal" />}
      {status === 'pending' ? 'Unsaved…' : status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? "Couldn't save" : ''}
      {status === 'error' && <button onClick={onRetry} className="underline">Retry</button>}
    </span>
  );
}

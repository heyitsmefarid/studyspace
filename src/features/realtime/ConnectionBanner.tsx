import { Loader2 } from 'lucide-react';
import { useConnection } from './useRealtime';

/** Shown while the room channel is reconnecting (the offline banner covers a lost network). */
export function ConnectionBanner() {
  const status = useConnection();
  if (status !== 'reconnecting' || (typeof navigator !== 'undefined' && !navigator.onLine)) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 flex animate-[banner-in_320ms_var(--ease-soft)_both] items-center justify-center gap-2 bg-primary-soft py-1.5 text-sm text-primary backdrop-blur">
      <Loader2 className="size-4 animate-spin" aria-hidden /> Reconnecting…
    </div>
  );
}

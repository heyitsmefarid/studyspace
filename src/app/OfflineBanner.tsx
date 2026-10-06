import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 flex animate-[banner-in_320ms_var(--ease-soft)_both] items-center justify-center gap-2 bg-coral-soft py-1.5 text-sm text-coral backdrop-blur">
      <WifiOff className="size-4" aria-hidden /> You're offline — changes will save when you reconnect.
    </div>
  );
}

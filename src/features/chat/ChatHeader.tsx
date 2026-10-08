import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Avatar } from '@/components/sky/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { PresenceDot } from '@/features/realtime/PartnerAvatar';
import { presenceLabel } from '@/features/realtime/presence';
import { usePartnerPresence } from '@/features/realtime/useRealtime';

export function ChatHeader({ onSearch }: { onSearch: () => void }) {
  const { partner } = useAuth();
  const presence = usePartnerPresence();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <header className="flex items-center gap-3 border-b border-line pb-3">
      <span className="relative inline-flex"><Avatar profile={partner} size={40} /><PresenceDot presence={presence} /></span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-xl">{partner?.display_name || 'Your partner'}</h1>
        <p className="text-xs text-ink-muted">{presenceLabel(presence, now) ?? 'Our Room'}</p>
      </div>
      <button onClick={onSearch} className="grid size-10 place-items-center rounded-xl text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Search messages">
        <Search className="size-5" />
      </button>
    </header>
  );
}

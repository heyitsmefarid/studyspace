import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/sky/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { presenceLabel, type PartnerPresence } from './presence';
import { usePartnerPresence } from './useRealtime';

/** Green (teal) = online, gold = studying, nothing = offline. */
export function PresenceDot({ presence, className }: { presence: PartnerPresence; className?: string }) {
  if (presence.state === 'offline') return null;
  return (
    <span aria-hidden className={cn('absolute bottom-0 right-0 size-3 rounded-full ring-2 ring-surface',
      presence.state === 'studying' ? 'bg-gold' : 'bg-teal', className)} />
  );
}

export function PartnerAvatar({ size = 32 }: { size?: number }) {
  const { partner } = useAuth();
  const presence = usePartnerPresence();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  if (!partner) return null;
  const label = presenceLabel(presence, now) ?? 'Offline';
  return (
    <span className="relative inline-flex" title={`${partner.display_name || 'Your partner'} · ${label}`}>
      <Avatar profile={partner} size={size} />
      <PresenceDot presence={presence} />
      <span className="sr-only">{partner.display_name || 'Your partner'}: {label}</span>
    </span>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { MessageCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/sky/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { PresenceDot } from '@/features/realtime/PartnerAvatar';
import { presenceLabel } from '@/features/realtime/presence';
import { usePartnerPresence } from '@/features/realtime/useRealtime';

export function PartnerCard({ actions }: { actions?: ReactNode }) {
  const { partner } = useAuth();
  const presence = usePartnerPresence();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="relative inline-flex"><Avatar profile={partner} size={56} /><PresenceDot presence={presence} className="size-4" /></span>
        <div className="min-w-0">
          <p className="truncate font-display text-xl">{partner?.display_name || 'Your partner'}</p>
          <p className="text-sm text-ink-muted">{presenceLabel(presence, now) ?? 'Offline'}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions}
        <Link to="/chat" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold hover:border-line-strong">
          <MessageCircle className="size-4" aria-hidden /> Message
        </Link>
      </div>
    </Card>
  );
}

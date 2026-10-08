import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { usePrefersReducedMotion } from '@/lib/motion';
import { Avatar } from '@/components/sky/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTableChange } from '@/features/realtime/useRealtime';

interface Incoming { id: string; body: string }

/** The partner's shooting stars fly across the screen (≈ 2.5 s), then a toast offers a reply. Reduced motion: toast only. */
export function ShootingStarOverlay() {
  const { partner } = useAuth();
  const reduced = usePrefersReducedMotion();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Incoming[]>([]);
  const name = partner?.display_name || 'Your partner';
  const announce = (s: Incoming) => toast(`${name} sent you a shooting star ✦`, { description: s.body, action: { label: 'Reply', onClick: () => navigate('/chat') } });

  useTableChange('messages', (c) => {
    if (c.eventType !== 'INSERT') return;
    const m = c.new as { id: string; kind: string; sender_id: string; body: string };
    if (m.kind !== 'star' || m.sender_id !== partner?.id) return;
    if (reduced) { announce(m); return; }
    setQueue((q) => (q.some((x) => x.id === m.id) ? q : [...q, { id: m.id, body: m.body }]));
  });

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(() => { announce(current); setQueue((q) => q.slice(1)); }, 2500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one timer per star
  }, [current?.id]);

  if (!current) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      <svg viewBox="0 0 220 40" className="star-flight absolute left-0 top-[16%] h-14 w-[45vw] min-w-56">
        <defs>
          <linearGradient id="star-tail" x1="0" x2="1">
            <stop offset="0" stopColor="var(--gold)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--gold)" stopOpacity=".9" />
          </linearGradient>
        </defs>
        <line x1="0" y1="20" x2="196" y2="20" stroke="url(#star-tail)" strokeWidth="3" strokeLinecap="round" />
        <path d="M206 6c.8 6 2.6 7.8 8.6 8.6-6 .8-7.8 2.6-8.6 8.6-.8-6-2.6-7.8-8.6-8.6 6-.8 7.8-2.6 8.6-8.6z" fill="var(--gold)" style={{ filter: 'drop-shadow(0 0 8px var(--gold))' }} />
      </svg>
      <div className="star-card absolute inset-x-0 top-1/3 mx-auto flex w-fit max-w-[min(90vw,28rem)] items-center gap-3 rounded-2xl border border-gold/40 bg-raised/90 px-4 py-3 shadow-glow backdrop-blur">
        <Avatar profile={partner} size={36} />
        <p className="text-sm">{current.body}</p>
      </div>
    </div>
  );
}

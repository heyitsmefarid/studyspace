import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Orbit as OrbitIcon, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/sky/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { useStudySession } from '@/features/study/useStudySession';
import { isOver } from './orbit';
import { useOrbit } from './useOrbit';

/** Our Space: start a shared orbit (focus length from your Study settings), or join the one that's running. */
export function StudyTogetherButton() {
  const { preferences } = useAuth();
  const { orbit, start } = useOrbit();
  const { active } = useStudySession();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  const running = Boolean(orbit && !isOver(orbit, now));
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);
  if (orbit && running) {
    return <Button onClick={() => navigate(`/study?orbit=${orbit.id}`)}><OrbitIcon className="size-4" /> Join the orbit</Button>;
  }
  return (
    <Button disabled={Boolean(active)} title={active ? 'Finish your current session first' : undefined}
      onClick={() => navigate(`/study?orbit=${start(preferences.study.focusMin * 60_000)}`)}>
      <Users className="size-4" /> Study together
    </Button>
  );
}

/** App-wide: "<partner> started a 25-min orbit — Join", until the orbit ends. */
export function OrbitInvite() {
  const { user, partner } = useAuth();
  const { orbit } = useOrbit();
  const { active } = useStudySession();
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<string | null>(null);
  const running = Boolean(orbit && !isOver(orbit, now));
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);
  if (!orbit || !running || orbit.by === user?.id || active?.orbitId === orbit.id || dismissed === orbit.id) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-md animate-rise-in items-center gap-3 rounded-2xl border border-gold/40 bg-raised p-3 shadow-glow md:bottom-6">
      <Avatar profile={partner} size={36} />
      <p className="min-w-0 flex-1 text-sm"><strong>{partner?.display_name || 'Your partner'}</strong> started a {Math.round(orbit.durationMs / 60_000)}-min orbit</p>
      <Link to={`/study?orbit=${orbit.id}`} className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink">Join</Link>
      <button onClick={() => setDismissed(orbit.id)} aria-label="Dismiss" className="rounded-lg p-2 text-ink-faint hover:bg-surface-2"><X className="size-4" /></button>
    </div>
  );
}

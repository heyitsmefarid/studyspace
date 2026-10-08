import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthProvider';
import { ConstellationLoader } from '@/components/sky/ConstellationLoader';
import { AuthRecovery } from './AuthRecovery';

export function RequireAuth() {
  const { session, profile, loading, error } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="grid min-h-dvh place-items-center"><ConstellationLoader label="Finding your sky…" /></div>;
  if (error) return <main className="mx-auto grid min-h-dvh max-w-md content-center gap-4 px-4 py-12"><h1 className="font-display text-2xl">We couldn't load your account</h1><AuthRecovery message={error} /></main>;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (!profile) return <Navigate to="/login?error=no-profile" replace />;
  if (!profile.onboarded_at && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

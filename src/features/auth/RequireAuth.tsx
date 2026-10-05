import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthProvider';
import { ConstellationLoader } from '@/components/sky/ConstellationLoader';

export function RequireAuth() {
  const { session, profile, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="grid min-h-dvh place-items-center"><ConstellationLoader label="Finding your sky…" /></div>;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (!profile) return <Navigate to="/login?error=no-profile" replace />;
  if (!profile.onboarded_at && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

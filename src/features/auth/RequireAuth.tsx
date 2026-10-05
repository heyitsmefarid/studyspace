import { Outlet } from 'react-router';

/** Pass-through guard so the shell can render; Task 8 adds the session/onboarding checks. */
export function RequireAuth() {
  return <Outlet />;
}

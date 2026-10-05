import type { ReactNode } from 'react';

/** Minimal provider so the shell can render; Task 8 replaces it with the real auth state. */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

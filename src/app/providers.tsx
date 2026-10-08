import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { queryClient } from '@/lib/queryClient';
import { watchSystemTheme } from '@/lib/theme';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { Toaster } from '@/components/ui/Toaster';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => watchSystemTheme(), []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

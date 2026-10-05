import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppError, friendlyMessage } from './errors';

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      if (mutation.meta?.silent) return;
      toast.error(err instanceof AppError ? err.message : friendlyMessage(err));
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => count < 2 && !(err instanceof AppError && ['42501', 'PGRST116'].includes(err.code ?? '')),
    },
  },
});

import type { AiError } from '@/services/ai/types';

export function describeAiError(e: AiError): { title: string; body: string; canRetry: boolean; action?: { label: string; to: string } } {
  const body = e.message;
  switch (e.code) {
    case 'UNAUTHORIZED': return { title: 'Your session expired', body, canRetry: false, action: { label: 'Log in again', to: '/login' } };
    case 'RATE_LIMITED': return { title: 'Nova needs a breather', body, canRetry: true };
    case 'DAILY_LIMIT': return { title: "That's today's Nova limit", body, canRetry: false };
    case 'PROVIDER_UNAVAILABLE': return { title: e.retryable ? 'Nova is busy' : "Nova isn't set up yet", body, canRetry: e.retryable };
    case 'INVALID_OUTPUT': return { title: 'Nova got its wires crossed', body, canRetry: true };
    case 'EMPTY': return { title: 'Nova came back empty-handed', body, canRetry: true };
    case 'BAD_INPUT': return { title: "Nova can't use that input", body, canRetry: false };
    case 'NETWORK': return { title: "Couldn't reach Nova", body, canRetry: true };
  }
}

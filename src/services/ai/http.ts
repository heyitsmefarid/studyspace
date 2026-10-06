import { ProviderError } from './types.ts';

export function parseRetryAfterMs(res: Response, bodyText: string): number | undefined {
  const header = res.headers.get('retry-after');
  if (header) {
    const secs = Number(header);
    if (Number.isFinite(secs)) return Math.round(secs * 1000);
    const at = Date.parse(header);
    if (!Number.isNaN(at)) return Math.max(0, at - Date.now());
  }
  const m = /"retryDelay"\s*:\s*"([\d.]+)s"/.exec(bodyText);
  return m ? Math.round(Number(m[1]) * 1000) : undefined;
}

export async function httpError(provider: string, res: Response): Promise<ProviderError> {
  const body = await res.text().catch(() => '');
  const msg = `${provider} ${res.status}: ${body.slice(0, 200)}`;
  if (res.status === 429) return new ProviderError('rate_limit', msg, parseRetryAfterMs(res, body));
  if (res.status === 401 || res.status === 403) return new ProviderError('auth', msg);
  if (res.status === 400 || res.status === 404 || res.status === 422) return new ProviderError('bad_request', msg);
  return new ProviderError('unavailable', msg);
}

export function networkError(err: unknown, signal?: AbortSignal): ProviderError {
  if (signal?.aborted) return new ProviderError('timeout', 'Request timed out');
  return new ProviderError('unavailable', err instanceof Error ? err.message : String(err));
}

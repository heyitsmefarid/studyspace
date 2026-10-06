import { describe, expect, it } from 'vitest';
import { describeAiError } from './describe';
import type { AiErrorCode } from '@/services/ai/types';

describe('describeAiError', () => {
  it.each<[AiErrorCode, boolean]>([
    ['UNAUTHORIZED', false], ['RATE_LIMITED', true], ['DAILY_LIMIT', false], ['PROVIDER_UNAVAILABLE', true],
    ['INVALID_OUTPUT', true], ['EMPTY', true], ['BAD_INPUT', false], ['NETWORK', true],
  ])('%s → retry %s', (code, canRetry) => {
    const d = describeAiError({ code, message: 'server says', retryable: canRetry });
    expect(d.title.length).toBeGreaterThan(3);
    expect(d.canRetry).toBe(canRetry);
  });
  it('offers a log-in action for UNAUTHORIZED and keeps the server message as the body', () => {
    const d = describeAiError({ code: 'UNAUTHORIZED', message: 'Please log in again.', retryable: false });
    expect(d.action).toEqual({ label: 'Log in again', to: '/login' });
    expect(d.body).toBe('Please log in again.');
  });
  it('non-retryable PROVIDER_UNAVAILABLE (not configured) cannot retry', () => {
    expect(describeAiError({ code: 'PROVIDER_UNAVAILABLE', message: 'no keys', retryable: false }).canRetry).toBe(false);
  });
});

export const AI_TASKS = ['tutor', 'summarize', 'explain', 'simplify', 'study_guide', 'flashcards', 'quiz', 'practice', 'study_plan', 'quiz_analysis', 'recommendations'] as const;
export type AiTask = (typeof AI_TASKS)[number];
export type ProviderName = 'gemini' | 'groq';

export type AiErrorCode = 'UNAUTHORIZED' | 'RATE_LIMITED' | 'DAILY_LIMIT' | 'PROVIDER_UNAVAILABLE' | 'INVALID_OUTPUT' | 'EMPTY' | 'BAD_INPUT' | 'NETWORK';
export const AI_ERROR_CODES: readonly AiErrorCode[] = ['UNAUTHORIZED', 'RATE_LIMITED', 'DAILY_LIMIT', 'PROVIDER_UNAVAILABLE', 'INVALID_OUTPUT', 'EMPTY', 'BAD_INPUT', 'NETWORK'];
export interface AiError { code: AiErrorCode; message: string; retryable: boolean; retryAfter?: number }
export interface AiMeta { provider: ProviderName; model: string; fellBack: boolean; remainingToday?: number }
export type AIResult<T> = { ok: true; data: T; meta: AiMeta } | { ok: false; error: AiError };
export interface ChatMessage { role: 'user' | 'assistant'; content: string }

export function fail(code: AiErrorCode, message: string, retryable = false, retryAfter?: number): { ok: false; error: AiError } {
  return { ok: false, error: retryAfter === undefined ? { code, message, retryable } : { code, message, retryable, retryAfter } };
}

export type ProviderErrorKind = 'rate_limit' | 'unavailable' | 'timeout' | 'bad_request' | 'auth' | 'empty';

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly retryAfterMs?: number;
  constructor(kind: ProviderErrorKind, message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface ProviderRequest {
  system: string;
  messages: ChatMessage[];
  jsonSchema?: Record<string, unknown>;
  temperature: number;
  maxOutputTokens: number;
  signal?: AbortSignal;
}

export interface AIProvider {
  name: ProviderName;
  model: string;
  available: boolean;
  generate(req: ProviderRequest): Promise<string>;
}

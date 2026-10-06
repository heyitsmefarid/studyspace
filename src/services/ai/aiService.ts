import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase';
import { AI_ERROR_CODES, fail, type AIResult, type AiErrorCode, type AiTask } from './types';
import type {
  Analysis, ExplainInput, FlashcardsInput, FlashcardsResult, PlanResult, PracticeInput, PracticeResult, QuizAnalysisInput,
  QuizInput, QuizResult, RecommendationsInput, RecommendationsResult, SourceInput, StudyPlanInput, TextResult, TutorInput,
} from './schemas';

export interface AiClientDeps { fetchImpl: typeof fetch; baseUrl: string; anonKey: string; getToken: () => Promise<string | null> }

export function parseEnvelope<T>(body: unknown, status: number): AIResult<T> {
  if (body && typeof body === 'object' && 'ok' in body) {
    const b = body as { ok: unknown; data?: unknown; meta?: unknown; error?: { code?: unknown; message?: unknown; retryable?: unknown; retryAfter?: unknown } };
    if (b.ok === true && 'data' in b && b.meta && typeof b.meta === 'object') return b as AIResult<T>;
    if (b.ok === false && b.error && AI_ERROR_CODES.includes(b.error.code as AiErrorCode)) {
      return fail(b.error.code as AiErrorCode, String(b.error.message ?? ''), Boolean(b.error.retryable),
        typeof b.error.retryAfter === 'number' ? b.error.retryAfter : undefined);
    }
  }
  if (status === 401 || status === 403) return fail('UNAUTHORIZED', 'Please log in again.');
  if (status === 429) return fail('RATE_LIMITED', 'Nova needs a breather — try again in a minute.', true, 60);
  if (status === 404) return fail('PROVIDER_UNAVAILABLE', "Nova's server isn't deployed yet.", false);
  return fail('NETWORK', 'Nova sent an unexpected reply. Try again.', true);
}

export function createAiClient(deps: AiClientDeps) {
  async function call<T>(task: AiTask, input: unknown, signal?: AbortSignal): Promise<AIResult<T>> {
    const token = await deps.getToken().catch(() => null);
    if (!token) return fail('UNAUTHORIZED', 'Please log in again.');
    let res: Response;
    try {
      res = await deps.fetchImpl(`${deps.baseUrl}/functions/v1/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: deps.anonKey },
        body: JSON.stringify({ task, input }),
        signal,
      });
    } catch {
      if (signal?.aborted) return fail('NETWORK', 'Cancelled.', true);
      return fail('NETWORK', "Couldn't reach Nova — check your connection.", true);
    }
    let body: unknown;
    try { body = await res.json(); } catch { return fail('NETWORK', 'Nova sent an unreadable reply. Try again.', true); }
    return parseEnvelope<T>(body, res.status);
  }
  return {
    call,
    askTutor: (i: TutorInput, s?: AbortSignal) => call<TextResult>('tutor', i, s),
    generateSummary: (i: SourceInput, s?: AbortSignal) => call<TextResult>('summarize', i, s),
    explainConcept: (i: ExplainInput, s?: AbortSignal) => call<TextResult>('explain', i, s),
    simplifyText: (i: SourceInput, s?: AbortSignal) => call<TextResult>('simplify', i, s),
    generateStudyGuide: (i: SourceInput, s?: AbortSignal) => call<TextResult>('study_guide', i, s),
    generateFlashcards: (i: FlashcardsInput, s?: AbortSignal) => call<FlashcardsResult>('flashcards', i, s),
    generateQuiz: (i: QuizInput, s?: AbortSignal) => call<QuizResult>('quiz', i, s),
    generatePracticeQuestions: (i: PracticeInput, s?: AbortSignal) => call<PracticeResult>('practice', i, s),
    generateStudyPlan: (i: StudyPlanInput, s?: AbortSignal) => call<PlanResult>('study_plan', i, s),
    analyzeQuizResults: (i: QuizAnalysisInput, s?: AbortSignal) => call<Analysis>('quiz_analysis', i, s),
    generateRecommendations: (i: RecommendationsInput, s?: AbortSignal) => call<RecommendationsResult>('recommendations', i, s),
  };
}

const client = createAiClient({
  fetchImpl: (...a) => fetch(...a),
  baseUrl: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  getToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
});

export const {
  askTutor, generateSummary, explainConcept, simplifyText, generateStudyGuide, generateFlashcards, generateQuiz,
  generatePracticeQuestions, generateStudyPlan, analyzeQuizResults, generateRecommendations,
} = client;

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, type Json, type Tables, type TablesUpdate } from '@/lib/supabase';
import { assertOk, unwrap } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthProvider';
import { questionFromRow, scoreAttempt, type AnswerRecord } from './scoring';
import type { QuestionForm } from './questionForm';

export type Quiz = Tables<'quizzes'>;
export type QuizWithCount = Quiz & { question_count: number };
export type QuizAttempt = Tables<'quiz_attempts'>;
export type AttemptMode = 'practice' | 'timed' | 'random' | 'subject' | 'deck';

export const quizKeys = {
  all: ['quizzes'] as const,
  list: (scope: string) => ['quizzes', 'list', scope] as const,
  detail: (id: string) => ['quizzes', 'detail', id] as const,
  attempts: ['attempts'] as const,
  attempt: (id: string) => ['attempts', id] as const,
};

export function useQuizzes(scope: 'mine' | 'shared') {
  const { user } = useAuth();
  return useQuery({
    queryKey: quizKeys.list(scope),
    enabled: Boolean(user),
    queryFn: async () => {
      let q = supabase.from('quizzes').select('*, quiz_questions(count)').order('updated_at', { ascending: false });
      q = scope === 'mine' ? q.eq('owner_id', user!.id) : q.neq('owner_id', user!.id);
      return unwrap(await q).map(({ quiz_questions, ...z }) => ({
        ...z, question_count: (quiz_questions as unknown as { count: number }[])[0]?.count ?? 0,
      })) as QuizWithCount[];
    },
  });
}

export function useQuiz(id: string | undefined) {
  return useQuery({
    queryKey: quizKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const quiz = unwrap(await supabase.from('quizzes').select('*').eq('id', id!).single());
      const rows = unwrap(await supabase.from('quiz_questions').select('*').eq('quiz_id', id!).order('position'));
      return { quiz, questions: rows.map(questionFromRow) };
    },
  });
}

const questionRows = (quizId: string, questions: QuestionForm[]) => questions.map((q, i) => ({
  quiz_id: quizId, type: q.type, question: q.question, options: q.options, correct_answer: q.correct_answer,
  explanation: q.explanation, topic: q.topic || null, difficulty: q.difficulty ?? null, position: i,
}));

type QuizInput = { title: string; description?: string; subject_id?: string | null; source?: Quiz['source']; source_note_ids?: string[]; source_deck_id?: string | null; time_limit_seconds?: number | null; is_shared?: boolean };

export function useCreateQuiz() {
  const qc = useQueryClient();
  const { user, preferences } = useAuth();
  return useMutation({
    mutationFn: async (input: QuizInput) =>
      unwrap(await supabase.from('quizzes').insert({ owner_id: user!.id, is_shared: preferences.privacy.shareByDefault, ...input }).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: quizKeys.all }),
  });
}

export function useUpdateQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<'quizzes'> }) => assertOk(await supabase.from('quizzes').update(patch).eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: quizKeys.all }),
  });
}

export function useDeleteQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => assertOk(await supabase.from('quizzes').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: quizKeys.all }),
  });
}

export function useSaveQuestions(quizId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questions: QuestionForm[]) => {
      assertOk(await supabase.from('quiz_questions').delete().eq('quiz_id', quizId));
      if (questions.length) assertOk(await supabase.from('quiz_questions').insert(questionRows(quizId, questions)));
      assertOk(await supabase.from('quizzes').update({ updated_at: new Date().toISOString() }).eq('id', quizId));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: quizKeys.all }),
  });
}

export function useInsertQuizWithQuestions() {
  const qc = useQueryClient();
  const create = useCreateQuiz();
  return useMutation({
    mutationFn: async ({ quiz, questions }: { quiz: QuizInput; questions: QuestionForm[] }) => {
      const z = await create.mutateAsync(quiz);
      if (questions.length) assertOk(await supabase.from('quiz_questions').insert(questionRows(z.id, questions)));
      return z;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: quizKeys.all }),
  });
}

export function useAttempt(id: string | undefined) {
  return useQuery({
    queryKey: quizKeys.attempt(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => unwrap(await supabase.from('quiz_attempts').select('*').eq('id', id!).single()),
  });
}

export function useRecentAttempts(limit = 10) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...quizKeys.attempts, 'recent', limit],
    enabled: Boolean(user),
    queryFn: async () => unwrap(await supabase.from('quiz_attempts')
      .select('id, quiz_id, title, subject_id, mode, score, total, accuracy, finished_at, topic_breakdown')
      .eq('user_id', user!.id).not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(limit)),
  });
}

export function useBestScores() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...quizKeys.attempts, 'best'],
    enabled: Boolean(user),
    queryFn: async () => {
      const rows = unwrap(await supabase.from('quiz_attempts').select('quiz_id, accuracy').eq('user_id', user!.id).not('quiz_id', 'is', null));
      const best = new Map<string, number>();
      for (const r of rows) best.set(r.quiz_id!, Math.max(best.get(r.quiz_id!) ?? 0, Number(r.accuracy)));
      return best;
    },
  });
}

export interface SaveAttemptInput {
  quizId: string | null; subjectId: string | null; title: string; mode: AttemptMode; startedAt: string;
  durationSeconds: number; answers: AnswerRecord[]; sessionId?: string | null;
}

/** The server re-grades every answer (migration 20261006000007); the client score is only a consistent hint. */
export async function saveAttempt(i: SaveAttemptInput): Promise<QuizAttempt> {
  const { data: { user } } = await supabase.auth.getUser();
  const s = scoreAttempt(i.answers);
  return unwrap(await supabase.from('quiz_attempts').insert({
    quiz_id: i.quizId, subject_id: i.subjectId, user_id: user!.id, title: i.title.slice(0, 200) || 'Quiz', mode: i.mode,
    started_at: i.startedAt, finished_at: new Date().toISOString(), duration_seconds: Math.max(0, Math.round(i.durationSeconds)),
    score: s.score, total: s.total, accuracy: s.accuracy, answers: i.answers as unknown as Json,
    topic_breakdown: s.topicBreakdown as unknown as Json, session_id: i.sessionId ?? null,
  }).select().single());
}

export function useSaveAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: async ({ attemptId, analysis }: { attemptId: string; analysis: unknown }) =>
      assertOk(await supabase.from('quiz_attempts').update({ ai_analysis: analysis as Json }).eq('id', attemptId)),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: quizKeys.attempt(v.attemptId) }),
  });
}

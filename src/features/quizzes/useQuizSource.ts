import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { mulberry32 } from '@/lib/random';
import { buildDeckQuiz } from './deckQuiz';
import { prepareQuestions, questionFromRow, type QuestionSnapshot } from './scoring';
import type { AttemptMode } from './api';

export interface QuizSource {
  title: string; mode: AttemptMode; quizId: string | null; subjectId: string | null;
  questions: QuestionSnapshot[]; timeLimitSeconds: number | null;
}

const clampN = (v: string | null, dflt: number, max: number) => Math.min(max, Math.max(1, Number(v) || dflt));
const validMinutes = (raw: string | null): number | null => {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 1 ? Math.min(240, value) : null;
};

export async function resolveQuizSource(params: URLSearchParams, quizId?: string): Promise<QuizSource> {
  const rng = mulberry32(Date.now() % 2 ** 31);
  const mode = (params.get('mode') ?? 'practice') as AttemptMode;
  const minutes = validMinutes(params.get('minutes'));

  if (quizId) {
    const quiz = unwrap(await supabase.from('quizzes').select('*').eq('id', quizId).single());
    const rows = unwrap(await supabase.from('quiz_questions').select('*').eq('quiz_id', quizId).order('position'));
    if (rows.length === 0) throw new Error('This quiz has no questions yet.');
    const timed = mode === 'timed';
    return {
      title: quiz.title, mode: timed ? 'timed' : 'practice', quizId, subjectId: quiz.subject_id,
      questions: prepareQuestions(rows.map(questionFromRow), { shuffleOptions: true, rng }),
      timeLimitSeconds: timed ? (minutes !== null ? minutes * 60 : quiz.time_limit_seconds ?? rows.length * 60) : null,
    };
  }

  if (mode === 'deck') {
    const deckId = params.get('deck');
    if (!deckId) throw new Error('No deck selected.');
    const deck = unwrap(await supabase.from('decks').select('title, subject_id').eq('id', deckId).single());
    const cards = unwrap(await supabase.from('flashcards').select('id, type, front, back, options, correct_answer, topic, difficulty').eq('deck_id', deckId));
    const built = buildDeckQuiz(cards, rng, clampN(params.get('n'), 10, 50));
    if (!built.ok) throw new Error('Add at least 4 cards to quiz yourself on this deck.');
    return { title: `${deck.title} quiz`, mode: 'deck', quizId: null, subjectId: deck.subject_id, questions: built.questions, timeLimitSeconds: minutes !== null ? minutes * 60 : null };
  }

  if (mode === 'subject') {
    const subjectId = params.get('subject');
    if (!subjectId) throw new Error('No subject selected.');
    const subject = unwrap(await supabase.from('subjects').select('name').eq('id', subjectId).single());
    const rows = unwrap(await supabase.from('quiz_questions').select('*, quizzes!inner(subject_id)').eq('quizzes.subject_id', subjectId));
    if (rows.length === 0) throw new Error('No questions found for that subject.');
    return {
      title: `${subject.name} mix`, mode: 'subject', quizId: null, subjectId,
      questions: prepareQuestions(rows.map((r) => questionFromRow(r)), { shuffleQuestions: true, shuffleOptions: true, limit: clampN(params.get('n'), 15, 50), rng }),
      timeLimitSeconds: minutes !== null ? minutes * 60 : null,
    };
  }

  // random mix across chosen quizzes and/or subjects
  const quizIds = (params.get('quizzes') ?? '').split(',').filter(Boolean);
  const subjectIds = (params.get('subjects') ?? '').split(',').filter(Boolean);
  const found: QuestionSnapshot[] = [];
  if (quizIds.length) found.push(...unwrap(await supabase.from('quiz_questions').select('*').in('quiz_id', quizIds)).map(questionFromRow));
  if (subjectIds.length) {
    found.push(...unwrap(await supabase.from('quiz_questions').select('*, quizzes!inner(subject_id)').in('quizzes.subject_id', subjectIds)).map((r) => questionFromRow(r)));
  }
  const unique = [...new Map(found.map((q) => [q.id, q])).values()];
  if (unique.length === 0) throw new Error('No questions found for that selection.');
  return {
    title: 'Random mix', mode: 'random', quizId: null, subjectId: null,
    questions: prepareQuestions(unique, { shuffleQuestions: true, shuffleOptions: true, limit: clampN(params.get('n'), 10, 50), rng }),
    timeLimitSeconds: minutes !== null ? minutes * 60 : null,
  };
}

export function useQuizSource(params: URLSearchParams, quizId?: string) {
  const key = params.toString();
  const q = useQuery({
    queryKey: ['quiz-source', quizId ?? null, key],
    queryFn: () => resolveQuizSource(new URLSearchParams(key), quizId),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
  return {
    status: q.isPending ? 'loading' as const : q.isError ? 'error' as const : 'ready' as const,
    source: q.data,
    error: q.error instanceof Error ? q.error.message : undefined,
  };
}

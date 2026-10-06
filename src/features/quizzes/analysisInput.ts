import type { QuizAnalysisInput } from '@/services/ai/schemas';
import type { AnswerRecord } from './scoring';

const isRecord = (a: unknown): a is AnswerRecord =>
  Boolean(a && typeof a === 'object' && 'question' in a && (a as AnswerRecord).question && typeof (a as AnswerRecord).question.question === 'string');

export function buildAnalysisInput(attempt: { title: string; duration_seconds: number; answers: unknown }, subjectName?: string): QuizAnalysisInput {
  const answers = (Array.isArray(attempt.answers) ? attempt.answers : []).filter(isRecord).slice(0, 50);
  return {
    quizTitle: attempt.title.slice(0, 200) || 'Quiz',
    ...(subjectName ? { subject: subjectName.slice(0, 80) } : {}),
    durationSeconds: Math.max(0, Math.round(attempt.duration_seconds)),
    questions: answers.map((a) => ({
      question: a.question.question.slice(0, 1000),
      topic: (a.question.topic?.trim() || 'General').slice(0, 60),
      ...(a.question.difficulty ? { difficulty: a.question.difficulty } : {}),
      correctAnswer: a.question.correctAnswer.slice(0, 500),
      chosen: a.chosen === null ? null : a.chosen.slice(0, 500),
      correct: a.correct,
    })),
  };
}

import type { Tables } from '@/lib/supabase';
import { shuffle } from '@/lib/random';

export interface QuestionSnapshot {
  id: string; type: 'mcq' | 'tf'; question: string; options: string[]; correctAnswer: string;
  explanation: string; difficulty: 'easy' | 'medium' | 'hard' | null; topic: string | null;
}
export interface AnswerRecord { questionId: string; chosen: string | null; correct: boolean; timeMs: number; question: QuestionSnapshot }
export interface TopicStat { correct: number; total: number; accuracy: number }

const norm = (s: string) => s.trim().toLowerCase();
export const sameAnswer = (a: string, b: string) => norm(a) === norm(b);
export const isCorrect = (q: QuestionSnapshot, chosen: string | null) => chosen !== null && sameAnswer(q.correctAnswer, chosen);
const round = (n: number) => Math.round(n * 10000) / 10000;

export function scoreAttempt(answers: AnswerRecord[]) {
  const topicBreakdown: Record<string, TopicStat> = {};
  let score = 0;
  for (const a of answers) {
    const topic = a.question.topic?.trim() || 'General';
    const t = (topicBreakdown[topic] ??= { correct: 0, total: 0, accuracy: 0 });
    t.total++;
    if (a.correct) { t.correct++; score++; }
  }
  for (const t of Object.values(topicBreakdown)) t.accuracy = round(t.correct / t.total);
  const total = answers.length;
  return { score, total, accuracy: total ? round(score / total) : 0, topicBreakdown };
}

export function classifyTopics(b: Record<string, TopicStat>) {
  const out = { strong: [] as string[], weak: [] as string[], okay: [] as string[], needsData: [] as string[] };
  for (const [topic, s] of Object.entries(b)) {
    if (s.total < 2) out.needsData.push(topic);
    else if (s.accuracy >= 0.8) out.strong.push(topic);
    else if (s.accuracy < 0.6) out.weak.push(topic);
    else out.okay.push(topic);
  }
  return out;
}

export function prepareQuestions(qs: QuestionSnapshot[], opts: { shuffleQuestions?: boolean; shuffleOptions?: boolean; limit?: number; rng?: () => number }) {
  let list = opts.shuffleQuestions ? shuffle(qs, opts.rng) : [...qs];
  if (opts.limit !== undefined) list = list.slice(0, opts.limit);
  return list.map((q) => (q.type === 'mcq' && opts.shuffleOptions ? { ...q, options: shuffle(q.options, opts.rng) } : q));
}

export function questionFromRow(r: Tables<'quiz_questions'>): QuestionSnapshot {
  return {
    id: r.id, type: r.type as 'mcq' | 'tf', question: r.question, options: (r.options as string[]) ?? [],
    correctAnswer: r.correct_answer, explanation: r.explanation, difficulty: (r.difficulty as QuestionSnapshot['difficulty']) ?? null, topic: r.topic,
  };
}

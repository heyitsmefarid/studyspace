import type { Tables } from '@/lib/supabase';
import { shuffle } from '@/lib/random';
import type { QuestionSnapshot } from './scoring';

export type DeckCardLike = Pick<Tables<'flashcards'>, 'id' | 'type' | 'front' | 'back' | 'options' | 'correct_answer' | 'topic' | 'difficulty'>;
const norm = (s: string) => s.trim().toLowerCase();

export function buildDeckQuiz(cards: DeckCardLike[], rng: () => number = Math.random, limit?: number):
  { ok: true; questions: QuestionSnapshot[] } | { ok: false; reason: 'NOT_ENOUGH_CARDS' } {
  if (cards.length < 4) return { ok: false, reason: 'NOT_ENOUGH_CARDS' };
  const answers = cards.filter((c) => c.type === 'qa' && c.back.trim()).map((c) => ({ id: c.id, text: c.back.trim() }));
  const questions: QuestionSnapshot[] = [];
  for (const c of cards) {
    const base = { id: c.id, question: c.front, topic: c.topic, difficulty: (c.difficulty as QuestionSnapshot['difficulty']) ?? null };
    if (c.type === 'tf' && c.correct_answer) {
      questions.push({ ...base, type: 'tf', options: ['True', 'False'], correctAnswer: c.correct_answer, explanation: c.back });
    } else if (c.type === 'mcq' && Array.isArray(c.options) && c.correct_answer) {
      questions.push({ ...base, type: 'mcq', options: shuffle(c.options as string[], rng), correctAnswer: c.correct_answer, explanation: c.back });
    } else if (c.type === 'qa' && c.back.trim()) {
      const correct = c.back.trim();
      const seen = new Set([norm(correct)]);
      const pool: string[] = [];
      for (const a of shuffle(answers.filter((a) => a.id !== c.id), rng)) {
        if (seen.has(norm(a.text))) continue;
        seen.add(norm(a.text));
        pool.push(a.text);
        if (pool.length === 3) break;
      }
      if (pool.length === 0) continue;
      questions.push({ ...base, type: 'mcq', options: shuffle([correct, ...pool], rng), correctAnswer: correct, explanation: '' });
    }
  }
  if (questions.length === 0) return { ok: false, reason: 'NOT_ENOUGH_CARDS' };
  const ordered = shuffle(questions, rng);
  return { ok: true, questions: limit ? ordered.slice(0, limit) : ordered };
}

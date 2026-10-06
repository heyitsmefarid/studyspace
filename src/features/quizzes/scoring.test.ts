import { describe, expect, it } from 'vitest';
import { classifyTopics, isCorrect, prepareQuestions, scoreAttempt, type AnswerRecord, type QuestionSnapshot } from './scoring';
import { mulberry32 } from '@/lib/random';

const q = (id: string, topic: string | null, over: Partial<QuestionSnapshot> = {}): QuestionSnapshot => ({
  id, type: 'mcq', question: `Q${id}`, options: ['A', 'B', 'C', 'D'], correctAnswer: 'B', explanation: '', difficulty: null, topic, ...over,
});
const ans = (question: QuestionSnapshot, chosen: string | null): AnswerRecord => ({ questionId: question.id, chosen, correct: isCorrect(question, chosen), timeMs: 1000, question });

describe('scoring', () => {
  it('compares answers ignoring case and surrounding space; unanswered is wrong', () => {
    expect(isCorrect(q('1', 'x'), ' b ')).toBe(true);
    expect(isCorrect(q('1', 'x'), null)).toBe(false);
  });
  it('scores and breaks down by topic (null topic → General)', () => {
    const qs = [q('1', 'Cells'), q('2', 'Cells'), q('3', 'Energy'), q('4', null)];
    const r = scoreAttempt([ans(qs[0]!, 'B'), ans(qs[1]!, 'A'), ans(qs[2]!, 'B'), ans(qs[3]!, null)]);
    expect([r.score, r.total, r.accuracy]).toEqual([2, 4, 0.5]);
    expect(r.topicBreakdown).toEqual({
      Cells: { correct: 1, total: 2, accuracy: 0.5 }, Energy: { correct: 1, total: 1, accuracy: 1 }, General: { correct: 0, total: 1, accuracy: 0 },
    });
  });
  it('handles an empty attempt', () => {
    expect(scoreAttempt([])).toEqual({ score: 0, total: 0, accuracy: 0, topicBreakdown: {} });
  });
  it('classifies topics with ≥ 2 questions; single-question topics need more data', () => {
    expect(classifyTopics({
      A: { correct: 4, total: 5, accuracy: 0.8 }, B: { correct: 1, total: 3, accuracy: 0.33 },
      C: { correct: 2, total: 3, accuracy: 0.67 }, D: { correct: 1, total: 1, accuracy: 1 },
    })).toEqual({ strong: ['A'], weak: ['B'], okay: ['C'], needsData: ['D'] });
  });
  it('shuffles MCQ options but never TF options; respects limit', () => {
    const tf = q('t', null, { type: 'tf', options: ['True', 'False'], correctAnswer: 'False' });
    const out = prepareQuestions([q('1', null), tf, q('2', null)], { shuffleOptions: true, shuffleQuestions: true, limit: 2, rng: mulberry32(9) });
    expect(out).toHaveLength(2);
    for (const x of out) {
      if (x.type === 'tf') expect(x.options).toEqual(['True', 'False']);
      else expect([...x.options].sort()).toEqual(['A', 'B', 'C', 'D']);
    }
  });
});

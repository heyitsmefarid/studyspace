import { describe, expect, it } from 'vitest';
import { buildAnalysisInput } from './analysisInput';

const ans = (i: number, correct: boolean, topic: string | null = 'Cells') => ({
  questionId: `q${i}`, chosen: correct ? 'A' : null, correct, timeMs: 1000,
  question: { id: `q${i}`, type: 'mcq', question: `Question ${i}?`, options: ['A', 'B'], correctAnswer: 'A', explanation: '', difficulty: 'easy', topic },
});

describe('buildAnalysisInput', () => {
  it('maps the stored answers snapshot to the AI input', () => {
    const input = buildAnalysisInput({ title: 'Bio', duration_seconds: 300, answers: [ans(1, true), ans(2, false, null)] }, 'Biology');
    expect(input).toEqual({
      quizTitle: 'Bio', subject: 'Biology', durationSeconds: 300,
      questions: [
        { question: 'Question 1?', topic: 'Cells', difficulty: 'easy', correctAnswer: 'A', chosen: 'A', correct: true },
        { question: 'Question 2?', topic: 'General', difficulty: 'easy', correctAnswer: 'A', chosen: null, correct: false },
      ],
    });
  });
  it('caps at 50 questions and ignores malformed entries', () => {
    const many = Array.from({ length: 60 }, (_, i) => ans(i, i % 2 === 0));
    expect(buildAnalysisInput({ title: 'Big', duration_seconds: 0, answers: [...many, { junk: true }] }).questions).toHaveLength(50);
  });
});

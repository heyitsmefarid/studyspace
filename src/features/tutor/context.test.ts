import { describe, expect, it } from 'vitest';
import { formatAttemptContext, formatDeckContext, formatPlanContext, formatQuizContext, parseContextParam } from './context';

describe('tutor context', () => {
  it('parses context params safely', () => {
    expect(parseContextParam('note:123e4567-e89b-12d3-a456-426614174000')).toEqual({ type: 'note', id: '123e4567-e89b-12d3-a456-426614174000' });
    expect(parseContextParam('evil:1')).toBeNull();
    expect(parseContextParam('note:not-a-uuid')).toBeNull();
    expect(parseContextParam(null)).toBeNull();
  });
  it('formats a deck as Q/A lines', () => {
    expect(formatDeckContext('Cells', [{ front: 'What is ATP?', back: 'Energy', type: 'qa', correct_answer: null }, { front: 'Sky is green', back: '', type: 'tf', correct_answer: 'False' }]))
      .toEqual({ title: 'Cells', text: 'Flashcard deck "Cells" (2 cards)\n\nQ: What is ATP?\nA: Energy\n\nQ: Sky is green\nA: False' });
  });
  it('formats a quiz with options and answers', () => {
    expect(formatQuizContext('Bio quiz', [{ question: '2+2?', options: ['3', '4'], correctAnswer: '4', explanation: 'Math' }]).text)
      .toBe('Quiz "Bio quiz" (1 questions)\n\n1. 2+2?\n   Options: 3 | 4\n   Answer: 4 — Math');
  });
  it('formats an attempt highlighting mistakes', () => {
    const text = formatAttemptContext('Bio quiz', 1, 2, [
      { question: { question: 'Q1', correctAnswer: 'A', topic: 'T' }, chosen: 'A', correct: true },
      { question: { question: 'Q2', correctAnswer: 'B', topic: 'T' }, chosen: 'C', correct: false },
    ]).text;
    expect(text).toContain('Score: 1/2');
    expect(text).toContain('✗ Q2 — answered "C", correct "B"');
  });
  it('formats a plan as dated lines', () => {
    expect(formatPlanContext('Bio plan', '2026-10-20', [{ date: '2026-10-07', startTime: '19:00', topic: 'Cells', durationMinutes: 45, activity: 'learn' }]).text)
      .toBe('Study plan "Bio plan" — exam on 2026-10-20\n\n2026-10-07 19:00 · learn · Cells (45 min)');
  });
});

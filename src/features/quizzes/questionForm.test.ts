import { describe, expect, it } from 'vitest';
import { validateQuestion } from './questionForm';

describe('validateQuestion', () => {
  it('accepts a valid MCQ and TF', () => {
    expect(validateQuestion({ type: 'mcq', question: 'Q?', options: ['a', 'b', 'c'], correct_answer: 'b' }).ok).toBe(true);
    expect(validateQuestion({ type: 'tf', question: 'Q?', correct_answer: 'True' }).ok).toBe(true);
  });
  it('rejects duplicate options and a correct answer outside the options', () => {
    const r = validateQuestion({ type: 'mcq', question: 'Q?', options: ['a', 'A'], correct_answer: 'z' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(expect.arrayContaining(['options', 'correct_answer']));
  });
});

import { describe, expect, it } from 'vitest';
import { validateCard } from './cardForm';

describe('validateCard', () => {
  it('accepts a Q/A card', () => {
    expect(validateCard({ type: 'qa', front: 'What is ATP?', back: 'Energy currency' }).ok).toBe(true);
  });
  it('requires 2–6 unique options and a correct answer among them for MCQ', () => {
    const bad = validateCard({ type: 'mcq', front: 'Q', back: '', options: ['A', 'a ', ''], correct_answer: 'C' });
    expect(bad.ok).toBe(false);
    const good = validateCard({ type: 'mcq', front: 'Q', back: '', options: ['Mitochondria', 'Ribosome'], correct_answer: 'Mitochondria' });
    expect(good.ok && good.value.options).toEqual(['Mitochondria', 'Ribosome']);
  });
  it('requires True/False for TF cards', () => {
    expect(validateCard({ type: 'tf', front: 'The sky is green', back: '', correct_answer: 'False' }).ok).toBe(true);
    expect(validateCard({ type: 'tf', front: 'x', back: '', correct_answer: 'maybe' }).ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { buildDeckQuiz, type DeckCardLike } from './deckQuiz';
import { mulberry32 } from '@/lib/random';

const qa = (id: string, back: string): DeckCardLike => ({ id, type: 'qa', front: `front ${id}`, back, options: null, correct_answer: null, topic: 'T', difficulty: null });

describe('buildDeckQuiz', () => {
  it('needs at least 4 cards', () => {
    expect(buildDeckQuiz([qa('1', 'a'), qa('2', 'b'), qa('3', 'c')], mulberry32(1))).toEqual({ ok: false, reason: 'NOT_ENOUGH_CARDS' });
  });
  it('turns Q/A cards into MCQs with unique distractors from other answers', () => {
    const r = buildDeckQuiz([qa('1', 'Mitochondria'), qa('2', 'Ribosome'), qa('3', 'ribosome '), qa('4', 'Nucleus'), qa('5', 'Golgi')], mulberry32(4));
    if (!r.ok) throw new Error('expected ok');
    const first = r.questions.find((x) => x.id === '1')!;
    expect(first.type).toBe('mcq');
    expect(first.options).toContain('Mitochondria');
    expect(new Set(first.options.map((o) => o.trim().toLowerCase())).size).toBe(first.options.length);
    expect(first.options.length).toBe(4);
    expect(first.correctAnswer).toBe('Mitochondria');
  });
  it('keeps TF and MCQ cards as-is', () => {
    const cards: DeckCardLike[] = [
      qa('1', 'a'), qa('2', 'b'), qa('3', 'c'),
      { id: 'tf', type: 'tf', front: 'Sky is green', back: '', options: ['True', 'False'], correct_answer: 'False', topic: null, difficulty: null },
      { id: 'mc', type: 'mcq', front: 'Pick B', back: 'because', options: ['A', 'B'], correct_answer: 'B', topic: null, difficulty: 'easy' },
    ];
    const r = buildDeckQuiz(cards, mulberry32(2));
    if (!r.ok) throw new Error('expected ok');
    expect(r.questions.find((x) => x.id === 'tf')).toMatchObject({ type: 'tf', options: ['True', 'False'], correctAnswer: 'False' });
    expect(r.questions.find((x) => x.id === 'mc')).toMatchObject({ type: 'mcq', correctAnswer: 'B', explanation: 'because' });
  });
});

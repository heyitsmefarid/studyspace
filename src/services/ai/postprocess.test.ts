import { describe, expect, it } from 'vitest';
import {
  finalizeAnalysis, finalizeFlashcards, finalizePlan, finalizeQuiz, finalizeRecommendations, finalizeText,
  parseJsonLoose, snapAnswer, stripOptionLetters,
} from './postprocess';
import { FlashcardsInputSchema, QuizInputSchema, RecommendationsInputSchema, StudyPlanInputSchema } from './schemas';

describe('parseJsonLoose', () => {
  it('reads plain, fenced and prose-wrapped JSON', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('Here you go:\n{"a":{"b":2}}\nEnjoy!')).toEqual({ a: { b: 2 } });
    expect(parseJsonLoose('no json here')).toBeUndefined();
  });
});

describe('quiz answers', () => {
  it('snaps letter and case variants to the matching option', () => {
    const opts = ['Berlin', 'Paris', 'Rome', 'Madrid'];
    expect(snapAnswer('B', opts)).toBe('Paris');
    expect(snapAnswer('(c)', opts)).toBe('Rome');
    expect(snapAnswer(' paris ', opts)).toBe('Paris');
    expect(snapAnswer('D. Madrid', opts)).toBe('Madrid');
    expect(snapAnswer('Lisbon', opts)).toBeNull();
  });
  it('strips letter prefixes only when every option has one', () => {
    expect(stripOptionLetters(['A) Berlin', 'B) Paris'])).toEqual(['Berlin', 'Paris']);
    expect(stripOptionLetters(['A. 1', 'B. 2', 'C. 3'])).toEqual(['1', '2', '3']);
    expect(stripOptionLetters(['A cell', 'B cells'])).toEqual(['A cell', 'B cells']);
  });
});

const quizInput = (over = {}) => QuizInputSchema.parse({ text: 'x', count: 10, ...over });

describe('finalizeQuiz', () => {
  it('normalises letters, case, TF variants and boolean answers', () => {
    const r = finalizeQuiz({ questions: [
      { type: 'mcq', question: 'Capital of France?', options: ['A) Berlin', 'B) Paris', 'C) Rome', 'D) Madrid'], correctAnswer: 'B', explanation: 'Paris.', difficulty: 'Easy', topic: 'Geo' },
      { type: 'MCQ', question: 'What is 2+2?', options: ['3', '4', '5'], correctAnswer: ' 4 ' },
      { type: 'true_false', question: 'Water boils at 100°C at sea level.', correctAnswer: true },
    ] }, quizInput());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.questions[0]).toMatchObject({ options: ['Berlin', 'Paris', 'Rome', 'Madrid'], correctAnswer: 'Paris', difficulty: 'easy' });
    expect(r.data.questions[1]).toMatchObject({ correctAnswer: '4', topic: 'General', difficulty: 'medium' });
    expect(r.data.questions[2]).toMatchObject({ type: 'tf', options: ['True', 'False'], correctAnswer: 'True' });
  });
  it('accepts choices/answer/correctIndex aliases', () => {
    const r = finalizeQuiz({ questions: [{ question: 'Pick two', choices: ['one', 'two', 'three'], correctIndex: 1 }] }, quizInput());
    expect(r.ok && r.data.questions[0]!.correctAnswer).toBe('two');
  });
  it('drops questions with an answer outside the options and dedupes options and questions', () => {
    const r = finalizeQuiz({ questions: [
      { type: 'mcq', question: 'Q1 about cells?', options: ['a', 'b'], correctAnswer: 'z' },
      { type: 'mcq', question: 'What powers the cell?', options: ['ATP', 'atp', 'DNA'], correctAnswer: 'ATP' },
      { type: 'mcq', question: 'What powers the cell!', options: ['ATP', 'DNA'], correctAnswer: 'ATP' },
    ] }, quizInput());
    expect(r.ok && r.data.questions).toHaveLength(1);
    expect(r.ok && r.data.questions[0]!.options).toEqual(['ATP', 'DNA']);
  });
  it('filters disallowed types and caps the count', () => {
    const words = ['osmosis', 'diffusion', 'mitosis', 'meiosis', 'respiration', 'photosynthesis', 'transcription', 'translation'];
    const qs = words.map((w) => ({ type: 'mcq', question: `What drives ${w} in living cells?`, options: ['x', 'y'], correctAnswer: 'x' }));
    const r = finalizeQuiz({ questions: [{ type: 'tf', question: 'Sky is blue', correctAnswer: 'True' }, ...qs] }, quizInput({ count: 5, types: ['mcq'] }));
    expect(r.ok && r.data.questions.map((q) => q.type)).toEqual(['mcq', 'mcq', 'mcq', 'mcq', 'mcq']);
  });
  it('is invalid when nothing is usable and empty when the list is empty', () => {
    expect(finalizeQuiz({ questions: [{ foo: 1 }] }, quizInput())).toMatchObject({ ok: false, reason: 'invalid' });
    expect(finalizeQuiz({ questions: [] }, quizInput())).toMatchObject({ ok: false, reason: 'empty' });
    expect(finalizeQuiz('nope', quizInput())).toMatchObject({ ok: false, reason: 'invalid' });
  });
});

describe('finalizeFlashcards', () => {
  // count below the schema minimum on purpose, to prove the cap is applied after cleanup
  const input = { ...FlashcardsInputSchema.parse({ text: 'x', existing: ['What is ATP?'] }), count: 3 };
  it('accepts aliases, normalises fields, dedupes against existing and itself, caps count', () => {
    const r = finalizeFlashcards({ flashcards: [
      { front: 'What is ATP?!', back: 'Energy' },
      { question: 'Why do cells need energy?', answer: 'To do work.', difficulty: 'Hard' },
      { question: 'why do cells need energy', answer: 'dup' },
      { question: 'How is ATP made?', answer: 'Respiration.', topic: 'Respiration' },
      { question: 'What stores genetic info?', answer: 'DNA.' },
      { question: 'Extra card beyond the cap?', answer: 'x' },
    ] }, input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.cards.map((c) => c.question)).toEqual(['Why do cells need energy?', 'How is ATP made?', 'What stores genetic info?']);
    expect(r.data.cards[0]).toMatchObject({ difficulty: 'hard', topic: 'General' });
  });
  it('is empty when every card was a duplicate', () => {
    expect(finalizeFlashcards({ cards: [{ question: 'What is ATP?', answer: 'x' }] }, input)).toMatchObject({ ok: false, reason: 'empty' });
  });
});

describe('finalizePlan', () => {
  const input = StudyPlanInputSchema.parse({ subject: 'Bio', today: '2026-10-06', examDate: '2026-10-10', topics: [{ name: 'Cells', confidence: 2 }], hoursPerDay: 1, preferredTimes: ['evening'] });
  it('drops out-of-range dates, clamps durations, trims daily overflow by priority and sorts', () => {
    const r = finalizePlan({ summary: 'Plan', sessions: [
      { date: '2026-10-05', topic: 'Too early', durationMinutes: 30, activity: 'learn', priority: 'high' },
      { date: '2026-10-11', topic: 'Too late', durationMinutes: 30, activity: 'learn', priority: 'high' },
      { date: '2026-10-07', startTime: '19:00', topic: 'Low', durationMinutes: 40, activity: 'review', priority: 'low' },
      { date: '2026-10-07', startTime: '18:00', topic: 'High', durationMinutes: 40, activity: 'learn', priority: 'high' },
      { date: '2026-10-06', startTime: '20:00', topic: 'Short', durationMinutes: 5, activity: 'flashcards', priority: 'medium' },
      { date: '2026-10-08', topic: 'Long', durationMinutes: 300, activity: 'Mock Exam', priority: 'HIGH' },
    ] }, input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.sessions.map((s) => [s.date, s.topic, s.durationMinutes])).toEqual([
      ['2026-10-06', 'Short', 15], ['2026-10-07', 'High', 40], ['2026-10-08', 'Long', 60],
    ]);
    expect(r.data.sessions[2]!.activity).toBe('mock exam');
    expect(r.data.trimmed).toBe(1);
  });
});

describe('finalizeAnalysis & finalizeRecommendations & finalizeText', () => {
  it('tolerates missing fields and caps lists', () => {
    const r = finalizeAnalysis({ weakTopics: Array.from({ length: 12 }, (_, i) => ({ topic: `T${i}`, reason: 'r' })), encouragement: 'Nice work on cells.' });
    expect(r.ok && r.data.weakTopics).toHaveLength(8);
    expect(r.ok && r.data.nextSession).toBeNull();
    expect(finalizeAnalysis(42)).toMatchObject({ ok: false, reason: 'invalid' });
  });
  it('keeps only known target ids and action types, max 4', () => {
    const input = RecommendationsInputSchema.parse({ today: '2026-10-06', dueCards: 3, studyMinutesThisWeek: 0, streak: 0,
      decks: [{ id: 'd1', title: 'Bio', masteryPct: 10, due: 3 }], quizzes: [], notes: [], weakTopics: [], upcomingExams: [] });
    const r = finalizeRecommendations({ items: [
      { title: 'Review Bio', reason: '3 due', action: { type: 'review_deck', targetId: 'd1' } },
      { title: 'Review ghost', reason: '', action: { type: 'review_deck', targetId: 'nope' } },
      { title: 'Dance', reason: '', action: { type: 'dance' } },
      { title: 'Start', reason: '', action: { type: 'start_session' } },
      { title: 'Plan', reason: '', action: { type: 'plan_exam' } },
      { title: 'Extra', reason: '', action: { type: 'start_session' } },
    ] }, input);
    expect(r.ok && r.data.items.map((i) => [i.title, i.action.targetId])).toEqual([
      ['Review Bio', 'd1'], ['Review ghost', undefined], ['Start', undefined], ['Plan', undefined],
    ]);
  });
  it('strips markdown fences from text and reports empty text', () => {
    expect(finalizeText('```markdown\n# Hi\n```')).toEqual({ ok: true, data: { text: '# Hi' } });
    expect(finalizeText('   ')).toMatchObject({ ok: false, reason: 'empty' });
  });
});

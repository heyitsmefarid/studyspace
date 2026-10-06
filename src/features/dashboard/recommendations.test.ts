import { describe, expect, it } from 'vitest';
import { buildRecommendationsInput, routeForAction } from './recommendations';
import { RecommendationsInputSchema } from '@/services/ai/schemas';

describe('recommendations', () => {
  it('builds a valid, size-capped input', () => {
    const input = buildRecommendationsInput({
      today: '2026-10-06', streak: 3, minutesThisWeek: 120,
      decks: Array.from({ length: 15 }, (_, i) => ({ id: `d${i}`, title: `Deck ${i}`, masteryPct: i, due: i })),
      quizzes: [{ id: 'q1', title: 'Quiz' }], notes: [{ id: 'n1', title: 'Note' }],
      weakTopics: [{ topic: 'Cells', subjectName: 'Biology' }],
      exams: [{ id: 't1', title: 'Bio exam', date: '2026-10-10', subjectName: 'Biology' }],
    });
    expect(RecommendationsInputSchema.safeParse(input).success).toBe(true);
    expect(input.decks).toHaveLength(10);
    expect(input.decks[0]!.due).toBe(14);
    expect(input.dueCards).toBe(105);
  });
  it('maps actions to routes with sensible fallbacks', () => {
    expect(routeForAction({ type: 'review_deck', targetId: 'd1' })).toBe('/decks/d1/study');
    expect(routeForAction({ type: 'review_deck' })).toBe('/decks');
    expect(routeForAction({ type: 'take_quiz', targetId: 'q1' })).toBe('/quizzes/q1/take?mode=practice');
    expect(routeForAction({ type: 'open_note', targetId: 'n1' })).toBe('/notes/n1');
    expect(routeForAction({ type: 'plan_exam', targetId: 't1' })).toBe('/planner/ai');
    expect(routeForAction({ type: 'start_session' })).toBe('/study');
  });
});

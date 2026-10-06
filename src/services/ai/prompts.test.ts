import { describe, expect, it } from 'vitest';
import { buildFlashcardsPrompt, buildPlanPrompt, buildQuizPrompt, buildSourcePrompt, buildTutorPrompt, SUMMARY_SYSTEM_PROMPT, TUTOR_MODE_PROMPTS } from './prompts';
import { FlashcardsInputSchema, QuizInputSchema, StudyPlanInputSchema, TutorInputSchema } from './schemas';

describe('prompts', () => {
  it('every system prompt forbids fabricated sources', () => {
    expect(SUMMARY_SYSTEM_PROMPT).toMatch(/never invent sources/i);
  });
  it('tutor prompt layers mode, level and context material', () => {
    const p = buildTutorPrompt(TutorInputSchema.parse({
      mode: 'quiz_me', difficulty: 'beginner',
      messages: [{ role: 'user', content: 'Quiz me' }],
      context: { type: 'note', title: 'Cells', text: 'Mitochondria make ATP.' },
    }));
    expect(p.system).toContain(TUTOR_MODE_PROMPTS.quiz_me);
    expect(p.system).toMatch(/Beginner/);
    expect(p.system).toContain('<material>\nMitochondria make ATP.\n</material>');
    expect(p.messages).toEqual([{ role: 'user', content: 'Quiz me' }]);
  });
  it('source prompts wrap the notes in <material> and pass extra instructions', () => {
    const p = buildSourcePrompt(SUMMARY_SYSTEM_PROMPT, { text: 'Notes', title: 'Bio', subject: 'Biology' });
    expect(p.messages[0]!.content).toBe('Title: Bio\nSubject: Biology\n<material>\nNotes\n</material>');
  });
  it('flashcard prompt lists the count and existing questions', () => {
    const p = buildFlashcardsPrompt(FlashcardsInputSchema.parse({ text: 'x', count: 7, existing: ['What is ATP?'] }));
    expect(p.messages[0]!.content).toMatch(/Make 7 flashcards/);
    expect(p.messages[0]!.content).toContain('- What is ATP?');
  });
  it('quiz prompt states allowed types and difficulty', () => {
    const p = buildQuizPrompt(QuizInputSchema.parse({ text: 'x', count: 5, types: ['mcq'], difficulty: 'hard' }));
    expect(p.messages[0]!.content).toMatch(/Write 5 questions\. Allowed types: mcq\. Difficulty: hard/);
  });
  it('plan prompt includes the dates and hours', () => {
    const p = buildPlanPrompt(StudyPlanInputSchema.parse({ subject: 'Bio', today: '2026-10-06', examDate: '2026-10-20', topics: [{ name: 'Cells', confidence: 2 }], hoursPerDay: 2, preferredTimes: ['evening'] }));
    expect(p.messages[0]!.content).toContain('"examDate": "2026-10-20"');
    expect(p.messages[0]!.content).toContain('"hoursPerDay": 2');
  });
});

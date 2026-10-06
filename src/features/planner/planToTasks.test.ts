import { describe, expect, it } from 'vitest';
import { planToTasks } from './planToTasks';

const plan = {
  summary: 's', trimmed: 0,
  sessions: [
    { date: '2026-10-07', startTime: '18:30', topic: 'Cells', durationMinutes: 45, activity: 'learn' as const, priority: 'high' as const },
    { date: '2026-10-08', startTime: null, topic: 'Energy', durationMinutes: 30, activity: 'practice quiz' as const, priority: 'medium' as const, notes: 'Timed' },
  ],
};

describe('planToTasks', () => {
  it('creates study-session tasks with defaults and an exam task', () => {
    const rows = planToTasks({ plan, ownerId: 'u', subjectId: 's1', subjectName: 'Biology', examDate: '2026-10-10', planId: 'p1', preferredTime: 'evening', examTaskExists: false });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ title: 'Learn: Cells', kind: 'study_session', duration_minutes: 45, priority: 'high', source: 'ai_plan', plan_id: 'p1', subject_id: 's1' });
    expect(new Date(rows[0]!.start_at!).getHours()).toBe(18);
    expect(new Date(rows[1]!.start_at!).getHours()).toBe(19);
    expect(rows[1]).toMatchObject({ title: 'Practice quiz: Energy', description: 'Timed' });
    expect(rows[2]).toMatchObject({ title: 'Biology exam', kind: 'exam', all_day: true, priority: 'high' });
  });
  it('skips the exam task when one already exists', () => {
    expect(planToTasks({ plan, ownerId: 'u', subjectId: null, subjectName: 'Bio', examDate: '2026-10-10', planId: 'p', preferredTime: 'morning', examTaskExists: true })).toHaveLength(2);
  });
});

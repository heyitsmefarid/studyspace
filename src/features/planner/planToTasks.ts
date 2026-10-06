import type { TablesInsert } from '@/lib/supabase';
import type { PlanResult } from '@/services/ai/schemas';

export const PREFERRED_START = { morning: '09:00', afternoon: '14:00', evening: '19:00', night: '21:30' } as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function planToTasks(a: {
  plan: PlanResult; ownerId: string; subjectId: string | null; subjectName: string; examDate: string; planId: string;
  preferredTime: keyof typeof PREFERRED_START; examTaskExists: boolean;
}): TablesInsert<'tasks'>[] {
  const rows: TablesInsert<'tasks'>[] = a.plan.sessions.map((s) => ({
    owner_id: a.ownerId,
    title: `${cap(s.activity)}: ${s.topic}`.slice(0, 200),
    description: s.notes ?? '',
    kind: 'study_session',
    subject_id: a.subjectId,
    start_at: new Date(`${s.date}T${s.startTime ?? PREFERRED_START[a.preferredTime]}:00`).toISOString(),
    due_at: null,
    duration_minutes: s.durationMinutes,
    all_day: false,
    priority: s.priority,
    recurrence: 'none',
    source: 'ai_plan',
    plan_id: a.planId,
  }));
  if (!a.examTaskExists) {
    rows.push({
      owner_id: a.ownerId, title: `${a.subjectName} exam`.slice(0, 200), description: '', kind: 'exam', subject_id: a.subjectId,
      due_at: new Date(`${a.examDate}T00:00:00`).toISOString(), start_at: null, all_day: true, priority: 'high',
      recurrence: 'none', source: 'ai_plan', plan_id: a.planId,
    });
  }
  return rows;
}

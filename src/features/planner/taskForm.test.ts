import { describe, expect, it } from 'vitest';
import { toTaskRow, TaskFormSchema } from './taskForm';

describe('toTaskRow', () => {
  it('stores study sessions as start_at + duration', () => {
    const row = toTaskRow(TaskFormSchema.parse({ title: 'Review cells', kind: 'study_session', date: '2026-10-07', time: '19:00', duration_minutes: 45 }), 'u1');
    expect(row).toMatchObject({ owner_id: 'u1', kind: 'study_session', due_at: null, all_day: false, duration_minutes: 45 });
    expect(new Date(row.start_at!).getHours()).toBe(19);
  });
  it('makes undated-time deadlines all-day at local midnight', () => {
    const row = toTaskRow(TaskFormSchema.parse({ title: 'Essay', kind: 'assignment', date: '2026-10-09' }), 'u1');
    expect(row.all_day).toBe(true);
    const d = new Date(row.due_at!);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 9, 0]);
  });
  it('keeps recurrence and leaves dateless tasks undated', () => {
    expect(toTaskRow(TaskFormSchema.parse({ title: 'Gym', kind: 'task', date: '2026-10-06', time: '07:00', recurrence: 'weekdays', recurrence_until: '2026-12-01' }), 'u1'))
      .toMatchObject({ recurrence: 'weekdays', recurrence_until: '2026-12-01' });
    expect(toTaskRow(TaskFormSchema.parse({ title: 'Someday' }), 'u1')).toMatchObject({ due_at: null, start_at: null, recurrence: 'none' });
  });
  it('rejects an end date before the start and missing titles', () => {
    expect(TaskFormSchema.safeParse({ title: '', kind: 'task' }).success).toBe(false);
    expect(TaskFormSchema.safeParse({ title: 'x', date: '2026-10-09', recurrence: 'daily', recurrence_until: '2026-10-01' }).success).toBe(false);
  });
});

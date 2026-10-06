import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import type { Tables, TablesInsert } from '@/lib/supabase';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const TASK_KINDS = ['task', 'assignment', 'exam', 'deadline', 'study_session'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const TaskFormSchema = z.object({
  title: z.string().trim().min(1, 'Give it a title').max(200),
  description: z.string().trim().max(2000).default(''),
  kind: z.enum(TASK_KINDS).default('task'),
  subject_id: z.string().nullable().default(null),
  date: date.optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  duration_minutes: z.number().int().min(5).max(720).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  recurrence: z.enum(['none', 'daily', 'weekdays', 'weekly', 'monthly']).default('none'),
  recurrence_until: date.nullable().default(null),
  is_shared: z.boolean().default(false),
}).refine((f) => f.recurrence === 'none' || Boolean(f.date), { message: 'Repeating tasks need a date', path: ['date'] })
  .refine((f) => !f.recurrence_until || !f.date || f.recurrence_until >= f.date, { message: 'The end date must be after the start', path: ['recurrence_until'] });

export type TaskForm = z.output<typeof TaskFormSchema>;

const localIso = (d: string, t: string) => new Date(`${d}T${t}:00`).toISOString();

export function toTaskRow(f: TaskForm, ownerId: string): TablesInsert<'tasks'> {
  const isSession = f.kind === 'study_session';
  const allDay = Boolean(f.date) && !f.time;
  const at = f.date ? localIso(f.date, f.time ?? '00:00') : null;
  return {
    owner_id: ownerId, title: f.title, description: f.description, kind: f.kind, subject_id: f.subject_id,
    priority: f.priority, recurrence: f.recurrence, recurrence_until: f.recurrence_until, is_shared: f.is_shared,
    all_day: allDay,
    start_at: isSession ? at : null,
    due_at: isSession ? null : at,
    duration_minutes: isSession ? f.duration_minutes ?? 45 : f.duration_minutes ?? null,
    source: 'manual',
  };
}

export function fromTaskRow(t: Tables<'tasks'>): TaskForm {
  const at = t.start_at ?? t.due_at;
  const d = at ? parseISO(at) : null;
  return {
    title: t.title, description: t.description, kind: t.kind as TaskForm['kind'], subject_id: t.subject_id,
    date: d ? format(d, 'yyyy-MM-dd') : undefined,
    time: d && !t.all_day ? format(d, 'HH:mm') : undefined,
    duration_minutes: t.duration_minutes ?? undefined, priority: t.priority as TaskForm['priority'],
    recurrence: t.recurrence as TaskForm['recurrence'], recurrence_until: t.recurrence_until, is_shared: t.is_shared,
  };
}

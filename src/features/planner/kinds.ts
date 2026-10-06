import { BookOpen, CalendarClock, CheckSquare, FileText, GraduationCap, type LucideIcon } from 'lucide-react';
import type { TaskKind } from './taskForm';

export const KIND_META: Record<TaskKind, { label: string; icon: LucideIcon; className: string; dot: string }> = {
  task: { label: 'Task', icon: CheckSquare, className: 'bg-primary-soft text-primary', dot: 'bg-primary' },
  assignment: { label: 'Assignment', icon: FileText, className: 'bg-teal-soft text-teal', dot: 'bg-teal' },
  exam: { label: 'Exam', icon: GraduationCap, className: 'bg-coral-soft text-coral', dot: 'bg-coral' },
  deadline: { label: 'Deadline', icon: CalendarClock, className: 'bg-gold-soft text-gold', dot: 'bg-gold' },
  study_session: { label: 'Study session', icon: BookOpen, className: 'bg-surface-2 text-star-me', dot: 'bg-star-me' },
};

export const kindMeta = (kind: string) => KIND_META[kind as TaskKind] ?? KIND_META.task;

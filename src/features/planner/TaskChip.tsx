import { format } from 'date-fns';
import { Repeat } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Task } from './api';
import { kindMeta } from './kinds';
import { TASK_DRAG_TYPE } from './calendar';

/** A dated occurrence, or an undated ("someday") task with `at: null`. */
export interface ChipItem { task: Task; date: string | null; at: Date | null }

export function TaskChip({ occurrence, done, onToggle, onOpen, compact }: {
  occurrence: ChipItem; done: boolean; onToggle: (done: boolean) => void; onOpen: () => void; compact?: boolean;
}) {
  const { user, partner } = useAuth();
  const t = occurrence.task;
  const mine = t.owner_id === user?.id;
  const meta = kindMeta(t.kind);
  const Icon = meta.icon;
  const time = occurrence.at && !t.all_day ? format(occurrence.at, 'HH:mm') : null;
  const recurring = t.recurrence !== 'none';
  const canDrag = mine && !recurring;

  return (
    <div
      draggable={canDrag}
      onDragStart={canDrag ? (e) => { e.dataTransfer.setData(TASK_DRAG_TYPE, t.id); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('chip-dragging'); } : undefined}
      onDragEnd={canDrag ? (e) => e.currentTarget.classList.remove('chip-dragging') : undefined}
      className={cn(
        'flex min-w-0 animate-pop-in items-center rounded-lg transition-[opacity,translate,box-shadow] duration-200', meta.className, done && 'opacity-60',
        compact ? 'gap-1 px-1.5 py-0.5 text-xs' : 'gap-2 px-3 py-2 text-sm',
        canDrag && 'cursor-grab active:cursor-grabbing',
      )}
    >
      {mine ? (
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`Mark ${t.title} done`}
          className={cn('check-pop shrink-0 text-ink-faint', compact ? 'size-3.5' : 'size-4')}
        />
      ) : (
        <span
          title={`${partner?.display_name ?? 'Partner'}'s shared task`}
          className={cn('grid shrink-0 place-items-center rounded-full bg-star-partner font-bold text-primary-ink', compact ? 'size-3.5 text-[9px]' : 'size-5 text-[11px]')}
        >
          {(partner?.display_name ?? '?').charAt(0).toUpperCase()}
        </span>
      )}
      <button
        type="button"
        onClick={onOpen}
        disabled={!mine}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left disabled:cursor-default"
        title={t.title}
      >
        {!compact && <Icon className="size-4 shrink-0" aria-hidden />}
        {time && <span className="shrink-0 tabular opacity-80">{time}</span>}
        <span className={cn('truncate transition-opacity duration-300', done && 'line-through')}>{t.title}</span>
        {!compact && t.duration_minutes && t.kind === 'study_session' && <span className="shrink-0 text-xs opacity-70">{t.duration_minutes} min</span>}
      </button>
      {t.priority === 'high' && <span className="size-1.5 shrink-0 rounded-full bg-coral" role="img" aria-label="High priority" />}
      {recurring && <Repeat className="size-3 shrink-0 opacity-70" aria-label="Repeats" />}
    </div>
  );
}

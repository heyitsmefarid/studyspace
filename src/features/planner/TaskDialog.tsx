import { useState } from 'react';
import { Link } from 'react-router';
import { Play, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { useAuth } from '@/features/auth/AuthProvider';
import { SubjectPicker } from '@/features/subjects/SubjectPicker';
import { useCreateTask, useDeleteTask, useUpdateTask, type Task } from './api';
import { fromTaskRow, TASK_KINDS, TaskFormSchema, type TaskForm } from './taskForm';
import { KIND_META } from './kinds';

interface Draft {
  title: string; description: string; kind: TaskForm['kind']; subject_id: string | null; date: string; time: string;
  duration: string; priority: TaskForm['priority']; recurrence: TaskForm['recurrence']; recurrence_until: string; is_shared: boolean;
}

const REPEAT_LABELS: Record<TaskForm['recurrence'], string> = {
  none: "Doesn't repeat", daily: 'Every day', weekdays: 'Every weekday (Mon–Fri)', weekly: 'Every week', monthly: 'Every month',
};

function toDraft(f: Partial<TaskForm>, shareByDefault: boolean): Draft {
  return {
    title: f.title ?? '', description: f.description ?? '', kind: f.kind ?? 'task', subject_id: f.subject_id ?? null,
    date: f.date ?? '', time: f.time ?? '', duration: f.duration_minutes ? String(f.duration_minutes) : '',
    priority: f.priority ?? 'medium', recurrence: f.recurrence ?? 'none', recurrence_until: f.recurrence_until ?? '',
    is_shared: f.is_shared ?? shareByDefault,
  };
}

function TaskDialogBody({ onOpenChange, task, defaults }: { onOpenChange: (o: boolean) => void; task?: Task; defaults?: Partial<TaskForm> }) {
  const { partner, preferences } = useAuth();
  const create = useCreateTask();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const [d, setD] = useState<Draft>(() => toDraft(task ? fromTaskRow(task) : (defaults ?? {}), preferences.privacy.shareByDefault));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const isSession = d.kind === 'study_session';
  const repeating = d.recurrence !== 'none';

  async function save() {
    const parsed = TaskFormSchema.safeParse({
      title: d.title, description: d.description, kind: d.kind, subject_id: d.subject_id,
      date: d.date || undefined, time: d.time || undefined,
      duration_minutes: d.duration ? Number(d.duration) : (isSession ? 45 : undefined),
      priority: d.priority, recurrence: d.recurrence,
      recurrence_until: repeating && d.recurrence_until ? d.recurrence_until : null, is_shared: d.is_shared,
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0] ?? 'title'), i.message])));
      return;
    }
    setErrors({});
    if (task) await update.mutateAsync({ id: task.id, form: parsed.data });
    else await create.mutateAsync(parsed.data);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={onOpenChange}
        title={task ? 'Edit' : 'Add to your planner'}
        footer={(
          <>
            {task && (
              <Button variant="danger" className="mr-auto" onClick={() => setConfirm(true)}><Trash2 className="size-4" /> Delete</Button>
            )}
            {task && isSession && (
              <Link to={`/study?task=${task.id}`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-gold-soft px-4 text-sm font-semibold text-gold">
                <Play className="size-4" /> Start now
              </Link>
            )}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} loading={create.isPending || update.isPending}>{task ? 'Save' : 'Add'}</Button>
          </>
        )}
      >
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <div role="radiogroup" aria-label="Kind" className="grid grid-cols-5 gap-1 rounded-xl border border-line bg-surface-2 p-1">
            {TASK_KINDS.map((k) => {
              const m = KIND_META[k];
              const Icon = m.icon;
              const active = d.kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set('kind', k)}
                  className={cn('flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold text-ink-muted transition', active && m.className)}
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="leading-tight">{m.label}</span>
                </button>
              );
            })}
          </div>
          <Field label="Title" error={errors.title}>
            {(id) => <Input id={id} autoFocus maxLength={200} value={d.title} invalid={Boolean(errors.title)} onChange={(e) => set('title', e.target.value)} />}
          </Field>
          <Field label="Notes" error={errors.description}>
            {(id) => <Textarea id={id} maxLength={2000} value={d.description} onChange={(e) => set('description', e.target.value)} className="min-h-16" />}
          </Field>
          <div><p className="mb-1.5 text-sm font-medium">Subject</p><SubjectPicker value={d.subject_id} onChange={(v) => set('subject_id', v)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" error={errors.date}>
              {(id) => <Input id={id} type="date" value={d.date} invalid={Boolean(errors.date)} onChange={(e) => set('date', e.target.value)} />}
            </Field>
            <Field label="Time" hint={d.date && !d.time ? 'Empty = all day' : undefined}>
              {(id) => <Input id={id} type="time" value={d.time} disabled={!d.date} onChange={(e) => set('time', e.target.value)} />}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {isSession && (
              <Field label="Minutes" error={errors.duration_minutes}>
                {(id) => <Input id={id} type="number" inputMode="numeric" min={5} max={720} step={5} placeholder="45" value={d.duration} onChange={(e) => set('duration', e.target.value)} />}
              </Field>
            )}
            <Field label="Priority">
              {(id) => (
                <Select id={id} value={d.priority} onChange={(e) => set('priority', e.target.value as Draft['priority'])}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </Select>
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Repeat">
              {(id) => (
                <Select id={id} value={d.recurrence} onChange={(e) => set('recurrence', e.target.value as Draft['recurrence'])}>
                  {Object.entries(REPEAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              )}
            </Field>
            {repeating && (
              <Field label="Until (optional)" error={errors.recurrence_until}>
                {(id) => <Input id={id} type="date" min={d.date || undefined} value={d.recurrence_until} onChange={(e) => set('recurrence_until', e.target.value)} />}
              </Field>
            )}
          </div>
          <Switch label={`Share with ${partner?.display_name ?? 'your partner'}`} hint="They'll see it on their calendar (read-only)." checked={d.is_shared} onCheckedChange={(v) => set('is_shared', v)} />
          <button type="submit" hidden />
        </form>
      </Dialog>
      {task && (
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          danger
          title={`Delete “${task.title}”?`}
          body={task.recurrence !== 'none' ? 'Deletes every occurrence of this repeating item.' : 'This removes it from your planner.'}
          confirmLabel="Delete"
          onConfirm={async () => { await remove.mutateAsync(task.id); setConfirm(false); onOpenChange(false); }}
        />
      )}
    </>
  );
}

/** Add/edit dialog. The body mounts fresh each time it opens so its fields reflect `task`/`defaults`. */
export function TaskDialog({ open, onOpenChange, task, defaults }: {
  open: boolean; onOpenChange: (o: boolean) => void; task?: Task; defaults?: Partial<TaskForm>;
}) {
  if (!open) return null;
  return <TaskDialogBody key={task?.id ?? 'new'} onOpenChange={onOpenChange} task={task} defaults={defaults} />;
}

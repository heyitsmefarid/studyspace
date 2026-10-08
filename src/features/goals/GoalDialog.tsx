import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSaveGoal, type Goal } from './api';
import { GOAL_KINDS, GOAL_KIND_LABEL, validateGoal, type GoalKind } from './progress';

const TARGET_LABEL: Record<GoalKind, string> = {
  weekly_minutes: 'Target (minutes per week)', weekly_cards: 'Target (cards per week)', weekly_quizzes: 'Target (quizzes per week)', custom: 'Target',
};

export function GoalDialog({ open, onOpenChange, goal }: { open: boolean; onOpenChange: (o: boolean) => void; goal?: Goal }) {
  const { preferences } = useAuth();
  const save = useSaveGoal();
  const [form, setForm] = useState(() => goal
    ? { title: goal.title, kind: goal.kind, target: goal.target, is_shared: goal.is_shared, due_date: goal.due_date }
    : { title: '', kind: 'weekly_minutes', target: 300, is_shared: preferences.privacy.shareByDefault, due_date: null as string | null });
  const [errors, setErrors] = useState<Partial<Record<'title' | 'kind' | 'target', string>>>({});

  async function submit() {
    const v = validateGoal(form);
    if (!v.ok) { setErrors(v.errors); return; }
    await save.mutateAsync({ id: goal?.id, ...v.value });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={goal ? 'Edit goal' : 'New goal'}
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={save.isPending} onClick={() => void submit()}>Save goal</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Goal" error={errors.title}>
          {(id) => <Input id={id} maxLength={120} value={form.title} placeholder="Study 5 hours this week" invalid={Boolean(errors.title)} onChange={(e) => setForm({ ...form, title: e.target.value })} />}
        </Field>
        <Field label="Kind" error={errors.kind}>
          {(id) => (
            <Select id={id} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {GOAL_KINDS.map((k) => <option key={k} value={k}>{GOAL_KIND_LABEL[k]}</option>)}
            </Select>
          )}
        </Field>
        <Field label={TARGET_LABEL[form.kind as GoalKind] ?? 'Target'} error={errors.target}>
          {(id) => <Input id={id} type="number" min={1} step={1} inputMode="numeric" value={form.target} invalid={Boolean(errors.target)} onChange={(e) => setForm({ ...form, target: Number(e.target.value) })} />}
        </Field>
        {form.kind === 'custom' && (
          <Field label="Due date (optional)">
            {(id) => <Input id={id} type="date" value={form.due_date ?? ''} onChange={(e) => setForm({ ...form, due_date: e.target.value || null })} />}
          </Field>
        )}
        <Switch label="Shared goal" hint="Counts both of you and shows in Our Space." checked={form.is_shared} onCheckedChange={(v) => setForm({ ...form, is_shared: v })} />
      </div>
    </Dialog>
  );
}

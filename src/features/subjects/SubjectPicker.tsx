import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { useAuth } from '@/features/auth/AuthProvider';
import { SUBJECT_COLORS, nextSubjectColor } from './colors';
import { useCreateSubject, useSubjects } from './api';

const NEW = '__new__';

export function ColorSwatches({ value, onChange, colors = SUBJECT_COLORS }: { value: string; onChange: (c: string) => void; colors?: string[] }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value.toUpperCase() === c.toUpperCase()}
          aria-label={c}
          onClick={() => onChange(c)}
          className="grid size-9 place-items-center rounded-full border border-line aria-checked:border-ink"
        >
          <span className="size-5 rounded-full" style={{ background: c, boxShadow: `0 0 10px ${c}` }} />
        </button>
      ))}
    </div>
  );
}

export function NewSubjectDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (id: string) => void }) {
  const { user } = useAuth();
  const subjects = useSubjects();
  const create = useCreateSubject();
  const mine = (subjects.data ?? []).filter((s) => s.owner_id === user?.id);
  const [name, setName] = useState('');
  const [color, setColor] = useState(() => nextSubjectColor(mine.map((s) => s.color)));

  async function save() {
    if (!name.trim()) return;
    const s = await create.mutateAsync({ name, color });
    setName('');
    onOpenChange(false);
    onCreated?.(s.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New subject" size="sm"
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={create.isPending} onClick={save} disabled={!name.trim()}>Add subject</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Name">{(id) => <Input id={id} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
        <ColorSwatches value={color} onChange={setColor} />
      </div>
    </Dialog>
  );
}

export function SubjectPicker({ value, onChange, allowCreate = true, includePartner = false, label = 'Subject', className }: {
  value: string | null | undefined; onChange: (id: string | null) => void; allowCreate?: boolean; includePartner?: boolean; label?: string; className?: string;
}) {
  const { user } = useAuth();
  const subjects = useSubjects();
  const [creating, setCreating] = useState(false);
  const mine = (subjects.data ?? []).filter((s) => s.owner_id === user?.id);
  const theirs = (subjects.data ?? []).filter((s) => s.owner_id !== user?.id);

  return (
    <>
      <Select
        aria-label={label}
        className={className}
        value={value ?? ''}
        onChange={(e) => {
          if (e.target.value === NEW) setCreating(true);
          else onChange(e.target.value || null);
        }}
      >
        <option value="">No subject</option>
        {mine.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        {includePartner && theirs.length > 0 && (
          <optgroup label="Partner's subjects">{theirs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
        )}
        {allowCreate && <option value={NEW}>+ New subject…</option>}
      </Select>
      <NewSubjectDialog open={creating} onOpenChange={setCreating} onCreated={(id) => onChange(id)} />
    </>
  );
}

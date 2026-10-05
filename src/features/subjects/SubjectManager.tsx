import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { Menu } from '@/components/ui/Menu';
import { SUBJECT_COLORS } from './colors';
import { SubjectDot } from './SubjectDot';
import { NewSubjectDialog } from './SubjectPicker';
import { useDeleteSubject, useMySubjects, useUpdateSubject, type Subject } from './api';

function SubjectRow({ subject }: { subject: Subject }) {
  const update = useUpdateSubject();
  const remove = useDeleteSubject();
  const [name, setName] = useState(subject.name);
  const [confirm, setConfirm] = useState(false);

  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2">
      <Menu
        trigger={<button className="grid size-8 place-items-center rounded-lg hover:bg-surface" aria-label={`Change colour of ${subject.name}`}><SubjectDot color={subject.color} size={14} /></button>}
        items={SUBJECT_COLORS.map((c) => ({ label: c, onSelect: () => update.mutate({ id: subject.id, patch: { color: c } }) }))}
        align="start"
      />
      <Input
        aria-label="Subject name"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => { if (name.trim() && name.trim() !== subject.name) update.mutate({ id: subject.id, patch: { name: name.trim() } }); }}
        className="h-9 flex-1 border-transparent bg-transparent"
      />
      <Button variant="ghost" size="icon" aria-label={`Delete ${subject.name}`} onClick={() => setConfirm(true)}><Trash2 className="size-4" /></Button>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} danger title={`Delete ${subject.name}?`} confirmLabel="Delete"
        body="Notes, decks and quizzes keep their content but lose this label." onConfirm={() => remove.mutateAsync(subject.id)} />
    </li>
  );
}

export function SubjectManager() {
  const subjects = useMySubjects();
  const [adding, setAdding] = useState(false);
  if (subjects.isPending) return <Skeleton className="h-32" />;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {(subjects.data ?? []).map((s) => <SubjectRow key={s.id} subject={s} />)}
      </ul>
      {subjects.data?.length === 0 && <p className="text-sm text-ink-muted">No subjects yet.</p>}
      <Button variant="secondary" onClick={() => setAdding(true)} className="self-start"><Plus className="size-4" /> Add subject</Button>
      <NewSubjectDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

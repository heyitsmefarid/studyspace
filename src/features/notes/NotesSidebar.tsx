import { useState } from 'react';
import { Folder as FolderIcon, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Tabs } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Field';
import { Menu } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useMySubjects } from '@/features/subjects/api';
import { SubjectDot } from '@/features/subjects/SubjectDot';
import { useCreateFolder, useDeleteFolder, useFolders, useRenameFolder, type Folder } from './foldersApi';

export interface NotesView { scope: 'mine' | 'shared'; subject?: string; folder?: string; pinned?: boolean; fav?: boolean }

const row = (active: boolean) => cn('flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm',
  active ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-2 hover:text-ink');

function FolderRow({ folder, active, onSelect }: { folder: Folder; active: boolean; onSelect: () => void }) {
  const rename = useRenameFolder();
  const remove = useDeleteFolder();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="group flex items-center">
      {editing ? (
        <Input autoFocus value={name} maxLength={60} className="h-9" aria-label="Folder name"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { setEditing(false); if (name.trim() && name.trim() !== folder.name) rename.mutate({ id: folder.id, name }); }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      ) : (
        <button onClick={onSelect} className={row(active)}><FolderIcon className="size-4" aria-hidden /><span className="truncate">{folder.name}</span></button>
      )}
      <Menu
        trigger={<button className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-faint opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Actions for ${folder.name}`}><MoreHorizontal className="size-4" /></button>}
        items={[{ label: 'Rename', icon: Pencil, onSelect: () => setEditing(true) }, { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setConfirm(true) }]}
      />
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} danger title={`Delete “${folder.name}”?`} confirmLabel="Delete"
        body="Notes in it stay, just unfiled." onConfirm={() => remove.mutateAsync(folder.id)} />
    </li>
  );
}

export function NotesSidebar({ view, onChange, counts }: { view: NotesView; onChange: (v: NotesView) => void; counts: Map<string, number> }) {
  const subjects = useMySubjects();
  const folders = useFolders();
  const create = useCreateFolder();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <Tabs label="Whose notes" value={view.scope} onValueChange={(scope) => onChange({ scope })}
        items={[{ value: 'mine', label: 'Mine' }, { value: 'shared', label: 'Shared with me' }]} className="w-full" />
      <div className="mt-4 flex flex-col gap-1">
        <button className={row(Boolean(view.pinned))} onClick={() => onChange({ ...view, pinned: !view.pinned })}>Pinned</button>
        <button className={row(Boolean(view.fav))} onClick={() => onChange({ ...view, fav: !view.fav })}>Favourites</button>
      </div>
      {view.scope === 'mine' && (
        <>
          <h3 className="mb-1 mt-5 px-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Subjects</h3>
          <ul className="flex flex-col gap-0.5">
            {(subjects.data ?? []).map((s) => (
              <li key={s.id}>
                <button className={row(view.subject === s.id)} onClick={() => onChange({ ...view, subject: view.subject === s.id ? undefined : s.id })}>
                  <SubjectDot color={s.color} size={8} /><span className="flex-1 truncate">{s.name}</span>
                  <span className="text-xs tabular">{counts.get(s.id) ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
          <h3 className="mb-1 mt-5 px-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Folders</h3>
          <ul className="flex flex-col gap-0.5">
            {(folders.data ?? []).map((f) => (
              <FolderRow key={f.id} folder={f} active={view.folder === f.id} onSelect={() => onChange({ ...view, folder: view.folder === f.id ? undefined : f.id })} />
            ))}
          </ul>
          {adding ? (
            <Input autoFocus className="mt-1 h-9" placeholder="Folder name" value={name} maxLength={60} aria-label="New folder name"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => { setAdding(false); if (name.trim()) create.mutate({ name }); setName(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setName(''); setAdding(false); } }} />
          ) : (
            <button className={cn(row(false), 'mt-1')} onClick={() => setAdding(true)}><Plus className="size-4" /> New folder</button>
          )}
        </>
      )}
    </aside>
  );
}

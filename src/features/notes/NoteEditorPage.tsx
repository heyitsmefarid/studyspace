import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import type { JSONContent } from '@tiptap/react';
import { ArrowLeft, Copy, MoreHorizontal, Pin, Share2, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Menu } from '@/components/ui/Menu';
import { Select } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useHotkey } from '@/app/useHotkey';
import { useAuth } from '@/features/auth/AuthProvider';
import { SubjectPicker } from '@/features/subjects/SubjectPicker';
import { AskNovaButton } from '@/features/ai/AskNovaButton';
import { useCopyNote, useDeleteNote, useNote, useUpdateNote, type Note } from './api';
import { useFolders } from './foldersApi';
import { useAutosave } from './useAutosave';
import { NoteEditor, type NoteEditorHandle } from './editor/Editor';
import { AttachmentList } from './AttachmentList';
import type { SaveStatus } from './autosaver';

interface NoteDraft { title: string; content: JSONContent; content_text: string }

const STATUS: Record<SaveStatus, string> = { idle: '', pending: 'Unsaved…', saving: 'Saving…', saved: 'Saved ✓', error: "Couldn't save" };

function EditorBody({ note }: { note: Note }) {
  const { user, partner } = useAuth();
  const navigate = useNavigate();
  const update = useUpdateNote();
  const silentUpdate = useUpdateNote({ silent: true });
  const remove = useDeleteNote();
  const copy = useCopyNote();
  const folders = useFolders();
  const editorRef = useRef<NoteEditorHandle>(null);
  const editable = note.owner_id === user?.id;
  const [title, setTitle] = useState(note.title);
  const [confirm, setConfirm] = useState(false);
  const latest = useRef<NoteDraft>({ title: note.title, content: note.content as JSONContent, content_text: note.content_text });

  const save = useCallback(async (v: NoteDraft) => {
    await silentUpdate.mutateAsync({ id: note.id, patch: { title: v.title.slice(0, 200) || 'Untitled', content: v.content, content_text: v.content_text } });
  }, [note.id, silentUpdate]);
  const autosave = useAutosave(save);

  const push = (patch: Partial<NoteDraft>) => {
    latest.current = { ...latest.current, ...patch };
    autosave.push({ ...latest.current });
  };

  useHotkey('mod+s', () => { void autosave.flush().then(() => toast.success('Saved')); });

  const meta = (patch: Partial<Pick<Note, 'subject_id' | 'folder_id' | 'is_pinned' | 'is_favorite' | 'is_shared'>>) => update.mutate({ id: note.id, patch });

  return (
    <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link to="/notes" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="size-4" /> Notes</Link>
          <span className="flex-1" />
          <AskNovaButton context={{ type: 'note', id: note.id }} label="Ask Nova" size="sm" variant="ghost" />
          {editable && (
            <span role="status" className={cn('text-xs', autosave.status === 'error' ? 'text-coral' : 'text-ink-faint')}>
              {STATUS[autosave.status]}
              {autosave.status === 'error' && <button onClick={autosave.retry} className="ml-1 underline">Retry</button>}
            </span>
          )}
          {editable && (
            <Menu
              trigger={<Button variant="ghost" size="icon" aria-label="Note actions"><MoreHorizontal className="size-5" /></Button>}
              items={[
                { label: note.is_pinned ? 'Unpin' : 'Pin', icon: Pin, onSelect: () => meta({ is_pinned: !note.is_pinned }) },
                { label: note.is_favorite ? 'Remove favourite' : 'Favourite', icon: Star, onSelect: () => meta({ is_favorite: !note.is_favorite }) },
                { label: note.is_shared ? 'Stop sharing' : `Share with ${partner?.display_name ?? 'partner'}`, icon: Share2, onSelect: () => meta({ is_shared: !note.is_shared }) },
                { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setConfirm(true) },
              ]}
            />
          )}
        </div>

        {!editable && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary">
            <span>{partner?.display_name ?? 'Your partner'}'s shared note · read-only</span>
            <Button size="sm" loading={copy.isPending} onClick={async () => { const n = await copy.mutateAsync(note); navigate(`/notes/${n.id}`); }}>
              <Copy className="size-4" /> Copy to mine
            </Button>
          </div>
        )}

        <input
          aria-label="Note title"
          value={title}
          readOnly={!editable}
          maxLength={200}
          placeholder="Untitled"
          onChange={(e) => { setTitle(e.target.value); push({ title: e.target.value }); }}
          className="mb-3 w-full bg-transparent font-display text-2xl text-ink placeholder:text-ink-faint focus:outline-none md:text-3xl"
        />
        {editable && (
          <div className="mb-4 flex flex-wrap gap-2">
            <SubjectPicker value={note.subject_id} onChange={(id) => meta({ subject_id: id })} className="h-9 w-auto text-sm" />
            <Select aria-label="Folder" value={note.folder_id ?? ''} onChange={(e) => meta({ folder_id: e.target.value || null })} className="h-9 w-auto text-sm">
              <option value="">No folder</option>
              {(folders.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </div>
        )}

        <NoteEditor
          ref={editorRef}
          note={note}
          uid={user!.id}
          editable={editable}
          onChange={(v) => push(v)}
        />
        <AttachmentList noteId={note.id} editable={editable} />
      </div>
      <aside data-slot="note-ai" className="hidden lg:block" />
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} danger title="Delete this note?" confirmLabel="Delete"
        body="This removes the note and its attachments."
        onConfirm={async () => { await remove.mutateAsync(note.id); navigate('/notes'); }} />
    </div>
  );
}

export default function NoteEditorPage() {
  const { id } = useParams();
  const note = useNote(id);
  if (note.isPending) return <div className="flex flex-col gap-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-6 w-1/3" /><Skeleton className="h-96" /></div>;
  if (note.isError || !note.data) {
    return <EmptyState title="This note drifted away" body="It may have been deleted, or it isn't shared with you." action={<Link to="/notes" className="text-primary underline">Back to notes</Link>} />;
  }
  return <EditorBody key={note.data.id} note={note.data} />;
}

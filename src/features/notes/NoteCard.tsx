import { useState } from 'react';
import { Link } from 'react-router';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { MoreHorizontal, Pin, Share2, Star, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Menu } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/features/auth/AuthProvider';
import { subjectById, useSubjects } from '@/features/subjects/api';
import { SubjectDot } from '@/features/subjects/SubjectDot';
import type { NoteListItem } from './filters';
import { useDeleteNote, useUpdateNote } from './api';

export function NoteCard({ note }: { note: NoteListItem }) {
  const { user, partner } = useAuth();
  const subjects = useSubjects();
  const update = useUpdateNote();
  const remove = useDeleteNote();
  const [confirm, setConfirm] = useState(false);
  const mine = note.owner_id === user?.id;
  const subject = subjectById(subjects.data, note.subject_id);

  return (
    <Card interactive className="relative flex min-h-36 flex-col p-0">
      <Link to={`/notes/${note.id}`} className="flex flex-1 flex-col p-5 pr-12">
        <h3 className="line-clamp-2 font-display text-lg leading-snug">{note.title || 'Untitled'}</h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-ink-muted">{note.excerpt || 'Empty note'}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
          {subject && <span className="inline-flex items-center gap-1.5"><SubjectDot color={subject.color} size={8} />{subject.name}</span>}
          <span>{formatDistanceToNowStrict(parseISO(note.updated_at), { addSuffix: true })}</span>
          {note.is_pinned && <Pin className="size-3.5 text-gold" aria-label="Pinned" />}
          {note.is_favorite && <Star className="size-3.5 text-gold" aria-label="Favourite" />}
          {note.is_shared && mine && <Share2 className="size-3.5 text-teal" aria-label="Shared" />}
          {!mine && <Badge tone="primary">{partner?.display_name ?? 'Partner'}'s note</Badge>}
        </div>
      </Link>
      {mine && (
        <div className="absolute right-2 top-2">
          <Menu
            trigger={<button className="grid size-9 place-items-center rounded-lg text-ink-faint hover:bg-surface-2 hover:text-ink" aria-label={`Actions for ${note.title}`}><MoreHorizontal className="size-4" /></button>}
            items={[
              { label: note.is_pinned ? 'Unpin' : 'Pin', icon: Pin, onSelect: () => update.mutate({ id: note.id, patch: { is_pinned: !note.is_pinned } }) },
              { label: note.is_favorite ? 'Remove favourite' : 'Favourite', icon: Star, onSelect: () => update.mutate({ id: note.id, patch: { is_favorite: !note.is_favorite } }) },
              { label: note.is_shared ? 'Stop sharing' : `Share with ${partner?.display_name ?? 'partner'}`, icon: Share2, onSelect: () => update.mutate({ id: note.id, patch: { is_shared: !note.is_shared } }) },
              { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setConfirm(true) },
            ]}
          />
        </div>
      )}
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} danger title="Delete this note?" confirmLabel="Delete"
        body="This removes the note and its attachments. Decks made from it stay." onConfirm={() => remove.mutateAsync(note.id)} />
    </Card>
  );
}

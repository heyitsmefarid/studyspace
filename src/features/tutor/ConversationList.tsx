import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { MoreHorizontal, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Field';
import { Menu } from '@/components/ui/Menu';
import { Skeleton } from '@/components/ui/Skeleton';
import { useConversations, useDeleteConversation, useRenameConversation, type Conversation } from './api';
import { modeMeta } from './modes';

export function ConversationList({ activeId, onNavigate }: { activeId?: string; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const list = useConversations();
  const rename = useRenameConversation();
  const remove = useDeleteConversation();
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState<Conversation | null>(null);

  return (
    <nav aria-label="Conversations" className="flex flex-col gap-3">
      <Button variant="secondary" onClick={() => { navigate('/tutor'); onNavigate?.(); }}><Plus className="size-4" /> New conversation</Button>
      {list.isPending && [0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}
      {list.data?.length === 0 && <p className="px-2 text-sm text-ink-muted">Your chats with Nova will appear here.</p>}
      <ul className="stagger flex flex-col gap-1 [--stagger-step:30ms]">
        {(list.data ?? []).map((c) => {
          const Icon = modeMeta(c.mode).icon;
          const active = c.id === activeId;
          return (
            <li key={c.id} className={cn('group flex items-center rounded-xl', active ? 'bg-primary-soft' : 'hover:bg-surface-2')}>
              <Link to={`/tutor/${c.id}`} onClick={onNavigate} aria-current={active ? 'page' : undefined} className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2">
                <Icon className={cn('mt-0.5 size-4 shrink-0', active ? 'text-primary' : 'text-ink-muted')} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.title}</span>
                  <span className="flex items-center gap-1 text-xs text-ink-faint">
                    {c.context_title && <><Paperclip className="size-3 shrink-0" aria-label="With study material" /><span className="truncate">{c.context_title}</span> · </>}
                    <span className="shrink-0">{formatDistanceToNowStrict(parseISO(c.updated_at), { addSuffix: true })}</span>
                  </span>
                </span>
              </Link>
              <Menu
                trigger={<Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label={`Actions for ${c.title}`}><MoreHorizontal className="size-4" /></Button>}
                items={[
                  { label: 'Rename', icon: Pencil, onSelect: () => { setTitle(c.title); setRenaming(c); } },
                  { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setDeleting(c) },
                ]}
              />
            </li>
          );
        })}
      </ul>

      <Dialog open={renaming !== null} onOpenChange={(o) => { if (!o) setRenaming(null); }} title="Rename conversation" size="sm"
        footer={<><Button variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button>
          <Button loading={rename.isPending} disabled={!title.trim()} onClick={async () => { await rename.mutateAsync({ id: renaming!.id, title }); setRenaming(null); }}>Save</Button></>}>
        <Input aria-label="Title" autoFocus maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        danger
        title="Delete this conversation?"
        body="Its messages are removed for good."
        confirmLabel="Delete"
        onConfirm={async () => {
          const id = deleting!.id;
          await remove.mutateAsync(id);
          setDeleting(null);
          if (id === activeId) navigate('/tutor', { replace: true });
        }}
      />
    </nav>
  );
}

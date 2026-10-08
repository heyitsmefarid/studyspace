import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { MoreHorizontal, Paperclip, RotateCcw, SmilePlus, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { friendlyMessage } from '@/lib/errors';
import { opensInline } from '@/lib/storage';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Menu } from '@/components/ui/Menu';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAttachmentUrl, useDeleteMessage, useOutbox, useToggleReaction } from './api';
import { linkify } from './linkify';
import { ReactionBar } from './ReactionBar';
import { LONG_PRESS_MS, LONG_PRESS_SLOP_PX, movedBeyond } from './touch';
import type { ChatMessage } from './types';

function Text({ body }: { body: string }) {
  return (
    <p className="whitespace-pre-wrap break-words">
      {linkify(body).map((s, i) => (s.type === 'link'
        ? <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{s.text}</a>
        : <span key={i}>{s.text}</span>))}
    </p>
  );
}

function Attachment({ m }: { m: ChatMessage }) {
  const isImage = Boolean(m.attachment_mime?.startsWith('image/')) && opensInline(m.attachment_mime ?? '');
  const url = useAttachmentUrl(m.attachment_path, isImage ? undefined : m.attachment_name ?? 'file');
  if (!m.attachment_path) return <p className="flex items-center gap-2 text-sm"><Paperclip className="size-4" aria-hidden /> {m.attachment_name}</p>;
  if (isImage) {
    return url
      ? <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={m.attachment_name ?? 'Image'} className="max-h-64 rounded-xl object-cover" /></a>
      : <div className="h-40 w-56 animate-pulse rounded-xl bg-surface-2" />;
  }
  return (
    <a href={url} rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2 text-sm">
      <Paperclip className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0"><span className="block truncate font-semibold">{m.attachment_name}</span><span className="block text-xs opacity-75">{m.attachment_mime}</span></span>
    </a>
  );
}

export function MessageBubble({ m, highlight }: { m: ChatMessage; highlight?: boolean }) {
  const { user } = useAuth();
  const mine = m.sender_id === user?.id;
  const [reacting, setReacting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const press = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const outbox = useOutbox();
  const del = useDeleteMessage();
  const react = useToggleReaction();
  const deleted = Boolean(m.deleted_at);

  const pick = (emoji: string) => {
    setReacting(false);
    react.mutate({ messageId: m.id, emoji, mine: m.reactions.some((r) => r.user_id === user?.id && r.emoji === emoji) });
  };
  const copy = () => { void navigator.clipboard?.writeText(m.body); setReacting(false); toast('Copied'); };
  // long-press on touch opens the reaction bar (hover handles it on desktop)
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || deleted || m.pending) return;
    start.current = { x: e.clientX, y: e.clientY };
    press.current = window.setTimeout(() => setReacting(true), LONG_PRESS_MS);
  };
  const cancelPress = () => window.clearTimeout(press.current);
  const onPointerMove = (e: PointerEvent) => {
    if (start.current && movedBeyond(start.current, { x: e.clientX, y: e.clientY }, LONG_PRESS_SLOP_PX)) cancelPress();
  };
  useEffect(() => () => window.clearTimeout(press.current), []);

  // the open bar closes on Escape or a tap/click outside this message
  useEffect(() => {
    if (!reacting) return;
    const onDown = (e: globalThis.PointerEvent) => { if (!root.current?.contains(e.target as Node)) setReacting(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setReacting(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [reacting]);
  const counts = new Map<string, { n: number; mine: boolean }>();
  for (const r of m.reactions) {
    const c = counts.get(r.emoji) ?? { n: 0, mine: false };
    counts.set(r.emoji, { n: c.n + 1, mine: c.mine || r.user_id === user?.id });
  }

  return (
    <div ref={root} className={cn('group flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      <div className="relative flex max-w-[85%] items-center gap-1 sm:max-w-[70%]">
        {!deleted && !m.pending && (
          <div className={cn('hidden items-center gap-0.5 md:flex md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100', mine ? 'order-first' : 'order-last')}>
            <button onClick={() => setReacting((r) => !r)} className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-2 hover:text-ink" aria-label="React"><SmilePlus className="size-4" /></button>
            {mine && (
              <Menu trigger={<button className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-2 hover:text-ink" aria-label="Message options"><MoreHorizontal className="size-4" /></button>}
                items={[{ label: 'Delete', icon: Trash2, danger: true, onSelect: () => setConfirming(true) }]} />
            )}
          </div>
        )}
        <div
          onPointerDown={onPointerDown} onPointerUp={cancelPress} onPointerLeave={cancelPress} onPointerCancel={cancelPress} onPointerMove={onPointerMove}
          onContextMenu={(e) => { if (!deleted && !m.pending && (reacting || press.current !== undefined)) e.preventDefault(); }}
          className={cn('rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed [@media(hover:none)]:select-none [-webkit-touch-callout:none]',
            m.kind === 'star' && !deleted ? 'border border-gold/40 bg-gold-soft text-ink'
              : mine ? 'bg-[linear-gradient(135deg,var(--primary),var(--primary-2))] text-primary-ink' : 'border border-line bg-surface text-ink',
            m.pending === 'sending' && 'opacity-60', m.pending === 'failed' && 'ring-2 ring-coral',
            highlight && 'animate-pulse-once')}
        >
          {deleted ? <p className="italic opacity-80">message deleted</p> : (<>
            {m.kind === 'star' && <p className="mb-0.5 flex items-center gap-1 text-xs font-semibold text-gold"><Sparkles className="size-3.5" aria-hidden /> Shooting star</p>}
            {m.kind === 'file' && <Attachment m={m} />}
            {m.body && <Text body={m.body} />}
          </>)}
        </div>
        {reacting && <div className={cn('absolute -top-12 z-10', mine ? 'right-0' : 'left-0')}><ReactionBar onPick={pick} onCopy={!deleted && m.kind !== 'file' ? copy : undefined} onDelete={mine && !deleted && !m.pending ? () => { setReacting(false); setConfirming(true); } : undefined} /></div>}
      </div>
      {counts.size > 0 && (
        <div className="flex flex-wrap gap-1">
          {[...counts].map(([emoji, c]) => (
            <button key={emoji} onClick={() => pick(emoji)} aria-pressed={c.mine}
              className={cn('rounded-full border px-2 py-0.5 text-xs', c.mine ? 'border-primary bg-primary-soft' : 'border-line bg-surface')}>
              {emoji} {c.n}
            </button>
          ))}
        </div>
      )}
      {m.pending === 'failed' && (
        <div className="flex items-center gap-2 text-xs text-coral">
          Not sent.
          <button className="inline-flex items-center gap-1 underline" onClick={() => outbox.retry(m.id).catch((e: unknown) => toast.error(friendlyMessage(e)))}><RotateCcw className="size-3" /> Retry</button>
          <button className="inline-flex items-center gap-1 underline" onClick={() => outbox.discard(m.id)}><X className="size-3" /> Discard</button>
        </div>
      )}
      <ConfirmDialog open={confirming} onOpenChange={setConfirming} title="Delete this message?" body="It’s removed from the chat for both of you." confirmLabel="Delete" danger
        onConfirm={() => del.mutateAsync(m)} />
    </div>
  );
}

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { friendlyMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOutbox } from '@/features/chat/api';
import { STAR_MAX } from '@/features/chat/rules';
import { STAR_PRESETS, cheerFor } from './cheer';
import type { FeedItem } from './feed';

function useSendStar() {
  const outbox = useOutbox();
  const [busy, setBusy] = useState(false);
  const send = async (body: string) => {
    const value = body.trim();
    if (!value || value.length > STAR_MAX) return false;
    setBusy(true);
    try {
      await outbox.send({ kind: 'star', body: value });
      toast.success('Shooting star sent ✦');
      return true;
    } catch (e) {
      toast.error(friendlyMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { send, busy };
}

export function ShootingStarDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { partner } = useAuth();
  const [text, setText] = useState('');
  const { send, busy } = useSendStar();
  const submit = async () => { if (await send(text)) { setText(''); onOpenChange(false); } };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="sm" title={`Send ${partner?.display_name || 'your partner'} a shooting star`}
      description="A little light across their screen."
      footer={<>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="gold" loading={busy} disabled={!text.trim()} onClick={() => void submit()}><Sparkles className="size-4" /> Send</Button>
      </>}>
      <div className="flex flex-wrap gap-2">
        {STAR_PRESETS.map((p) => (
          <button key={p} onClick={() => setText(p)} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-sm hover:border-gold">{p}</button>
        ))}
      </div>
      <Field label="Message" className="mt-3">
        {(id) => <Textarea id={id} maxLength={STAR_MAX} value={text} onChange={(e) => setText(e.target.value)} className="min-h-20" />}
      </Field>
      <p className="mt-1 text-right text-xs text-ink-faint tabular">{text.length}/{STAR_MAX}</p>
    </Dialog>
  );
}

export function ShootingStarButton({ variant = 'button' }: { variant?: 'icon' | 'button' }) {
  const [open, setOpen] = useState(false);
  return (<>
    {variant === 'icon'
      ? <button type="button" onClick={() => setOpen(true)} aria-label="Send a shooting star" className="grid size-10 shrink-0 place-items-center rounded-xl text-gold hover:bg-gold-soft"><Sparkles className="size-5" /></button>
      : <Button variant="gold" onClick={() => setOpen(true)}><Sparkles className="size-4" /> Send a shooting star</Button>}
    <ShootingStarDialog open={open} onOpenChange={setOpen} />
  </>);
}

export function CheerButton({ item }: { item: FeedItem }) {
  const { send, busy } = useSendStar();
  return (
    <button onClick={() => void send(cheerFor(item))} disabled={busy} aria-label={`Cheer ${item.title}`}
      className="shrink-0 rounded-full border border-gold/40 px-3 py-1 text-xs font-semibold text-gold hover:bg-gold-soft disabled:opacity-50">
      Cheer
    </button>
  );
}

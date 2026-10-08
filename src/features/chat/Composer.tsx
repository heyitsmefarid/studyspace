import { useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Paperclip, SendHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { friendlyMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { useOutbox } from './api';
import { TEXT_MAX, attachmentProblem } from './rules';

const MAX_HEIGHT = 8 * 24 + 20;
const grow = (el: HTMLTextAreaElement) => { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`; };

export function Composer({ onTyping, extra }: { onTyping: () => void; extra?: ReactNode }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const outbox = useOutbox();

  const attach = (f: File | undefined | null) => {
    if (!f) return;
    const problem = attachmentProblem(f);
    setError(problem);
    if (!problem) setFile(f);
  };
  const submit = () => {
    const body = text.trim();
    if (!body && !file) return;
    const draft = file ? { kind: 'file' as const, body, file } : { kind: 'text' as const, body };
    setText(''); setFile(null); setError(null);
    if (area.current) area.current.style.height = 'auto';
    // on failure the bubble stays (with Retry/Discard) and the toast says why
    outbox.send(draft).catch((e: unknown) => toast.error(friendlyMessage(e)));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
  };
  const onPaste = (e: ClipboardEvent) => { const f = e.clipboardData.files[0]; if (f) { e.preventDefault(); attach(f); } };
  const onDrop = (e: DragEvent) => { e.preventDefault(); attach(e.dataTransfer.files[0]); };

  return (
    <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="flex flex-col gap-1">
      {error && <p role="alert" className="px-2 text-xs text-coral">{error}</p>}
      {file && (
        <p className="flex w-fit items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-sm">
          <Paperclip className="size-3.5" aria-hidden /> <span className="max-w-56 truncate">{file.name}</span>
          <button onClick={() => setFile(null)} aria-label="Remove attachment"><X className="size-3.5" /></button>
        </p>
      )}
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="flex items-end gap-1 rounded-2xl border border-line bg-surface p-2 transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:shadow-[0_0_0_4px_var(--primary-soft)]">
        <input ref={picker} type="file" className="hidden" onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" onClick={() => picker.current?.click()} className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Attach a file">
          <Paperclip className="size-5" />
        </button>
        {extra}
        <textarea ref={area} aria-label="Message" rows={1} maxLength={TEXT_MAX} value={text} placeholder="Write a message…"
          onChange={(e) => { setText(e.target.value); grow(e.target); onTyping(); }} onKeyDown={onKeyDown} onPaste={onPaste}
          className="block max-h-52 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-ink placeholder:text-ink-faint focus:outline-none" />
        <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim() && !file} className={cn('rounded-xl', (text.trim() || file) && '-translate-y-px')}>
          <SendHorizontal className="size-5" />
        </Button>
      </form>
    </div>
  );
}

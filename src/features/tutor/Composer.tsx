import { useRef, useState, type KeyboardEvent } from 'react';
import { SendHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';

const MAX = 8000;
const MAX_HEIGHT = 8 * 24 + 20; // ~8 lines

function grow(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
}

export function Composer({ initial = '', busy, onSend, placeholder = 'Ask Nova anything…' }: {
  initial?: string; busy: boolean; onSend: (text: string) => Promise<boolean>; placeholder?: string;
}) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    const value = text.trim();
    if (!value || busy) return;
    setText('');
    if (ref.current) ref.current.style.height = 'auto';
    const ok = await onSend(value);
    if (!ok) setText((t) => t || value); // keep their words if the message couldn't be saved
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
  };

  return (
    <form className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 focus-within:border-primary" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="relative min-w-0 flex-1">
        <textarea
          ref={ref}
          aria-label="Message Nova"
          rows={1}
          maxLength={MAX}
          value={text}
          placeholder={placeholder}
          onChange={(e) => { setText(e.target.value); grow(e.target); }}
          onKeyDown={onKeyDown}
          className="block max-h-52 w-full resize-none bg-transparent px-2 py-2 text-ink placeholder:text-ink-faint focus:outline-none"
        />
        {text.length > MAX - 1000 && (
          <span className={cn('absolute -top-5 right-1 text-xs tabular', text.length >= MAX ? 'text-coral' : 'text-ink-faint')}>{text.length}/{MAX}</span>
        )}
      </div>
      <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim() || busy} className="rounded-xl">
        <SendHorizontal className="size-5" />
      </Button>
    </form>
  );
}

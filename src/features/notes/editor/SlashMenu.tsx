import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { SuggestionProps } from '@tiptap/suggestion';
import { cn } from '@/lib/cn';
import type { SlashItem } from './SlashCommand';

export interface SlashMenuHandle { onKeyDown(event: KeyboardEvent): boolean }

export const SlashMenu = forwardRef<SlashMenuHandle, SuggestionProps<SlashItem>>(function SlashMenu(props, ref) {
  const [selected, setSelected] = useState(0);
  const { items, command } = props;

  useEffect(() => { setSelected(0); }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown(event) {
      if (items.length === 0) return false;
      if (event.key === 'ArrowDown') { setSelected((s) => (s + 1) % items.length); return true; }
      if (event.key === 'ArrowUp') { setSelected((s) => (s - 1 + items.length) % items.length); return true; }
      if (event.key === 'Enter') { const it = items[selected]; if (it) command(it); return true; }
      return false;
    },
  }), [items, selected, command]);

  return (
    <div role="listbox" aria-label="Insert block" className="w-60 rounded-xl border border-line bg-raised p-1 shadow-glow">
      {items.length === 0 ? (
        <p className="px-3 py-2 text-sm text-ink-muted">No blocks match</p>
      ) : items.map((it, i) => (
        <button
          key={it.title}
          role="option"
          aria-selected={i === selected}
          onMouseEnter={() => setSelected(i)}
          onMouseDown={(e) => { e.preventDefault(); command(it); }}
          className={cn('flex w-full flex-col rounded-lg px-3 py-1.5 text-left', i === selected ? 'bg-surface-2' : '')}
        >
          <span className="text-sm text-ink">{it.title}</span>
          <span className="text-xs text-ink-faint">{it.hint}</span>
        </button>
      ))}
    </div>
  );
});

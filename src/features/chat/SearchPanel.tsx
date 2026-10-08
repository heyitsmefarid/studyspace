import { useState } from 'react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { excerpt } from '@/lib/text';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useMessageSearch } from './api';
import type { ChatMessage } from './types';

export function SearchPanel({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (m: ChatMessage) => void }) {
  const [q, setQ] = useState('');
  const term = useDebouncedValue(q, 300);
  const results = useMessageSearch(term);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="right" title="Search messages">
      <Input autoFocus type="search" aria-label="Search messages" placeholder="Search Our Room…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 flex flex-col gap-1">
        {term.trim().length >= 2 && results.data?.length === 0 && <p className="text-sm text-ink-muted">No messages match.</p>}
        {results.data?.map((m) => (
          <button key={m.id} onClick={() => { onPick(m); onOpenChange(false); }} className="rounded-xl p-2 text-left hover:bg-surface-2">
            <span className="block text-sm">{excerpt(m.body, 120)}</span>
            <span className="block text-xs text-ink-faint">{format(new Date(m.created_at), 'PP p')}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

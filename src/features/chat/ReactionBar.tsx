import { Copy, Trash2 } from 'lucide-react';
import { EMOJIS } from './types';

export function ReactionBar({ onPick, onDelete, onCopy }: { onPick: (emoji: string) => void; onDelete?: () => void; onCopy?: () => void }) {
  return (
    <div role="toolbar" aria-label="React" className="flex animate-pop-in gap-0.5 rounded-full border border-line bg-raised p-1 shadow-glow">
      {EMOJIS.map((e) => (
        <button key={e} onClick={() => onPick(e)} className="grid size-9 place-items-center rounded-full text-lg transition-transform hover:scale-125 hover:bg-surface-2" aria-label={`React ${e}`}>{e}</button>
      ))}
      {onCopy && (
        <button onClick={onCopy} className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-2" aria-label="Copy message"><Copy className="size-4" /></button>
      )}
      {onDelete && (
        <button onClick={onDelete} className="grid size-9 place-items-center rounded-full text-coral hover:bg-surface-2" aria-label="Delete message"><Trash2 className="size-4" /></button>
      )}
    </div>
  );
}

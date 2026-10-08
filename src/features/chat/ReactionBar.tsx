import { EMOJIS } from './types';

export function ReactionBar({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div role="toolbar" aria-label="React" className="flex animate-pop-in gap-0.5 rounded-full border border-line bg-raised p-1 shadow-glow">
      {EMOJIS.map((e) => (
        <button key={e} onClick={() => onPick(e)} className="grid size-9 place-items-center rounded-full text-lg transition-transform hover:scale-125 hover:bg-surface-2" aria-label={`React ${e}`}>{e}</button>
      ))}
    </div>
  );
}

import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import type { CardState } from './srs';
import { constellationLayout } from './constellation';

const STYLE: Record<CardState, { r: number; o: number; fill: string }> = {
  new: { r: 1.4, o: 0.3, fill: 'var(--ink-faint)' },
  learning: { r: 1.8, o: 0.55, fill: 'var(--coral)' },
  reviewing: { r: 2.2, o: 0.8, fill: 'var(--teal)' },
  mastered: { r: 2.8, o: 1, fill: 'var(--gold)' },
};

export function DeckConstellation({ cardIds, states, size = 'sm', label, draw = size === 'lg' }: {
  cardIds: string[]; states: CardState[]; size?: 'sm' | 'lg'; label?: string; draw?: boolean;
}) {
  const [w, h] = size === 'sm' ? [220, 90] : [640, 220];
  const pts = useMemo(() => constellationLayout(cardIds, w, h), [cardIds, w, h]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={label ?? `${states.filter((s) => s === 'mastered').length} of ${states.length} cards mastered`}>
      <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--line-strong)" strokeWidth="0.6"
        pathLength={1} strokeDasharray="1" className={draw ? 'constellation-line animate-draw-line' : 'constellation-line'} />
      {pts.map((p, i) => {
        const s = STYLE[states[i] ?? 'new'];
        return <circle key={p.id} cx={p.x} cy={p.y} r={s.r * (size === 'lg' ? 1.6 : 1)} fill={s.fill} fillOpacity={s.o}
          className={cn(states[i] === 'mastered' && 'animate-twinkle', draw && states[i] !== 'mastered' && 'animate-pop-in')}
          style={{ animationDelay: states[i] === 'mastered' ? `${(i % 7) * 0.4}s` : `${Math.min(i, 24) * 25}ms`, transformOrigin: `${p.x}px ${p.y}px` }} />;
      })}
    </svg>
  );
}

export function Comet({ streak, size = 'md' }: { streak: number; size?: 'sm' | 'md' }) {
  const tail = Math.min(160, 24 + streak * 10);
  const h = size === 'sm' ? 18 : 26;
  const width = tail + h;
  return (
    <div className="flex items-center gap-3">
      <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} aria-hidden className="shrink-0">
        <defs>
          <linearGradient id="comet-tail" x1="0" x2="1">
            <stop offset="0" stopColor="var(--gold)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--gold)" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <path d={`M0 ${h / 2} Q ${tail * 0.6} ${h * 0.15} ${tail} ${h / 2 - h * 0.18} L ${tail} ${h / 2 + h * 0.18} Q ${tail * 0.6} ${h * 0.85} 0 ${h / 2} Z`} fill="url(#comet-tail)" />
        <circle cx={tail + h / 2 - 2} cy={h / 2} r={h / 2 - 3} fill="var(--gold)" style={{ filter: 'drop-shadow(0 0 6px var(--gold))' }} />
      </svg>
      <span className={size === 'sm' ? 'text-sm font-semibold' : 'font-display text-lg'}>
        {streak > 0 ? `${streak}-day streak` : 'Start your streak today'}
      </span>
    </div>
  );
}

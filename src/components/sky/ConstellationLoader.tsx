export function ConstellationLoader({ label = 'Nova is thinking…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm text-ink-muted">
      <svg viewBox="0 0 48 28" className="h-7 w-12" aria-hidden>
        <polyline points="4,22 16,8 28,16 44,4" fill="none" stroke="var(--primary)" strokeWidth="1.5" className="animate-draw" />
        {[[4, 22], [16, 8], [28, 16], [44, 4]].map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="2.2"
            fill="var(--gold)"
            className="animate-twinkle"
            style={{ animationDelay: `${i * 0.25}s`, transformOrigin: `${x}px ${y}px` }}
          />
        ))}
      </svg>
      <span>{label}</span>
    </div>
  );
}

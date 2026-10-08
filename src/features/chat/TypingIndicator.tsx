export function TypingIndicator({ name }: { name: string }) {
  return (
    <p role="status" className="flex items-center gap-2 px-2 text-xs text-ink-muted">
      <span aria-hidden className="flex gap-0.5">
        {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-twinkle rounded-full bg-ink-faint" style={{ animationDelay: `${i * 160}ms` }} />)}
      </span>
      {name} is typing…
    </p>
  );
}

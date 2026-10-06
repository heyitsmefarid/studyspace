import { Tabs as R } from 'radix-ui';
import { cn } from '@/lib/cn';

export function Tabs<T extends string>({ value, onValueChange, items, className, label }: {
  value: T; onValueChange: (v: T) => void; items: { value: T; label: string }[]; className?: string; label?: string;
}) {
  return (
    <R.Root value={value} onValueChange={(v) => onValueChange(v as T)}>
      <R.List aria-label={label} className={cn('inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface-2 p-1', className)}>
        {items.map((it) => (
          <R.Trigger
            key={it.value}
            value={it.value}
            className="h-9 shrink-0 rounded-lg px-3 text-sm font-semibold text-ink-muted transition duration-200 ease-soft data-[state=active]:animate-pop-in data-[state=active]:bg-primary-soft data-[state=active]:text-primary"
          >
            {it.label}
          </R.Trigger>
        ))}
      </R.List>
    </R.Root>
  );
}

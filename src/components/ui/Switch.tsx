import { Switch as R } from 'radix-ui';
import { useId } from 'react';

export function Switch({ checked, onCheckedChange, label, hint }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <label htmlFor={id} className="text-sm">
        <span className="font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      </label>
      <R.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-7 w-12 shrink-0 rounded-full border border-line bg-surface-2 transition-[background-color,box-shadow] duration-200 ease-soft data-[state=checked]:bg-primary data-[state=checked]:shadow-[0_0_12px_var(--primary-soft)]"
      >
        <R.Thumb className="block size-5 translate-x-1 rounded-full bg-ink shadow transition-transform duration-300 ease-float data-[state=checked]:translate-x-6 data-[state=checked]:bg-primary-ink" />
      </R.Root>
    </div>
  );
}

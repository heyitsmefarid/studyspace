import { DropdownMenu as R } from 'radix-ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MenuItem { label: string; icon?: LucideIcon; onSelect: () => void; danger?: boolean; disabled?: boolean }

export function Menu({ trigger, items, align = 'end' }: { trigger: ReactNode; items: MenuItem[]; align?: 'start' | 'end' }) {
  return (
    <R.Root>
      <R.Trigger asChild>{trigger}</R.Trigger>
      <R.Portal>
        <R.Content align={align} sideOffset={6} className="z-50 min-w-48 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-xl border border-line bg-raised p-1 shadow-glow data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out">
          {items.map(({ label, icon: Icon, onSelect, danger, disabled }) => (
            <R.Item
              key={label}
              disabled={disabled}
              onSelect={onSelect}
              className={cn(
                'flex h-10 cursor-pointer select-none items-center gap-2 rounded-lg px-3 text-sm outline-none transition-colors duration-150 data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2',
                danger ? 'text-coral' : 'text-ink',
              )}
            >
              {Icon && <Icon className="size-4" aria-hidden />}
              {label}
            </R.Item>
          ))}
        </R.Content>
      </R.Portal>
    </R.Root>
  );
}

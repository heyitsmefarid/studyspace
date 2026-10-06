import { Dialog as R } from 'radix-ui';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const SIDES = {
  bottom: 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-3xl pb-[calc(1.25rem+env(safe-area-inset-bottom))] data-[state=open]:animate-sheet-up data-[state=closed]:animate-sheet-down',
  right: 'inset-y-0 right-0 h-full w-[min(420px,100%)] rounded-l-3xl data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right',
  left: 'inset-y-0 left-0 h-full w-[min(360px,100%)] rounded-r-3xl data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left',
} as const;

export function Sheet({ open, onOpenChange, side = 'bottom', title, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; side?: keyof typeof SIDES; title: string; children: ReactNode;
}) {
  return (
    <R.Root open={open} onOpenChange={onOpenChange}>
      <R.Portal>
        <R.Overlay className="fixed inset-0 z-40 bg-[#05081a]/60 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <R.Content className={cn('fixed z-50 overflow-y-auto border border-line bg-raised p-5 shadow-glow', SIDES[side])}>
          <div className="mb-4 flex items-center justify-between">
            <R.Title className="font-display text-xl">{title}</R.Title>
            <R.Description className="sr-only">{title}</R.Description>
            <R.Close className="rounded-lg p-2 text-ink-muted hover:bg-surface-2" aria-label="Close"><X className="size-5" /></R.Close>
          </div>
          {children}
        </R.Content>
      </R.Portal>
    </R.Root>
  );
}

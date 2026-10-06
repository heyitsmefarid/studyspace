import { Dialog as R } from 'radix-ui';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' } as const;

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md' }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string;
  children: ReactNode; footer?: ReactNode; size?: keyof typeof SIZES;
}) {
  return (
    <R.Root open={open} onOpenChange={onOpenChange}>
      <R.Portal>
        <R.Overlay className="fixed inset-0 z-40 bg-[#05081a]/60 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <R.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl border border-line bg-raised p-5 shadow-glow',
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl',
            'data-[state=open]:animate-sheet-up data-[state=closed]:animate-sheet-down sm:data-[state=open]:animate-pop-in sm:data-[state=closed]:animate-pop-out',
            SIZES[size],
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <R.Title className="font-display text-xl">{title}</R.Title>
              {description
                ? <R.Description className="mt-1 text-sm text-ink-muted">{description}</R.Description>
                : <R.Description className="sr-only">{title}</R.Description>}
            </div>
            <R.Close className="rounded-lg p-2 text-ink-muted hover:bg-surface-2" aria-label="Close"><X className="size-5" /></R.Close>
          </div>
          {children}
          {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
        </R.Content>
      </R.Portal>
    </R.Root>
  );
}

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      toastOptions={{ classNames: { toast: '!bg-raised !border !border-line !text-ink !rounded-2xl !shadow-[0_0_0_1px_var(--line),var(--glow)]', description: '!text-ink-muted' } }}
    />
  );
}

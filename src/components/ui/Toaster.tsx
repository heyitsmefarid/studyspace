import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      toastOptions={{ classNames: { toast: '!bg-raised !border !border-line !text-ink !rounded-2xl !shadow-glow', description: '!text-ink-muted' } }}
    />
  );
}

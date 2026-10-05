import { useState } from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';

export function ConfirmDialog({ open, onOpenChange, title, body, confirmLabel = 'Confirm', danger, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; body: string; confirmLabel?: string; danger?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={<>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={confirm}>{confirmLabel}</Button>
      </>}
    >
      <p className="text-sm text-ink-muted">{body}</p>
    </Dialog>
  );
}

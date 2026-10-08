import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, FileText, Paperclip, ScanLine, Trash2 } from 'lucide-react';
import { friendlyMessage } from '@/lib/errors';
import { opensInline } from '@/lib/storage';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { MarkdownView } from '@/features/ai/MarkdownView';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { attachmentUrl, useAttachments, useDeleteAttachment, useScanAttachment, useUploadAttachment, type Attachment } from './attachmentsApi';

async function openAttachment(a: Attachment) {
  const inline = opensInline(a.mime_type);
  let url: string;
  try { url = await attachmentUrl(a, inline); } catch (e) { toast.error(friendlyMessage(e)); return; }
  if (inline) window.open(url, '_blank', 'noopener,noreferrer');
  else window.location.assign(url);
}

export function AttachmentList({ noteId, editable }: { noteId: string; editable: boolean }) {
  const list = useAttachments(noteId);
  const upload = useUploadAttachment(noteId);
  const remove = useDeleteAttachment(noteId);
  const scan = useScanAttachment();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [toDelete, setToDelete] = useState<Attachment | null>(null);
  const [scanned, setScanned] = useState<{ id: string; text: string } | null>(null);
  const items = list.data ?? [];

  const addFiles = (files: FileList | null) => {
    for (const f of [...(files ?? [])]) upload.mutate(f);
  };

  if (!editable && items.length === 0) return null;

  return (
    <section className="mt-8" aria-label="Attachments">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg"><Paperclip className="size-4" aria-hidden /> Attachments</h2>
      {items.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2">
              <FileText className="size-4 shrink-0 text-ink-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">{a.file_name}</span>
              <span className="shrink-0 text-xs text-ink-faint tabular">{(a.size_bytes / 1048576).toFixed(1)} MB</span>
              <Button size="sm" variant="ghost" onClick={() => openAttachment(a)} aria-label={`Open ${a.file_name}`}><ExternalLink className="size-4" /></Button>
              <Button size="sm" variant="ghost" loading={scan.isPending && scan.variables?.id === a.id} onClick={async () => { try { setScanned({ id: a.id, text: await scan.mutateAsync(a) }); } catch (e) { toast.error(friendlyMessage(e)); } }} aria-label={`Scan ${a.file_name} with Nova`}><ScanLine className="size-4" /></Button>
              {editable && <Button size="sm" variant="ghost" onClick={() => setToDelete(a)} aria-label={`Delete ${a.file_name}`}><Trash2 className="size-4" /></Button>}
              {scanned?.id === a.id && <div className="basis-full rounded-lg bg-surface p-3 text-sm"><MarkdownView markdown={scanned.text} /></div>}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          className={cn('flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-5 text-center text-sm text-ink-muted',
            dragging ? 'border-primary bg-primary-soft' : 'border-line-strong')}
        >
          <p>Drop files here (up to 10 MB each)</p>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <Button size="sm" variant="secondary" loading={upload.isPending} onClick={() => inputRef.current?.click()}>Attach file</Button>
        </div>
      )}
      <ConfirmDialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)} danger title="Delete attachment?"
        confirmLabel="Delete" body={toDelete?.file_name ?? ''} onConfirm={() => remove.mutateAsync(toDelete!)} />
    </section>
  );
}

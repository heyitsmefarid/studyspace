import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import { toast } from 'sonner';
import type { Note } from '../api';
import { noteExtensions } from './extensions';
import { Toolbar } from './Toolbar';
import { uploadNoteFile } from '../attachmentsApi';
import { friendlyMessage } from '@/lib/errors';

export interface NoteEditorHandle { getSelectionText(): string; getText(): string; insertContent(c: JSONContent | JSONContent[]): void }
interface Props { note: Note; uid: string; editable: boolean; onChange(v: { content: JSONContent; content_text: string }): void }

export const NoteEditor = forwardRef<NoteEditorHandle, Props>(function NoteEditor({ note, uid, editable, onChange }, ref) {
  const editor = useEditor({
    extensions: noteExtensions({ editable }),
    content: note.content as JSONContent,
    editable,
    editorProps: {
      attributes: { class: 'prose-ss min-h-[50dvh] focus:outline-none', 'aria-label': 'Note content' },
      handlePaste: (_v, e) => insertImages(e.clipboardData?.files),
      handleDrop: (_v, e) => insertImages((e as DragEvent).dataTransfer?.files),
    },
    onUpdate: ({ editor: ed }) => onChange({ content: ed.getJSON(), content_text: ed.getText({ blockSeparator: '\n\n' }) }),
  }, [note.id, editable]);

  function insertImages(files: FileList | null | undefined): boolean {
    const images = [...(files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (!editable || !editor || images.length === 0) return false;
    for (const f of images) {
      uploadNoteFile(note.id, uid, f, 'image')
        .then((a) => editor.chain().focus().insertStorageImage({ path: a.storage_path, alt: f.name }).run())
        .catch((err) => toast.error(friendlyMessage(err)));
    }
    return true;
  }

  useEffect(() => {
    const pick = () => {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', multiple: true });
      input.onchange = () => insertImages(input.files);
      input.click();
    };
    window.addEventListener('ss:pick-image', pick);
    return () => window.removeEventListener('ss:pick-image', pick);
  });

  useImperativeHandle(ref, () => ({
    getSelectionText: () => {
      if (!editor) return '';
      const { from, to } = editor.state.selection;
      return editor.state.doc.textBetween(from, to, '\n\n');
    },
    getText: () => editor?.getText({ blockSeparator: '\n\n' }) ?? '',
    insertContent: (c) => { editor?.chain().focus('end').insertContent(c).run(); },
  }), [editor]);

  return (
    <div>
      {editable && editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
});

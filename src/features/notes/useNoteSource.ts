import { useState, type RefObject } from 'react';
import { truncateAtBoundary } from '@/lib/text';
import { MAX_SOURCE_CHARS } from '@/services/ai/schemas';
import { subjectById, useSubjects } from '@/features/subjects/api';
import type { Note } from './api';
import type { NoteEditorHandle } from './editor/Editor';

export function useNoteSource(note: Note, editorRef: RefObject<NoteEditorHandle | null>) {
  const [useSelection, setUseSelection] = useState(false);
  const subjects = useSubjects();
  function source() {
    const selected = useSelection ? editorRef.current?.getSelectionText().trim() ?? '' : '';
    const raw = selected || (editorRef.current?.getText() || note.content_text).trim();
    if (!raw) return null;
    const { text, truncated } = truncateAtBoundary(raw, MAX_SOURCE_CHARS);
    return {
      text, truncated, title: note.title,
      subject: subjectById(subjects.data, note.subject_id)?.name,
      label: selected ? `Selected text (${selected.length.toLocaleString()} chars)` : 'Whole note',
    };
  }
  return { useSelection, setUseSelection, source };
}

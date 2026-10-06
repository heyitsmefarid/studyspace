/**
 * Searchable groups shown in the command palette (notes, decks, …). Feature tasks append their source here.
 * Each source's `useItems` is called inside its own component, so the list may grow without breaking hook order.
 */
import { useNoteSearch } from '@/features/notes/api';

export interface PaletteItem { id: string; label: string; to: string }
export interface PaletteSource { id: string; heading: string; useItems(query: string): PaletteItem[] }

const notesSource: PaletteSource = {
  id: 'notes',
  heading: 'Notes',
  useItems(query) {
    const q = useNoteSearch(query);
    return (q.data ?? []).slice(0, 6).map((n) => ({ id: n.id, label: n.title || 'Untitled', to: `/notes/${n.id}` }));
  },
};

export const PALETTE_SOURCES: PaletteSource[] = [notesSource];

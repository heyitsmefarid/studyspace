/**
 * Searchable groups shown in the command palette (notes, decks, …). Feature tasks append their source here.
 * Each source's `useItems` is called inside its own component, so the list may grow without breaking hook order.
 */
import { useNoteSearch } from '@/features/notes/api';
import { useDecks } from '@/features/flashcards/api';

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

const decksSource: PaletteSource = {
  id: 'decks',
  heading: 'Decks',
  useItems(query) {
    const mine = useDecks('mine');
    const shared = useDecks('shared');
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return [...(mine.data ?? []), ...(shared.data ?? [])]
      .filter((d) => d.title.toLowerCase().includes(q))
      .slice(0, 6)
      .map((d) => ({ id: d.id, label: d.title, to: `/decks/${d.id}` }));
  },
};

export const PALETTE_SOURCES: PaletteSource[] = [notesSource, decksSource];

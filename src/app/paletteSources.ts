/**
 * Searchable groups shown in the command palette (notes, decks, …). Feature tasks append their source here.
 * Each source's `useItems` is called inside its own component, so the list may grow without breaking hook order.
 */
export interface PaletteItem { id: string; label: string; to: string }
export interface PaletteSource { id: string; heading: string; useItems(query: string): PaletteItem[] }

export const PALETTE_SOURCES: PaletteSource[] = [];

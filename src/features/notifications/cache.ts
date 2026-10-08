type Item = { id: string; read_at: string | null };

export const prependUnique = <T extends Item>(list: T[], row: T): T[] => (list.some((x) => x.id === row.id) ? list : [row, ...list]);

export const markRead = <T extends Item>(list: T[], ids: string[] | 'all', at: string): T[] =>
  list.map((x) => (!x.read_at && (ids === 'all' || ids.includes(x.id)) ? { ...x, read_at: at } : x));

export const removeById = <T extends Item>(list: T[], id: string): T[] => list.filter((x) => x.id !== id);

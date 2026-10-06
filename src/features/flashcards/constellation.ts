export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Golden-angle spiral with per-id jitter: evenly spread, stable for the same ids. */
export function constellationLayout(ids: string[], width: number, height: number, pad = 8) {
  const cx = width / 2, cy = height / 2;
  const rx = width / 2 - pad, ry = height / 2 - pad;
  const golden = Math.PI * (3 - Math.sqrt(5));
  return ids.map((id, i) => {
    const t = Math.sqrt((i + 0.5) / Math.max(ids.length, 1));
    const h = hashString(id);
    const jitter = ((h % 1000) / 1000 - 0.5) * 0.18;
    const angle = i * golden + jitter * Math.PI;
    const r = Math.min(1, t + jitter * 0.3);
    const x = cx + Math.cos(angle) * rx * r;
    const y = cy + Math.sin(angle) * ry * r;
    return { id, x: Math.min(width - pad, Math.max(pad, x)), y: Math.min(height - pad, Math.max(pad, y)) };
  });
}

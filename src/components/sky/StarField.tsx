import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { cn } from '@/lib/cn';
import { mulberry32 } from '@/lib/random';
import { hashString } from '@/features/flashcards/constellation';
import { layoutSky, type SkySession, type SkyStar, type SkySubject } from '@/features/dashboard/sky';

const HIT = 14;

function rgba(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return alpha === 0 ? 'rgba(0,0,0,0)' : color;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * Responsive canvas sky: measures its width, lays the sessions out with `layoutSky`, and draws dust, constellation
 * lines and glowing stars. Recent stars twinkle (~30 fps) only when motion is allowed; otherwise it draws once.
 */
export function StarField({ sessions, subjects, meColor, height, dust = true, ariaLabel, className, maxStars }: {
  sessions: SkySession[]; subjects: SkySubject[]; meColor: string; height?: number; dust?: boolean; ariaLabel: string;
  className?: string; maxStars?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null);
  const [themeTick, setThemeTick] = useState(0);
  const [now] = useState(() => new Date());

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry?.contentRect.width ?? 0);
      if (w > 0) setSize({ w, h: height ?? (w < 640 ? 200 : 280) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  // Redraw when the theme flips so dust picks up the new --sky-star colour.
  useEffect(() => {
    const mo = new MutationObserver(() => setThemeTick((n) => n + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  const sky = useMemo(
    () => (size ? layoutSky(sessions, subjects, { width: size.w, height: size.h, now, meColor, maxStars }) : { stars: [] as SkyStar[], lines: [] }),
    [sessions, subjects, size, now, meColor, maxStars],
  );

  useEffect(() => {
    const c = canvas.current;
    if (!c || !size) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dustColor = getComputedStyle(c).getPropertyValue('--sky-star').trim() || '#ffffff';
    const rng = mulberry32(42);
    const dustPts = dust ? Array.from({ length: 80 + Math.floor(rng() * 60) }, () => ({
      x: rng() * size.w, y: rng() * size.h, a: 0.15 + rng() * 0.35, r: rng() < 0.15 ? 1 : 0.6,
    })) : [];
    const byId = new Map(sky.stars.map((s) => [s.id, s]));
    const phase = new Map(sky.stars.map((s) => [s.id, (hashString(s.id) % 1000) / 100]));

    const draw = (t: number) => {
      ctx.clearRect(0, 0, size.w, size.h);
      ctx.fillStyle = dustColor;
      for (const d of dustPts) {
        ctx.globalAlpha = d.a;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.lineWidth = 1;
      for (const l of sky.lines) {
        const a = byId.get(l.from), b = byId.get(l.to);
        if (!a || !b) continue;
        ctx.globalAlpha = l.opacity;
        ctx.strokeStyle = l.color;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (const s of sky.stars) {
        ctx.globalAlpha = s.twinkle ? 0.6 + 0.4 * Math.sin(t / 600 + phase.get(s.id)!) : 1;
        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
        glow.addColorStop(0, rgba(s.color, 0.55));
        glow.addColorStop(1, rgba(s.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const motion = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    let raf = 0;
    let last = -Infinity;
    const loop = (t: number) => {
      if (document.visibilityState === 'visible' && t - last >= 33) { last = t; draw(t); }
      raf = requestAnimationFrame(loop);
    };
    if (motion && sky.stars.some((s) => s.twinkle)) raf = requestAnimationFrame(loop);
    else draw(0);
    return () => cancelAnimationFrame(raf);
  }, [sky, size, dust, themeTick]);

  const locate = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    let best: SkyStar | null = null;
    let bestD = HIT;
    for (const s of sky.stars) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d <= bestD) { best = s; bestD = d; }
    }
    setTip(best ? { x: best.x, y: best.y, label: best.label } : null);
  };

  const subjectCount = new Set(sky.stars.map((s) => s.subjectId ?? 'none')).size;
  return (
    <div ref={wrap} className={cn('relative w-full', className)} style={{ height: size?.h ?? height ?? 200 }}>
      <canvas
        ref={canvas}
        role="img"
        aria-label={`${ariaLabel}: ${sessions.length} study session${sessions.length === 1 ? '' : 's'} across ${subjectCount} subject${subjectCount === 1 ? '' : 's'}`}
        className="block h-full w-full touch-pan-y"
        style={{ width: size?.w ?? '100%', height: size?.h ?? '100%' }}
        onPointerMove={locate}
        onPointerDown={locate}
        onPointerLeave={() => setTip(null)}
      />
      {tip && size && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-raised px-2.5 py-1 text-xs shadow-glow"
          style={{ left: Math.min(size.w - 80, Math.max(80, tip.x)), top: tip.y - 10 }}
        >
          {tip.label}
        </div>
      )}
      <ul className="sr-only">{sky.stars.slice(0, 10).map((s) => <li key={s.id}>{s.label}</li>)}</ul>
    </div>
  );
}

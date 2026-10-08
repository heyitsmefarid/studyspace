import { useEffect, useMemo, useRef, useState } from 'react';
import { startOfDay, subDays } from 'date-fns';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSessions } from '@/features/study/api';
import { useSubjects } from '@/features/subjects/api';
import { layoutOurSky } from './ourSky';

export function OurSky() {
  const { profile, partner } = useAuth();
  const [now] = useState(() => new Date());
  const [since] = useState(() => subDays(startOfDay(now), 365).toISOString());
  const mine = useSessions(since);
  const theirs = useSessions(since, partner?.id);
  const subjects = useSubjects();
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry?.contentRect.width ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    if (!width || !profile || !partner) return null;
    const skySubjects = (subjects.data ?? []).map((s) => ({ id: s.id, name: s.name, color: s.color, mastery: 0.5 }));
    return layoutOurSky(mine.data ?? [], theirs.data ?? [], skySubjects,
      { width, now, meColor: profile.star_color, partnerColor: partner.star_color, maxStars: 90 });
  }, [width, profile, partner, subjects.data, mine.data, theirs.data, now]);

  const byId = new Map(layout?.stars.map((s) => [s.id, s]) ?? []);
  const empty = !mine.isPending && !theirs.isPending && (mine.data?.length ?? 0) + (theirs.data?.length ?? 0) === 0;
  const partnerName = partner?.display_name || 'Your partner';

  return (
    <div ref={wrap} className="relative overflow-hidden rounded-3xl border border-line bg-surface">
      {layout && (
        <svg width={layout.width} height={layout.height} role="img"
          aria-label={`Our sky: ${mine.data?.length ?? 0} of your sessions, ${theirs.data?.length ?? 0} of ${partnerName}’s, ${layout.links.length} studied together`}>
          <line x1={layout.row ? layout.width / 2 : 0} y1={layout.row ? 0 : layout.height / 2} x2={layout.row ? layout.width / 2 : layout.width}
            y2={layout.row ? layout.height : layout.height / 2} stroke="var(--line)" strokeDasharray="3 6" />
          <text x={12} y={22} fontSize={12} fill="var(--ink-muted)">You</text>
          <text x={layout.row ? layout.width / 2 + 12 : 12} y={layout.row ? 22 : layout.height / 2 + 22} fontSize={12} fill="var(--ink-muted)">{partnerName}</text>
          {layout.lines.map((l, i) => {
            const a = byId.get(l.from); const b = byId.get(l.to);
            return a && b ? <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={l.color} strokeOpacity={l.opacity} strokeWidth={1} /> : null;
          })}
          {layout.links.map((l, i) => {
            const a = byId.get(l.from)!; const b = byId.get(l.to)!;
            return <path key={`${l.from}-${l.to}`} d={`M${a.x} ${a.y}L${b.x} ${b.y}`} pathLength={1} strokeDasharray="1" stroke="var(--gold)" strokeWidth={1.5}
              className="animate-draw-line" style={{ animationDelay: `${400 + i * 60}ms`, filter: 'drop-shadow(0 0 4px var(--gold))' }} />;
          })}
          {layout.stars.map((s, i) => (
            <circle key={s.id} cx={s.x} cy={s.y} r={s.r + 0.6} fill={s.color} className="animate-pop-in"
              style={{ animationDelay: `${Math.min(i * 8, 800)}ms`, transformOrigin: `${s.x}px ${s.y}px`, filter: `drop-shadow(0 0 ${s.twinkle ? 6 : 3}px ${s.color})` }}>
              <title>{s.label}</title>
            </circle>
          ))}
        </svg>
      )}
      {!layout && <div className="h-[400px] md:h-[280px]" />}
      {empty && <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-ink-muted">Your first sessions light up this sky.</p>}
    </div>
  );
}

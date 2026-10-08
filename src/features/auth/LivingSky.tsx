import { useEffect, useRef, type CSSProperties } from 'react';
import { installParallax } from '@/lib/parallax';
import { SKY_LINKS } from './skyProgress';

/** "you" → three waypoints → "your person". Link i joins STARS[i] and STARS[i + 1]. */
const STARS = [[72, 196], [128, 142], [196, 170], [258, 104], [326, 138]] as const;
const LINKS = STARS.slice(1).map((to, i) => [STARS[i]!, to] as const);
const COMET_PATH = `M${STARS.map(([x, y]) => `${x} ${y}`).join('L')}`;

const TWINKLES = [[8, 14, 0], [31, 8, 1.4], [54, 22, 2.6], [77, 10, 0.8], [91, 30, 2], [18, 40, 3.1], [64, 44, 1.9]] as const;

function caption(progress: number, celebrate: boolean) {
  if (celebrate) return 'Connected. Welcome home ✦';
  if (progress >= SKY_LINKS) return 'Aligned. Ready when you are.';
  if (progress > 0) return 'Your constellation is forming…';
  return 'Two stars, waiting to meet.';
}

const depth = (d: number) => ({ '--depth': d }) as CSSProperties;

/**
 * The auth hero. Night: deep sky with an aurora; Daybreak: a dawn horizon with a rising sun. The constellation
 * between "you" and "your person" lights link by link as the form fills in (`progress`, 0…SKY_LINKS), flickers on
 * each failed attempt (`stumble` counts them) and sends a comet along the path on success (`celebrate`).
 * Layers drift against the pointer (parallax.ts). Desktop: the left panel; phone (`compact`): a band above the form.
 */
export function LivingSky({ progress, celebrate = false, stumble = 0, compact = false }: {
  progress: number; celebrate?: boolean; stumble?: number; compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? installParallax(ref.current) : undefined), []);
  const complete = progress >= SKY_LINKS;

  return (
    <div ref={ref} aria-hidden data-celebrate={celebrate || undefined} className="living-sky relative isolate h-full w-full overflow-hidden">
      <div className="sky-gradient absolute inset-0" />
      <div className="sky-sun" />
      <div className="sky-aurora" />

      <div className="sky-layer absolute -inset-[4%]" style={depth(0.3)}>
        <div className="sky-dust absolute inset-0"><div className="study-starfield absolute inset-0" /></div>
        {TWINKLES.map(([x, y, delay]) => (
          <svg key={`${x}-${y}`} viewBox="0 0 24 24" className="sky-twinkle absolute size-3 animate-twinkle"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }}>
            <path d="M12 2c.6 4.4 1.9 5.7 6.3 6.3-4.4.6-5.7 1.9-6.3 6.3-.6-4.4-1.9-5.7-6.3-6.3C10.1 7.7 11.4 6.4 12 2z" fill="var(--sky-twinkle)" />
          </svg>
        ))}
      </div>

      <div className="sky-layer absolute inset-0" style={depth(0.8)}>
        <svg viewBox="0 0 400 300" preserveAspectRatio={compact ? 'xMidYMid slice' : 'xMidYMid meet'}
          className={compact ? 'absolute inset-0 size-full' : 'absolute left-1/2 top-[10%] w-[min(88%,560px)] -translate-x-1/2'}>
          <line x1="0" y1="0" x2="60" y2="22" stroke="var(--sky-twinkle)" strokeWidth="1.2" strokeLinecap="round" className="shooting-star" />
          <g key={stumble} className={stumble ? 'sky-stumble' : undefined}>
            {LINKS.map(([[x1, y1], [x2, y2]], i) => (
              <g key={i}>
                <path d={`M${x1} ${y1}L${x2} ${y2}`} className="sky-guide" />
                <path d={`M${x1} ${y1}L${x2} ${y2}`} pathLength={1} className="sky-link" data-lit={progress > i || undefined}
                  style={{ transitionDelay: `${i * 60}ms` }} />
              </g>
            ))}
            {STARS.map(([x, y], i) => {
              const end = i === 0 || i === STARS.length - 1;
              const color = i === 0 ? 'var(--star-me)' : end ? 'var(--star-partner)' : 'var(--sky-link)';
              const lit = i === 0 || (end ? complete : progress >= i);
              return (
                <g key={i} className={end ? 'sky-node sky-node-end' : 'sky-node'} data-lit={lit || undefined}
                  style={{ transformOrigin: `${x}px ${y}px`, '--node': color } as CSSProperties}>
                  <circle cx={x} cy={y} r={end ? 18 : 10} className="sky-node-halo" />
                  <circle cx={x} cy={y} r={end ? 5 : 3.2} className="sky-node-core" />
                </g>
              );
            })}
          </g>
          {celebrate && <path d={COMET_PATH} pathLength={1} className="sky-comet" />}
          {!compact && (<>
            <text x={STARS[0][0]} y={STARS[0][1] + 32} textAnchor="middle" fontSize="11" fill="var(--ink-muted)">you</text>
            <text x={STARS[4][0]} y={STARS[4][1] + 32} textAnchor="middle" fontSize="11" fill="var(--ink-muted)">your person</text>
          </>)}
        </svg>
      </div>

      <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="sky-layer absolute inset-x-[-4%] -bottom-4 h-[28%] w-[108%]" style={depth(0.5)}>
        <path d="M0 62 C 40 40, 80 44, 120 56 S 200 30, 250 46 S 340 36, 400 52 V100 H0 Z" fill="var(--hill-far)" />
      </svg>
      <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="sky-layer absolute inset-x-[-6%] -bottom-4 h-[20%] w-[112%]" style={depth(1.2)}>
        <path d="M0 70 C 60 52, 110 60, 160 72 S 260 54, 320 64 S 380 70, 400 62 V100 H0 Z" fill="var(--hill-near)" />
      </svg>

      {!compact && (
        <div className="absolute inset-x-10 bottom-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">{caption(progress, celebrate)}</p>
          <p className="font-display text-4xl leading-tight">A study sky for two.</p>
          <p className="mt-2 max-w-sm text-ink-muted">Every session adds a star. Notes, cards, quizzes and Nova, shared with your person.</p>
        </div>
      )}
    </div>
  );
}

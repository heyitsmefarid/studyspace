# StudySpace UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every StudySpace screen, from sign-up to each feature, a calm, magical motion layer and light visual depth, without changing features or data.

**Architecture:**
- Motion is CSS-first: shared tokens, global keyframes and Tailwind 4 `animate-*` utilities, plus one global reduced-motion rule.
- Radix `data-state` attributes drive enter and exit for overlays.
- A few tiny tested helpers handle what CSS can't:
  - pointer-glow coordinates;
  - count-up numbers;
  - the reduced-motion hook;
  - page keys;
  - password strength;
  - sky reveal alpha;
  - a flashcard exit gate.
- Screen passes then apply the shared vocabulary per feature.

**Tech Stack:** React 19, Tailwind CSS 4.3 (`@theme`, arbitrary values), Radix UI, cmdk, sonner, Recharts 3, Vitest 5. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-studyspace-ui-polish-design.md`

## Global Constraints

- **Feel:** calm and magical. Every animation is ≤ 600ms unless it loops, and loops are slow and low-contrast.
- **No new JavaScript dependency.**
- Animations use `transform`, `opacity` or `filter`. The exceptions are the tiny SVG stroke reveals (`stroke-dashoffset`) on progress rings and constellation lines.
- `prefers-reduced-motion: reduce` gives instant, still results. CSS gets this from the global rule. JS-driven motion (count-up, sky reveal, Recharts) checks `prefersReducedMotion()` or `usePrefersReducedMotion()`.
- Both themes (Night and Daybreak) get every treatment. Text contrast tests stay green, and `primary-ink` is ≥ 4.5:1 on `--primary` and `--primary-2`.
- No feature or data changes. The only layout change is the auth split screen.
- Verification per task: `npm test`, `npm run typecheck` and `npm run lint` all green. Visual checks follow Task 15.

## Review Focus

1. **Reduced motion:** every CSS animation and transition collapses to instant, and JS motion is skipped. Test: Task 1 `motion.test.ts` "reduced motion collapses every animation", plus Task 3 `countUp.test.ts` "reduced motion jumps to target".
2. **Same-route navigation keeps components mounted:**
   - `/tutor` → `/tutor/:id`, `/notes/a` → `/notes/b` and query-only changes don't remount or re-animate the page.
   - Test: Task 5 `pageKey.test.ts`.
3. **Rapid grading in flashcard review:** pressing 3 then 4 quickly during the exit animation grades the card once. Test: Task 10 `exitGate.test.ts`.
4. **Long lists:** children past the 12th share the last stagger delay, so a 200-note grid never waits seconds to appear. Test: Task 1 `motion.test.ts` "stagger caps at the 12th child".
5. **Touch-only devices:** pointer glow never activates without hover capability, so no stuck glow after a tap. Test: Task 2 `pointerGlow.test.ts` "does nothing without hover".

---

### Task 1: Motion foundation (tokens, keyframes, reduced motion, stagger, shimmer, focus halo, checkbox)

**Files:**
- Modify: `src/styles/tokens.css` (add `--primary-2`, motion tokens and the `@theme` colour map)
- Modify: `src/index.css` (keyframes, `@theme` animations, utilities, reduced-motion rule)
- Modify: `src/styles/tokens.test.ts` (primary-ink on primary-2)
- Test: `src/styles/motion.test.ts`

**Interfaces:**
- Produces these utilities for later tasks:
  - entrances and exits: `animate-page-in`, `animate-rise-in`, `animate-pop-in`, `animate-pop-out`, `animate-fade-in`, `animate-fade-out`;
  - sheets: `animate-sheet-up`, `animate-sheet-down`, `animate-slide-in-right`, `animate-slide-out-right`, `animate-slide-in-left`, `animate-slide-out-left`;
  - feedback and loops: `animate-shake`, `animate-float`, `animate-grow-x`, `animate-draw-line`, `animate-pulse-once`, `animate-orbit`, `animate-shimmer-text`.
- CSS classes: `stagger`, `card-sheen`, `skeleton-shimmer`, `check-pop`, and the `[data-glow]` hover glow.
- Tokens:
  - `--ease-soft`, `--ease-float`, `--dur-press`, `--dur-hover`, `--dur-enter`, `--dur-page`;
  - colour `--primary-2` (`bg-primary-2`);
  - Tailwind easing utilities `ease-soft` and `ease-float`.

- [ ] **Step 1: Write the failing tests**

Add to `src/styles/tokens.test.ts`, at the end of the file:

```ts
// UI polish: the primary button gradient ends on --primary-2; its label stays readable on both stops.
describe.each([
  ['daybreak', ':root'],
  ['night', '[data-theme="night"]'],
])('%s gradient tokens', (_name, selector) => {
  const t = block(selector);
  it.each(['primary', 'primary-2'])('primary-ink on %s ≥ 4.5:1', (bg) => {
    expect(t[bg], `${bg} missing`).toBeDefined();
    expect(ratio(t['primary-ink']!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
});
```

Create `src/styles/motion.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('motion foundation', () => {
  it.each(['page-in', 'rise-in', 'pop-in', 'pop-out', 'fade-in', 'fade-out', 'sheet-up', 'sheet-down', 'slide-in-right', 'slide-out-right',
    'slide-in-left', 'slide-out-left', 'shake', 'float', 'shimmer', 'grow-x', 'draw-line', 'pulse-once', 'orbit-spin', 'shimmer-text'])(
    'defines @keyframes %s and an animate utility', (name) => {
      expect(css).toMatch(new RegExp(`@keyframes ${name}\\s*\\{`));
    });

  it('reduced motion collapses every animation and transition', () => {
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*,\s*\*::before,\s*\*::after\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(block).toContain('animation-duration: 0.01ms !important');
    expect(block).toContain('animation-iteration-count: 1 !important');
    expect(block).toContain('animation-delay: 0ms !important');
    expect(block).toContain('transition-duration: 0.01ms !important');
  });

  it('stagger caps at the 12th child', () => {
    expect(css).toMatch(/\.stagger > \*\s*\{[^}]*--i:\s*11/);
    expect(css).toMatch(/\.stagger > :nth-child\(11\)\s*\{\s*--i:\s*10;?\s*\}/);
    expect(css).not.toMatch(/\.stagger > :nth-child\(1[3-9]\)/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tokens motion`
Expected: FAIL. `primary-2 missing`, and the keyframes and stagger assertions fail.

- [ ] **Step 3: Add tokens**

In `src/styles/tokens.css`:
- in the `:root` block, after `--primary: #5443C9;`, add `--primary-2: #6A4BD6;`;
- in the `[data-theme="night"]` block, after `--primary: #A99CFF;`, add `--primary-2: #8B7BFF;`;
- in `@theme inline`, after `--color-primary: var(--primary);`, add `--color-primary-2: var(--primary-2);`.

At the end of the `:root` block (before `color-scheme: light;`) add:

```css
  --ease-soft: cubic-bezier(.2, .8, .2, 1);
  --ease-float: cubic-bezier(.34, 1.25, .64, 1);
  --dur-press: 120ms;
  --dur-hover: 200ms;
  --dur-enter: 320ms;
  --dur-page: 420ms;
```

- [ ] **Step 4: Add keyframes, animations and utilities**

In `src/index.css`, replace the `:focus-visible` line inside `@layer base` with:

```css
  :focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: 0.5rem; box-shadow: 0 0 0 5px var(--primary-soft); transition: box-shadow var(--dur-hover) var(--ease-soft); }
```

Append to the end of `src/index.css`:

```css
/* ───────────── UI polish: motion vocabulary (spec 2026-10-06-studyspace-ui-polish-design) */
@theme {
  --ease-soft: cubic-bezier(.2, .8, .2, 1);
  --ease-float: cubic-bezier(.34, 1.25, .64, 1);
  --animate-page-in: page-in 420ms var(--ease-soft) both;
  --animate-rise-in: rise-in 320ms var(--ease-soft) both;
  --animate-pop-in: pop-in 240ms var(--ease-float) both;
  --animate-pop-out: pop-out 160ms var(--ease-soft) both;
  --animate-fade-in: fade-in 200ms var(--ease-soft) both;
  --animate-fade-out: fade-out 160ms var(--ease-soft) both;
  --animate-sheet-up: sheet-up 320ms var(--ease-soft) both;
  --animate-sheet-down: sheet-down 220ms var(--ease-soft) both;
  --animate-slide-in-right: slide-in-right 320ms var(--ease-soft) both;
  --animate-slide-out-right: slide-out-right 220ms var(--ease-soft) both;
  --animate-slide-in-left: slide-in-left 320ms var(--ease-soft) both;
  --animate-slide-out-left: slide-out-left 220ms var(--ease-soft) both;
  --animate-shake: shake 360ms var(--ease-soft) both;
  --animate-float: float 6s ease-in-out infinite;
  --animate-grow-x: grow-x 600ms var(--ease-soft) both;
  --animate-draw-line: draw-line 1.2s var(--ease-soft) both;
  --animate-pulse-once: pulse-once 1.4s var(--ease-soft) 1 both;
  --animate-orbit: orbit-spin 1.2s var(--ease-soft) 1;
  --animate-shimmer-text: shimmer-text 4s linear infinite;
}

@keyframes page-in { from { opacity: 0; transform: translateY(8px); filter: blur(2px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes rise-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes pop-in { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
@keyframes pop-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: scale(.97); } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes sheet-up { from { transform: translateY(100%); } to { transform: none; } }
@keyframes sheet-down { from { transform: none; } to { transform: translateY(100%); } }
@keyframes slide-in-right { from { transform: translateX(100%); } to { transform: none; } }
@keyframes slide-out-right { from { transform: none; } to { transform: translateX(100%); } }
@keyframes slide-in-left { from { transform: translateX(-100%); } to { transform: none; } }
@keyframes slide-out-left { from { transform: none; } to { transform: translateX(-100%); } }
@keyframes shake { 0%, 100% { transform: none; } 20% { transform: translateX(-2px); } 40% { transform: translateX(2px); } 60% { transform: translateX(-2px); } 80% { transform: translateX(1px); } }
@keyframes float { 0%, 100% { transform: none; } 50% { transform: translateY(-3px); } }
@keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
@keyframes grow-x { from { transform: scaleX(0); } to { transform: none; } }
@keyframes draw-line { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes pulse-once { 0% { box-shadow: 0 0 0 0 var(--gold-soft); } 60% { box-shadow: 0 0 0 8px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
@keyframes orbit-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes shimmer-text { from { background-position: 200% 0; } to { background-position: -200% 0; } }

/* Lists ease in one after another; children past the 12th share the last delay. */
.stagger > * { --i: 11; animation: rise-in var(--dur-enter) var(--ease-soft) both; animation-delay: calc(var(--i) * var(--stagger-step, 40ms)); }
.stagger > :nth-child(1) { --i: 0; }
.stagger > :nth-child(2) { --i: 1; }
.stagger > :nth-child(3) { --i: 2; }
.stagger > :nth-child(4) { --i: 3; }
.stagger > :nth-child(5) { --i: 4; }
.stagger > :nth-child(6) { --i: 5; }
.stagger > :nth-child(7) { --i: 6; }
.stagger > :nth-child(8) { --i: 7; }
.stagger > :nth-child(9) { --i: 8; }
.stagger > :nth-child(10) { --i: 9; }
.stagger > :nth-child(11) { --i: 10; }

/* Starlit sheen on cards + pointer-following glow (pointerGlow.ts sets --mx/--my). */
.card-sheen { position: relative; isolation: isolate; }
.card-sheen::before {
  content: ''; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none;
  background: radial-gradient(120% 70% at 0% 0%, color-mix(in oklab, var(--primary) 8%, transparent), transparent 60%);
}
[data-glow]::after {
  content: ''; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none; opacity: 0;
  transition: opacity var(--dur-hover) var(--ease-soft);
  background: radial-gradient(220px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%);
}
@media (hover: hover) { [data-glow]:hover::after { opacity: 1; } }

/* Loading shimmer: a light sweep (transform only). */
.skeleton-shimmer { position: relative; overflow: hidden; }
.skeleton-shimmer::after {
  content: ''; position: absolute; inset: 0; transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--raised) 75%, transparent), transparent);
  animation: shimmer 1.6s linear infinite;
}

/* Checkbox whose tick pops in (planner, someday, today). */
.check-pop {
  appearance: none; display: inline-grid; place-content: center; border: 1.5px solid currentColor; border-radius: 4px; cursor: pointer;
  transition: background-color var(--dur-hover) var(--ease-soft), border-color var(--dur-hover) var(--ease-soft);
}
.check-pop::before {
  content: ''; width: 0.62em; height: 0.62em; transform: scale(0); background: var(--primary-ink);
  clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
  transition: transform var(--dur-hover) var(--ease-float);
}
.check-pop:checked { background: var(--primary); border-color: var(--primary); }
.check-pop:checked::before { transform: scale(1); }

/* Gradient text that shimmers slowly (Supernova banner). */
.text-shimmer {
  background: linear-gradient(90deg, var(--gold), var(--ink), var(--gold)); background-size: 200% 100%;
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; animation-delay: 0ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tokens motion`
Expected: PASS.

- [ ] **Step 6: Typecheck, lint and build, then commit**

Run: `npm run typecheck && npm run lint && npx vite build`
Expected: clean, and the build succeeds (confirming Tailwind accepts the `@theme` block).

```bash
git add src/styles src/index.css
git commit -m "feat(ui): motion foundation — tokens, keyframes, stagger, shimmer, focus halo, reduced motion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Pointer glow and card sheen

**Files:**
- Create: `src/lib/pointerGlow.ts`
- Modify: `src/main.tsx` (install once), `src/components/ui/Card.tsx`
- Test: `src/lib/pointerGlow.test.ts`

**Interfaces:**
- Produces:
  - `glowPosition(rect: { left: number; top: number }, clientX: number, clientY: number): { mx: string; my: string }`;
  - `installPointerGlow(win?: Window): () => void` (returns uninstall; a no-op when `(hover: hover)` doesn't match or reduced motion is on).
- `Card` gains the `card-sheen` class always, and `data-glow` when `interactive`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pointerGlow.test.ts
import { describe, expect, it, vi } from 'vitest';
import { glowPosition, installPointerGlow } from './pointerGlow';

describe('pointer glow', () => {
  it('converts the pointer to element-relative pixels', () => {
    expect(glowPosition({ left: 100, top: 40 }, 150, 70)).toEqual({ mx: '50px', my: '30px' });
  });
  it('does nothing without hover (touch-only devices) or with reduced motion', () => {
    const add = vi.fn();
    const fake = (hover: boolean, reduce: boolean) => ({
      matchMedia: (q: string) => ({ matches: q.includes('hover') ? hover : reduce }),
      document: { addEventListener: add, removeEventListener: vi.fn() },
      requestAnimationFrame: vi.fn(), cancelAnimationFrame: vi.fn(),
    }) as unknown as Window;
    installPointerGlow(fake(false, false))();
    installPointerGlow(fake(true, true))();
    expect(add).not.toHaveBeenCalled();
    installPointerGlow(fake(true, false))();
    expect(add).toHaveBeenCalledWith('pointermove', expect.any(Function), { passive: true });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run pointerGlow` (Expected: FAIL, module not found)

- [ ] **Step 3: Implement**

```ts
// src/lib/pointerGlow.ts
/** Element-relative pointer position for the [data-glow] radial highlight. */
export function glowPosition(rect: { left: number; top: number }, clientX: number, clientY: number) {
  return { mx: `${Math.round(clientX - rect.left)}px`, my: `${Math.round(clientY - rect.top)}px` };
}

/**
 * One passive, rAF-throttled pointermove listener for the whole app. It moves the glow under the pointer on the
 * nearest [data-glow] element. Off on touch-only devices and with reduced motion.
 */
export function installPointerGlow(win: Window = window): () => void {
  if (!win.matchMedia('(hover: hover)').matches || win.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  let frame = 0;
  let last: PointerEvent | null = null;
  const apply = () => {
    frame = 0;
    const e = last;
    const el = e && (e.target as Element | null)?.closest?.('[data-glow]');
    if (!e || !(el instanceof HTMLElement)) return;
    const { mx, my } = glowPosition(el.getBoundingClientRect(), e.clientX, e.clientY);
    el.style.setProperty('--mx', mx);
    el.style.setProperty('--my', my);
  };
  const onMove = (e: PointerEvent) => { last = e; if (!frame) frame = win.requestAnimationFrame(apply); };
  win.document.addEventListener('pointermove', onMove, { passive: true });
  return () => { win.document.removeEventListener('pointermove', onMove); if (frame) win.cancelAnimationFrame(frame); };
}
```

In `src/main.tsx`, after the existing imports add `import { installPointerGlow } from './lib/pointerGlow';`, and before `createRoot(...)` add `installPointerGlow();`.

Replace `src/components/ui/Card.tsx`'s `Card` with:

```tsx
export function Card({ className, interactive, ...rest }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      data-glow={interactive || undefined}
      className={cn(
        'card-sheen rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-glow',
        interactive && 'transition-[translate,border-color,box-shadow] duration-200 ease-soft hover:-translate-y-0.5 hover:border-line-strong',
        className,
      )}
      {...rest}
    />
  );
}
```

- [ ] **Step 4: Run tests, typecheck and lint**

Run: `npx vitest run pointerGlow && npm run typecheck && npm run lint` (Expected: PASS)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pointerGlow.ts src/lib/pointerGlow.test.ts src/main.tsx src/components/ui/Card.tsx
git commit -m "feat(ui): starlit card sheen and pointer-following glow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: UI kit micro-interactions, count-up and reduced-motion hook

**Files:**
- Create: `src/lib/motion.ts`, `src/lib/countUp.ts`
- Modify:
  - `src/components/ui/Button.tsx`, `Field.tsx`, `Tabs.tsx`, `Switch.tsx`, `Skeleton.tsx`, `EmptyState.tsx`, `Toaster.tsx`, `Progress.tsx`, `PageHeader.tsx`
  - `src/features/study/SessionSummary.tsx` (use the shared count-up)
- Test: `src/lib/countUp.test.ts`, `src/lib/motion.test.ts`

**Interfaces:**
- Produces:
  - `prefersReducedMotion(win?: Window): boolean`, `usePrefersReducedMotion(): boolean`;
  - `countUpValue(target: number, elapsedMs: number, durationMs: number): number`, `useCountUp(target: number, durationMs?: number): number`;
  - `Button` gains `done?: boolean`: it shows a check that pops in, used by settings saves.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/countUp.test.ts
import { describe, expect, it } from 'vitest';
import { countUpValue } from './countUp';

describe('countUpValue', () => {
  it('eases from 0 to the target and lands exactly', () => {
    expect(countUpValue(120, 0, 900)).toBe(0);
    expect(countUpValue(120, 450, 900)).toBeGreaterThan(60); // ease-out: past halfway at half time
    expect(countUpValue(120, 900, 900)).toBe(120);
    expect(countUpValue(120, 5000, 900)).toBe(120);
  });
  it('handles zero, negative and a zero duration', () => {
    expect(countUpValue(0, 300, 900)).toBe(0);
    expect(countUpValue(-40, 900, 900)).toBe(-40);
    expect(countUpValue(75, 0, 0)).toBe(75); // reduced motion jumps to target
  });
});
```

```ts
// src/lib/motion.test.ts
import { describe, expect, it } from 'vitest';
import { prefersReducedMotion } from './motion';

const win = (matches: boolean) => ({ matchMedia: () => ({ matches }) }) as unknown as Window;

describe('prefersReducedMotion', () => {
  it('reads the media query and is false without matchMedia', () => {
    expect(prefersReducedMotion(win(true))).toBe(true);
    expect(prefersReducedMotion(win(false))).toBe(false);
    expect(prefersReducedMotion({} as Window)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run countUp src/lib/motion` (Expected: FAIL, modules not found)

- [ ] **Step 3: Implement the helpers**

```ts
// src/lib/motion.ts
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(win: Window | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  return Boolean(win?.matchMedia?.(QUERY).matches);
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/** Live reduced-motion preference for JS-driven motion (Recharts, count-ups, canvas). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => prefersReducedMotion(), () => false);
}
```

```ts
// src/lib/countUp.ts
import { useEffect, useState } from 'react';
import { prefersReducedMotion } from './motion';

/** Ease-out-cubic count from 0 to `target`; exact at the end. */
export function countUpValue(target: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return target;
  const k = Math.max(0, elapsedMs) / durationMs;
  return Math.round(target * (1 - (1 - k) ** 3));
}

export function useCountUp(target: number, durationMs = 900): number {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const duration = prefersReducedMotion() ? 0 : durationMs;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const v = countUpValue(target, t - t0, duration);
      setShown(v);
      if (v !== target) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return shown;
}
```

In `src/features/study/SessionSummary.tsx`:
- delete the local `function useCountUp(...) { ... }`;
- add `import { useCountUp } from '@/lib/countUp';`;
- keep the call `useCountUp(xp)`.

- [ ] **Step 4: Run the helper tests**

Run: `npx vitest run countUp src/lib/motion` (Expected: PASS)

- [ ] **Step 5: Apply the kit changes**

**`Button.tsx`.** Replace `VARIANTS` and the base class, and add `done`:

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
type Size = 'sm' | 'md' | 'lg' | 'icon';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[linear-gradient(135deg,var(--primary),var(--primary-2))] text-primary-ink shadow-glow hover:-translate-y-px hover:shadow-[0_0_0_4px_var(--primary-soft),var(--glow)]',
  secondary: 'bg-surface-2 text-ink border border-line hover:border-line-strong hover:bg-raised',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-coral-soft text-coral hover:bg-coral hover:text-primary-ink',
  gold: 'bg-gold-soft text-gold hover:-translate-y-px hover:shadow-[0_0_0_4px_var(--gold-soft)]',
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-11 w-11 justify-center',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size; loading?: boolean; done?: boolean }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, done, disabled, className, children, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center rounded-xl font-semibold transition-[translate,scale,box-shadow,background-color,border-color,color,filter] duration-200 ease-soft active:scale-[0.97] active:duration-[120ms] disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant], SIZES[size], className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {done && !loading && <Check className="size-4 animate-pop-in" aria-hidden />}
      {children}
    </button>
  );
});
```

**`Field.tsx`.** In the `control` constant, append `transition-[border-color,box-shadow] duration-200 ease-soft focus:shadow-[0_0_0_4px_var(--primary-soft)]`.

**`Tabs.tsx`.** On the trigger className, append `duration-200 ease-soft data-[state=active]:animate-pop-in`.

**`Switch.tsx`.**
- Root className: replace `transition` with `transition-[background-color,box-shadow] duration-200 ease-soft data-[state=checked]:shadow-[0_0_12px_var(--primary-soft)]`.
- Thumb: replace `transition-transform` with `transition-transform duration-300 ease-float`.

**`Skeleton.tsx`.** Replace the body with:

```tsx
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton-shimmer rounded-xl bg-surface-2', className)} aria-hidden />;
}
```

**`EmptyState.tsx`.** On the `<svg ...>`, add `animate-float` to its className (`'mb-4 h-16 w-32 text-ink-faint animate-float'`).

**`Toaster.tsx`.** Change the toast class string to `'!bg-raised !border !border-line !text-ink !rounded-2xl !shadow-[0_0_0_1px_var(--line),var(--glow)]'`.

**`Progress.tsx`.**
- `ProgressBar` inner div: add `origin-left animate-grow-x`.
- `ProgressRing` second circle: replace `strokeDasharray={`${c * v} ${c}`}` with `strokeDasharray={c} strokeDashoffset={c * (1 - v)}`. Add `className="ring-fill"` and `style={{ ['--ring-c' as string]: c } as CSSProperties}`, with `import type { CSSProperties } from 'react'` added to the file.
- Append to `src/index.css`:

  ```css
  .ring-fill { transition: stroke-dashoffset 600ms var(--ease-soft); animation: ring-in 700ms var(--ease-soft) both; }
  @keyframes ring-in { from { stroke-dashoffset: var(--ring-c); } }
  ```

**`PageHeader.tsx`.** Replace the `<h1>` line with:

```tsx
<h1 className="font-display text-3xl leading-tight">{title}</h1>
<span aria-hidden className="mt-2 flex items-center gap-1.5">
  <span className="block h-0.5 w-16 origin-left animate-grow-x rounded-full bg-[linear-gradient(90deg,var(--primary),var(--gold))]" />
  <svg viewBox="0 0 24 24" className="size-2.5 animate-twinkle text-gold"><path d="M12 2c.6 4.4 1.9 5.7 6.3 6.3-4.4.6-5.7 1.9-6.3 6.3-.6-4.4-1.9-5.7-6.3-6.3C10.1 7.7 11.4 6.4 12 2z" fill="currentColor" /></svg>
</span>
```

- [ ] **Step 6: Run the gate**

Run: `npm test && npm run typecheck && npm run lint` (Expected: all green)

- [ ] **Step 7: Commit**

```bash
git add src/lib/motion.ts src/lib/motion.test.ts src/lib/countUp.ts src/lib/countUp.test.ts src/components/ui src/features/study/SessionSummary.tsx src/index.css
git commit -m "feat(ui): kit micro-interactions, shimmer skeletons, header accent, count-up and reduced-motion hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Overlay motion (Dialog, Sheet, Menu, command palette)

**Files:** Modify `src/components/ui/Dialog.tsx`, `Sheet.tsx`, `Menu.tsx`, `src/app/CommandPalette.tsx`

**Interfaces:**
- Consumes the Task 1 animations.
- Radix keeps exiting content mounted until its `animationend`. Cleanup is done by Radix; no state is needed.

- [ ] **Step 1: Dialog**

- Overlay className: append `data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out`.
- Content className array: add `'data-[state=open]:animate-sheet-up data-[state=closed]:animate-sheet-down sm:data-[state=open]:animate-pop-in sm:data-[state=closed]:animate-pop-out'`, and remove `animate-rise`.

- [ ] **Step 2: Sheet**

Replace `SIDES` with the side-specific motion:

```tsx
const SIDES = {
  bottom: 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-3xl pb-[calc(1.25rem+env(safe-area-inset-bottom))] data-[state=open]:animate-sheet-up data-[state=closed]:animate-sheet-down',
  right: 'inset-y-0 right-0 h-full w-[min(420px,100%)] rounded-l-3xl data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right',
  left: 'inset-y-0 left-0 h-full w-[min(360px,100%)] rounded-r-3xl data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left',
} as const;
```

On the overlay, append `data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out`. On the content, remove `animate-rise`.

- [ ] **Step 3: Menu**

- Content className: append `origin-[var(--radix-dropdown-menu-content-transform-origin)] data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out`.
- Item className: append `transition-colors duration-150`.

- [ ] **Step 4: Command palette**

- `overlayClassName`: append `data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out`.
- `contentClassName`: append `data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out`.
- `itemClass`: append `transition-[background-color,translate] duration-150 data-[selected=true]:translate-x-0.5`.

- [ ] **Step 5: Run the gate and commit**

Run: `npm run typecheck && npm run lint && npm test` (Expected: green)

```bash
git add src/components/ui/Dialog.tsx src/components/ui/Sheet.tsx src/components/ui/Menu.tsx src/app/CommandPalette.tsx
git commit -m "feat(ui): enter/exit motion for dialogs, sheets, menus and the command palette

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: App shell (page entrance, navigation accents, logo, banners)

**Files:**
- Create: `src/app/pageKey.ts`
- Modify:
  - `src/app/AppShell.tsx`, `Sidebar.tsx`, `MobileTabs.tsx`, `MoreSheet.tsx`, `OfflineBanner.tsx`
  - `src/components/sky/Logo.tsx`
  - `src/features/study/SessionRunner.tsx` (overlay fade)
- Test: `src/app/pageKey.test.ts`

**Interfaces:**
- Produces `pageKey(matches: { id: string }[]): string`: the deepest matched route id, or `'root'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/pageKey.test.ts
import { describe, expect, it } from 'vitest';
import { pageKey } from './pageKey';

// Review Focus #2: same-route navigations must not remount (tutor chat creation, note-to-note, planner views).
describe('pageKey', () => {
  it('uses the deepest matched route id', () => {
    expect(pageKey([{ id: '0' }, { id: '0-1' }, { id: '0-1-7' }])).toBe('0-1-7');
  });
  it('is identical for /tutor and /tutor/:id (one optional-segment route)', () => {
    const tutor = [{ id: '0' }, { id: '0-1' }, { id: '0-1-12' }];
    expect(pageKey(tutor)).toBe(pageKey([...tutor]));
  });
  it('falls back to root', () => {
    expect(pageKey([])).toBe('root');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run pageKey` (Expected: FAIL)

- [ ] **Step 3: Implement**

```ts
// src/app/pageKey.ts
/** Key for the page-entrance wrapper: changes only when a different route renders (not on params or query). */
export const pageKey = (matches: readonly { id: string }[]) => matches.at(-1)?.id ?? 'root';
```

**`AppShell.tsx`.**
- Import `useMatches` from `react-router` and `pageKey` from `./pageKey`.
- Inside `AppShell`, add `const key = pageKey(useMatches());`.
- Replace `<Outlet />` with `<div key={key} className="animate-page-in"><Outlet /></div>`.

**`Sidebar.tsx`.**
- `<aside>` className: append `transition-[width] duration-300 ease-soft`.
- NavLink inner content: render, after the label, `{isActive && <span aria-hidden className="ml-auto size-1.5 animate-pop-in rounded-full bg-gold shadow-[0_0_8px_var(--gold)]" />}`. NavLink `children` accepts a function `({ isActive }) => ...`; convert the existing children to that form.
- Hover background transition: append `transition-colors duration-200` to the link class.

**`MobileTabs.tsx`.**
- NavLink className: append `relative transition-colors duration-200`.
- Children become a function:

  ```tsx
  {({ isActive }) => (<>
    {isActive && <span aria-hidden className="absolute inset-x-4 top-0 h-0.5 origin-center animate-grow-x rounded-full bg-primary" />}
    <Icon className={cn('size-5 transition-[filter]', isActive && 'drop-shadow-[0_0_6px_var(--primary)]')} aria-hidden />
    <span className="max-w-full truncate px-0.5">{label}</span>
  </>)}
  ```

**`MoreSheet.tsx`.** Add `stagger` to the className of the container that holds the link grid or list.

**`OfflineBanner.tsx`.** Append `animate-[banner-in_320ms_var(--ease-soft)_both]` to the banner, and add `@keyframes banner-in { from { transform: translateY(-100%); } to { transform: none; } }` to `src/index.css`.

**`Logo.tsx`.** Wrap the ellipse in `<g className="logo-orbit" style={{ transformOrigin: '32px 32px' }}>`. Append to `src/index.css`:

```css
@media (hover: hover) { a:hover .logo-orbit, .logo-orbit-auto .logo-orbit { animation: orbit-spin 1.2s var(--ease-soft) 1; } }
.logo-orbit-slow .logo-orbit { animation: orbit-spin 24s linear infinite; }
```

**`SessionRunner.tsx`.** Root overlay className: append `animate-fade-in`.

- [ ] **Step 4: Run the gate and commit**

Run: `npx vitest run pageKey && npm test && npm run typecheck && npm run lint` (Expected: green)

```bash
git add src/app src/components/sky/Logo.tsx src/features/study/SessionRunner.tsx src/index.css
git commit -m "feat(ui): page entrances, nav accents, logo orbit, banner motion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Auth (sky hero, split screen, star strength meter, password fields, feedback)

**Files:**
- Create: `src/features/auth/passwordStrength.ts`, `src/features/auth/AuthLayout.tsx`, `src/features/auth/PasswordInput.tsx`
- Modify: `src/features/auth/LoginPage.tsx`, `SignUpPage.tsx`, `SetPasswordPage.tsx`, `src/features/onboarding/OnboardingPage.tsx` (import `StarBackdrop` from `AuthLayout`)
- Test: `src/features/auth/passwordStrength.test.ts`

**Interfaces:**
- Produces:
  - `passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 | 5` and `STRENGTH_LABELS: readonly string[]` (index = score);
  - `<AuthLayout title subtitle? children />` (desktop split with the sky hero, phone sky band);
  - `<PasswordInput id value onChange autoComplete invalid? showStrength? />`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/auth/passwordStrength.test.ts
import { describe, expect, it } from 'vitest';
import { passwordStrength, STRENGTH_LABELS } from './passwordStrength';

describe('passwordStrength', () => {
  it.each([
    ['', 0], ['abc', 0], ['abcdefgh', 1], ['abcdefghijkl', 2], ['abcdefghIJKL', 3], ['abcdefghIJK1', 4], ['abcdefghIJ1!', 5],
  ] as const)('%j → %i', (pw, score) => {
    expect(passwordStrength(pw)).toBe(score);
  });
  it('has a label per score', () => {
    expect(STRENGTH_LABELS).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run passwordStrength` (Expected: FAIL)

- [ ] **Step 3: Implement the strength scoring**

```ts
// src/features/auth/passwordStrength.ts
export const STRENGTH_LABELS = ['', 'Faint', 'Dim', 'Bright', 'Brilliant', 'Supernova'] as const;

/** 0–5 stars. Under 8 characters scores 0, since sign-up requires 8. */
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 | 5 {
  if (pw.length < 8) return 0;
  let s = 1;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(5, s) as 0 | 1 | 2 | 3 | 4 | 5;
}
```

Run: `npx vitest run passwordStrength` (Expected: PASS)

- [ ] **Step 4: Build `PasswordInput`**

```tsx
// src/features/auth/PasswordInput.tsx
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/Field';
import { passwordStrength, STRENGTH_LABELS } from './passwordStrength';

const STAR = 'M12 2c.6 4.4 1.9 5.7 6.3 6.3-4.4.6-5.7 1.9-6.3 6.3-.6-4.4-1.9-5.7-6.3-6.3C10.1 7.7 11.4 6.4 12 2z';

export function PasswordInput({ id, value, onChange, autoComplete, invalid, showStrength }: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; showStrength?: boolean;
}) {
  const [show, setShow] = useState(false);
  const score = passwordStrength(value);
  return (
    <div>
      <div className="relative">
        <Input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} invalid={invalid} value={value}
          onChange={(e) => onChange(e.target.value)} className="pr-11" />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1 grid size-9 place-items-center rounded-lg text-ink-faint transition-colors hover:text-ink">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {showStrength && value && (
        <div className="mt-2 flex items-center gap-2" aria-live="polite">
          <span className="flex gap-1" aria-hidden>
            {[1, 2, 3, 4, 5].map((n) => (
              <svg key={n} viewBox="0 0 24 24" className={cn('size-3.5 transition-[color,transform,filter] duration-300 ease-float',
                n <= score ? 'scale-110 text-gold drop-shadow-[0_0_4px_var(--gold)]' : 'text-line-strong')}>
                <path d={STAR} fill="currentColor" />
              </svg>
            ))}
          </span>
          <span className="text-xs text-ink-muted">{score === 0 ? 'At least 8 characters' : `${STRENGTH_LABELS[score]} password`}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Build `AuthLayout` with the sky hero**

```tsx
// src/features/auth/AuthLayout.tsx
import type { ReactNode } from 'react';
import { Logo } from '@/components/sky/Logo';
import { Card } from '@/components/ui/Card';

/** Moved here from LoginPage.tsx (unchanged body) so auth pages and onboarding share it without a circular import. */
export function StarBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: [
            'radial-gradient(1px 1px at 12% 18%, var(--sky-star), transparent)',
            'radial-gradient(1px 1px at 72% 12%, var(--sky-star), transparent)',
            'radial-gradient(1.5px 1.5px at 38% 62%, var(--sky-star), transparent)',
            'radial-gradient(1px 1px at 88% 48%, var(--sky-star), transparent)',
            'radial-gradient(1px 1px at 22% 82%, var(--sky-star), transparent)',
            'radial-gradient(1.5px 1.5px at 58% 30%, var(--sky-star), transparent)',
            'radial-gradient(1px 1px at 92% 86%, var(--sky-star), transparent)',
            'radial-gradient(1px 1px at 6% 52%, var(--sky-star), transparent)',
          ].join(','),
        }}
      />
      <svg className="absolute right-[12%] top-[14%] size-6 animate-twinkle" viewBox="0 0 24 24" style={{ transformOrigin: 'center' }}>
        <path d="M12 2c.6 4.4 1.9 5.7 6.3 6.3-4.4.6-5.7 1.9-6.3 6.3-.6-4.4-1.9-5.7-6.3-6.3C10.1 7.7 11.4 6.4 12 2z" fill="var(--gold)" />
      </svg>
    </div>
  );
}

/** A ring of gold sparks shown for ~450 ms after a successful log-in or sign-up. */
export function StarBurst() {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 m-auto size-40">
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <circle key={i} cx={50 + Math.cos(a) * 34} cy={50 + Math.sin(a) * 34} r="2.2" fill="var(--gold)"
          className="animate-pop-in" style={{ animationDelay: `${i * 30}ms`, transformOrigin: '50px 50px' }} />;
      })}
    </svg>
  );
}

/**
 * Two stars ("you" and "your person"), a constellation line that draws in between them, drifting dust and a rare
 * shooting star. Desktop: the left half. Phone: a band above the form.
 */
function AuthSky({ compact }: { compact?: boolean }) {
  return (
    <div aria-hidden className="relative h-full w-full overflow-hidden">
      <div className="study-starfield absolute inset-0" />
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <path d="M120 190 Q 200 120 285 150" fill="none" stroke="var(--line-strong)" strokeWidth="1.2" pathLength={1}
          strokeDasharray="1" className="animate-draw-line" style={{ animationDelay: '400ms' }} />
        <g className="animate-pop-in" style={{ animationDelay: '150ms', transformOrigin: '120px 190px' }}>
          <circle cx="120" cy="190" r="16" fill="var(--star-me)" opacity=".18" />
          <circle cx="120" cy="190" r="5" fill="var(--star-me)" style={{ filter: 'drop-shadow(0 0 8px var(--star-me))' }} />
        </g>
        <g className="animate-pop-in" style={{ animationDelay: '900ms', transformOrigin: '285px 150px' }}>
          <circle cx="285" cy="150" r="16" fill="var(--star-partner)" opacity=".18" />
          <circle cx="285" cy="150" r="5" fill="var(--star-partner)" style={{ filter: 'drop-shadow(0 0 8px var(--star-partner))' }} />
        </g>
        {!compact && (<>
          <text x="120" y="222" textAnchor="middle" fontSize="11" fill="var(--ink-muted)">you</text>
          <text x="285" y="182" textAnchor="middle" fontSize="11" fill="var(--ink-muted)">your person</text>
        </>)}
        <line x1="0" y1="0" x2="60" y2="22" stroke="var(--sky-star)" strokeWidth="1.2" strokeLinecap="round" className="shooting-star" />
      </svg>
      {!compact && (
        <div className="absolute inset-x-10 bottom-12">
          <p className="font-display text-3xl leading-tight">A study sky for two.</p>
          <p className="mt-2 max-w-sm text-ink-muted">Every session adds a star. Notes, cards, quizzes and Nova, shared with your person.</p>
        </div>
      )}
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      <StarBackdrop />
      <div className="relative hidden border-r border-line bg-surface/40 lg:block"><AuthSky /></div>
      <div className="relative h-44 lg:hidden"><AuthSky compact /></div>
      <div className="relative z-10 -mt-10 grid place-items-center px-4 pb-10 lg:mt-0 lg:py-10">
        <Card className="w-full max-w-sm animate-rise-in">
          <Logo className="logo-orbit-slow" />
          {children}
        </Card>
      </div>
    </main>
  );
}
```

Append to `src/index.css`:

```css
/* Auth sky: a rare shooting star (one pass every ~12 s). */
.shooting-star { opacity: 0; }
@media (prefers-reduced-motion: no-preference) {
  .shooting-star { animation: shooting-star 12s ease-in 2s infinite; }
}
@keyframes shooting-star {
  0%, 92% { opacity: 0; transform: translate(40px, 20px); }
  94% { opacity: .9; }
  100% { opacity: 0; transform: translate(300px, 130px); }
}
```

- [ ] **Step 6: Use the layout and fields on the auth pages**

**`LoginPage.tsx`.**
- Replace the `<main>…<Card>` wrapper with `<AuthLayout>`, keeping the inner content. Remove the now-duplicated `<Logo />` and the `<StarBackdrop />` in this page.
- Replace the password `Field` child with `{(id) => <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="current-password" />}`, and remove the `show` state and the `Eye`/`EyeOff` imports.
- Add `const [shakeKey, setShakeKey] = useState(0);`. In the `catch`, add `setShakeKey((k) => k + 1);`. Give the `<form>` `key={shakeKey}` and the className `shakeKey ? 'animate-shake' : ''` (merged with the existing classes via `cn`).
- On success, before `navigate`, show the star burst. Add `const [burst, setBurst] = useState(false);`. On success, `setBurst(true); await new Promise((r) => setTimeout(r, prefersReducedMotion() ? 0 : 450));`, then navigate. Render `{burst && <StarBurst />}` inside the form area. `StarBurst` is imported from `./AuthLayout`.
- Delete `StarBackdrop` from `LoginPage.tsx`. Its body now lives in `AuthLayout.tsx`. Update `OnboardingPage.tsx` to `import { StarBackdrop } from '@/features/auth/AuthLayout'`.

**`SignUpPage.tsx`.**
- Same `AuthLayout` wrapper.
- Password field: `<PasswordInput id={id} value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} autoComplete="new-password" invalid={Boolean(errors.password)} showStrength />`, and remove the field's `hint`.
- Confirm field: `<PasswordInput ... autoComplete="new-password" invalid={Boolean(errors.confirm)} />`.
- Same shake on `error` and the burst on success.

**`SetPasswordPage.tsx`.** Same `AuthLayout`. Use `PasswordInput` with `showStrength` for "New password", and `PasswordInput` for "Confirm password".

- [ ] **Step 7: Run the gate and commit**

Run: `npx vitest run passwordStrength && npm test && npm run typecheck && npm run lint` (Expected: green)

```bash
git add src/features/auth src/index.css
git commit -m "feat(auth): sky hero split screen, star strength meter, password show/hide, shake and star-burst feedback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Onboarding (constellation stepper, sliding steps, star preview, finish settle)

**Files:** Modify `src/features/onboarding/OnboardingPage.tsx`

**Interfaces:** Consumes `prefersReducedMotion` (Task 3) and the Task 1 animations.

- [ ] **Step 1: Animated stepper**

Replace `StepStars` with this version. Line segments up to the current step draw in, and the current star pops and pulses:

```tsx
function StepStars({ step }: { step: number }) {
  const pts: [number, number][] = [[10, 16], [60, 6], [110, 14], [150, 8]];
  return (
    <svg viewBox="0 0 160 24" className="h-6 w-40" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
      {pts.slice(1).map(([x, y], i) => {
        const [px, py] = pts[i]!;
        const lit = i < step;
        return (
          <line key={i} x1={px} y1={py} x2={x} y2={y} stroke={lit ? 'var(--gold)' : 'var(--line-strong)'} strokeWidth="1"
            pathLength={1} strokeDasharray="1" className={lit ? 'animate-draw-line' : undefined} />
        );
      })}
      {pts.map(([x, y], i) => (
        <circle key={`${i}-${i <= step}`} cx={x} cy={y} r={i <= step ? 4 : 3} fill={i <= step ? 'var(--gold)' : 'var(--ink-faint)'}
          className={i === step ? 'animate-pop-in' : undefined}
          style={i <= step ? { filter: 'drop-shadow(0 0 6px var(--gold))', transformOrigin: `${x}px ${y}px` } : undefined} />
      ))}
    </svg>
  );
}
```

- [ ] **Step 2: Sliding steps**

- Track the direction: `const [dir, setDir] = useState<1 | -1>(1);`. The Back handler sets `setDir(-1)` before changing the step; Next sets `setDir(1)`.
- Wrap the step content `<div className="mt-5 min-h-48">` with `key={step}`, and add the class `dir === 1 ? 'animate-[slide-in-right_320ms_var(--ease-soft)_both]' : 'animate-[slide-in-left_320ms_var(--ease-soft)_both]'`.
- These keyframes translate 100%, which is too far inside a card. Add two gentler keyframes to `src/index.css`:

  ```css
  @keyframes step-in-right { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
  @keyframes step-in-left { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: none; } }
  ```

  Then use `animate-[step-in-right_320ms_var(--ease-soft)_both]` and `animate-[step-in-left_320ms_var(--ease-soft)_both]`.
- The card gets `overflow-hidden`, and the page `<main>` gets `animate-page-in` (pages outside the app shell enter the same way).

- [ ] **Step 3: Live star preview and finish settle**

In step 1, add a central "your star" above the twinkles: `<span className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[background-color,box-shadow] duration-300" style={{ background: color, boxShadow: `0 0 18px 4px ${color}` }} />`.

For the finish settle:
- add `const [settling, setSettling] = useState(false);`;
- in `finish()`, after `await refreshProfile();`, call `setSettling(true); await new Promise((r) => setTimeout(r, prefersReducedMotion() ? 0 : 900));` before the toast and navigate;
- render, when `settling`, an absolutely positioned overlay inside the card:

  ```tsx
  {settling && (
    <div aria-hidden className="absolute inset-0 z-10 grid place-items-center rounded-[inherit] bg-surface/90 animate-fade-in">
      <span className="size-5 animate-pop-in rounded-full" style={{ background: color, boxShadow: `0 0 24px 6px ${color}` }} />
      <p className="absolute bottom-8 font-display text-lg animate-rise-in" style={{ animationDelay: '200ms' }}>Your star is in the sky ✦</p>
    </div>
  )}
  ```

  The card gets `relative` (it already has `card-sheen`, which is relative).

- [ ] **Step 4: Run the gate and commit**

Run: `npm test && npm run typecheck && npm run lint` (Expected: green)

```bash
git add src/features/onboarding src/index.css
git commit -m "feat(onboarding): constellation stepper, sliding steps, live star preview and finish settle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Dashboard (sky reveal, count-ups, comet shimmer, widget stagger)

**Files:**
- Create: `src/components/sky/reveal.ts`
- Modify:
  - `src/components/sky/StarField.tsx`, `src/components/sky/Comet.tsx`
  - `src/features/dashboard/YourSky.tsx`, `DashboardPage.tsx`, `NovaRecommendations.tsx`
- Test: `src/components/sky/reveal.test.ts`

**Interfaces:**
- Produces `revealAlpha(index: number, count: number, elapsedMs: number, durationMs: number): number` (0..1).
- `StarField` gains `reveal?: boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/sky/reveal.test.ts
import { describe, expect, it } from 'vitest';
import { revealAlpha } from './reveal';

describe('revealAlpha', () => {
  it('lights stars one after another across the duration', () => {
    expect(revealAlpha(0, 10, 0, 800)).toBe(0);
    expect(revealAlpha(0, 10, 200, 800)).toBe(1);
    expect(revealAlpha(9, 10, 200, 800)).toBe(0);
    expect(revealAlpha(9, 10, 800, 800)).toBe(1);
  });
  it('is fully lit for zero duration or a single star', () => {
    expect(revealAlpha(3, 10, 0, 0)).toBe(1);
    expect(revealAlpha(0, 1, 800, 800)).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run reveal` (Expected: FAIL)

- [ ] **Step 3: Implement**

```ts
// src/components/sky/reveal.ts
const FADE_MS = 200;

/** Opacity multiplier for star `index` while the sky draws in: each star starts a little later and fades in over 200 ms. */
export function revealAlpha(index: number, count: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  const start = count > 1 ? (index / (count - 1)) * (durationMs - FADE_MS) : 0;
  return Math.min(1, Math.max(0, (elapsedMs - start) / FADE_MS));
}
```

In `StarField.tsx`:
- add the prop `reveal?: boolean` (default `false`) and `const reduce = usePrefersReducedMotion();`;
- in the draw effect, compute `const revealMs = reveal && !reduce ? 800 : 0; const t0 = performance.now();`;
- in `draw(t)`, multiply each star's `globalAlpha` by `revealAlpha(i, sky.stars.length, t - t0, revealMs)` (use the index from `sky.stars.forEach((s, i) => ...)`);
- multiply the line alpha by `revealAlpha(sky.stars.length - 1, sky.stars.length, t - t0, revealMs)` so lines appear last;
- the loop condition becomes `motion && (sky.stars.some((s) => s.twinkle) || revealMs > 0)`;
- when only revealing, stop requesting frames once `t - t0 > revealMs + 50` and no star twinkles.

`draw` receives `t` from `requestAnimationFrame`, which is on the same clock as `performance.now()`.

- [ ] **Step 4: Dashboard touches**

**`YourSky.tsx`.**
- Pass `reveal` to `StarField`.
- Greeting block: add `animate-rise-in`.
- Total focus: `<strong>{formatDuration(useCountUp(focus))}</strong>`. Call `const shownFocus = useCountUp(focus);` at the top of the component, since hooks must not be inside JSX conditionals.

**`Comet.tsx`.**
- On the tail `<path>`, add `className="comet-tail"`.
- Append to `src/index.css`:

  ```css
  @media (prefers-reduced-motion: no-preference) { .comet-tail { animation: comet-shimmer 3.2s ease-in-out infinite; } }
  @keyframes comet-shimmer { 0%, 100% { opacity: .8; } 50% { opacity: 1; } }
  ```

**`DashboardPage.tsx`.** Add `stagger` to the root grid className (the `Slot` divs are its direct children).

**`NovaRecommendations.tsx`.** Add `stagger` to the items `<ul>`.

- [ ] **Step 5: Run the gate and commit**

Run: `npx vitest run reveal && npm test && npm run typecheck && npm run lint` (Expected: green)

```bash
git add src/components/sky src/features/dashboard src/index.css
git commit -m "feat(dashboard): sky draw-in, focus count-up, comet shimmer and staggered widgets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Notes (grid, glow, pinned twinkle, toolbar, save indicator, Nova reveal)

**Files:**
- Modify:
  - `src/features/notes/NotesPage.tsx`, `NoteCard.tsx`, `NoteEditorPage.tsx`, `editor/Toolbar.tsx`, `NoteAiPanel.tsx`
  - `src/features/ai/MarkdownView.tsx`
- Create: `src/features/notes/SaveIndicator.tsx`

**Interfaces:**
- `MarkdownView` gains `reveal?: boolean`, which adds `stagger` with `--stagger-step: 60ms` to the prose container.
- `SaveIndicator({ status, onRetry })` replaces the inline status span.

- [ ] **Step 1: List and card**

- **`NotesPage.tsx`:** the non-skeleton grid `<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">` (around line 125) gets `stagger`.
- **`NoteCard.tsx`:** render its `Card` with `interactive`. If it uses a Link wrapper with its own hover classes, keep the link and add `interactive` to the inner Card. The pinned icon gets `animate-twinkle`.

- [ ] **Step 2: Save indicator**

```tsx
// src/features/notes/SaveIndicator.tsx
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { SaveStatus } from './autosaver';

export function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-1.5 text-xs', status === 'error' ? 'text-coral' : 'text-ink-faint')}>
      {(status === 'pending' || status === 'saving') && <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-primary" />}
      {status === 'saved' && <Check aria-hidden className="size-3.5 animate-pop-in text-teal" />}
      {status === 'pending' ? 'Unsaved…' : status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? "Couldn't save" : ''}
      {status === 'error' && <button onClick={onRetry} className="underline">Retry</button>}
    </span>
  );
}
```

In `NoteEditorPage.tsx`:
- replace the `{editable && (<span role="status" …>{STATUS[...]}…</span>)}` block with `{editable && <SaveIndicator status={autosave.status} onRetry={autosave.retry} />}`;
- delete the now-unused `STATUS` constant and the `cn` import if it's unused.

- [ ] **Step 3: Toolbar and Nova reveal**

- **`editor/Toolbar.tsx`:** the root element gets `animate-fade-in`.
- **`MarkdownView.tsx`:** add `reveal?: boolean` to the props. The wrapper becomes `<div className={cn('prose-ss', reveal && 'stagger [--stagger-step:60ms]', className)}>`.
- **`NoteAiPanel.tsx`:**
  - pass `reveal` to the result `MarkdownView`;
  - the result `Card`s get `animate-rise-in`;
  - the action list container `<div className="-mx-1 flex flex-col gap-0.5">` gets `stagger [--stagger-step:30ms]`.

- [ ] **Step 4: Run the gate and commit**

Run: `npm test && npm run typecheck && npm run lint` (Expected: green)

```bash
git add src/features/notes src/features/ai/MarkdownView.tsx
git commit -m "feat(notes): staggered grid, glowing cards, save indicator morph and Nova paragraph reveal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Flashcards (deck constellations, 3D flip depth, card enter/exit by grade, summary stars)

**Files:**
- Create: `src/features/flashcards/exitGate.ts`
- Modify: `src/features/flashcards/DeckConstellation.tsx`, `DecksPage.tsx`, `FlipCard.tsx`, `ReviewSession.tsx`, `ReviewSummary.tsx`, `src/index.css`
- Test: `src/features/flashcards/exitGate.test.ts`

**Interfaces:**
- Produces `createExitGate(delayMs: number): { run(fn: () => void): boolean; get busy(): boolean }`. `run` returns false (and ignores `fn`) while a previous exit is pending.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/flashcards/exitGate.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createExitGate } from './exitGate';

// Review Focus #3: pressing 3 then 4 during the exit animation grades the card once.
describe('createExitGate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs the action after the delay and ignores presses meanwhile', () => {
    const gate = createExitGate(220);
    const grade = vi.fn();
    expect(gate.run(() => grade(2))).toBe(true);
    expect(gate.run(() => grade(3))).toBe(false);
    expect(gate.busy).toBe(true);
    vi.advanceTimersByTime(219);
    expect(grade).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(grade).toHaveBeenCalledExactlyOnceWith(2);
    expect(gate.busy).toBe(false);
    expect(gate.run(() => grade(1))).toBe(true);
  });

  it('runs immediately with no delay (reduced motion)', () => {
    const gate = createExitGate(0);
    const grade = vi.fn();
    gate.run(() => grade(0));
    expect(grade).toHaveBeenCalledOnce();
    expect(gate.busy).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run exitGate` (Expected: FAIL)

- [ ] **Step 3: Implement**

```ts
// src/features/flashcards/exitGate.ts
/** Lets a graded card play its exit before the next card, ignoring extra presses until it has gone. */
export function createExitGate(delayMs: number) {
  let busy = false;
  return {
    run(fn: () => void): boolean {
      if (busy) return false;
      if (delayMs <= 0) { fn(); return true; }
      busy = true;
      setTimeout(() => { busy = false; fn(); }, delayMs);
      return true;
    },
    get busy() { return busy; },
  };
}
```

Run: `npx vitest run exitGate` (Expected: PASS)

- [ ] **Step 4: Review session motion**

In `ReviewSession.tsx`:
- add `const [gate] = useState(() => createExitGate(prefersReducedMotion() ? 0 : 220));` and `const [leaving, setLeaving] = useState<Grade | null>(null);`;
- wrap grading. Define `const gradeOut = (g: Grade) => { if (gate.run(() => { setLeaving(null); grade(g); })) setLeaving(g); };`. Use `gradeOut` everywhere `grade(` is called from the UI or keyboard: the grade buttons, keys 1–4 and Enter;
- wrap `<FlipCard …/>` in `<div key={card.id} className={cn(leaving === null ? 'animate-[card-in_320ms_var(--ease-soft)_both]' : 'animate-[card-out_220ms_var(--ease-soft)_both]', leaving !== null && GRADE_TINT[leaving])}>`, with `const GRADE_TINT: Record<Grade, string> = { 0: 'card-tint-coral', 1: 'card-tint-gold', 2: 'card-tint-primary', 3: 'card-tint-teal' };`;
- the choice buttons: the correct one gets `animate-pop-in` when `chosen !== null && isRight`; a wrong pick gets `animate-shake`.

Append to `src/index.css`:

```css
@keyframes card-in { from { opacity: 0; transform: translateX(24px) rotate(1deg); } to { opacity: 1; transform: none; } }
@keyframes card-out { to { opacity: 0; transform: translateX(-32px) rotate(-2deg); } }
.card-tint-coral .flip-face { box-shadow: 0 0 0 2px var(--coral), var(--glow); }
.card-tint-gold .flip-face { box-shadow: 0 0 0 2px var(--gold), var(--glow); }
.card-tint-primary .flip-face { box-shadow: 0 0 0 2px var(--primary), var(--glow); }
.card-tint-teal .flip-face { box-shadow: 0 0 0 2px var(--teal), var(--glow); }
/* 3D flip with depth: the card lifts while turning. */
.flip-inner { transition: transform 0.55s var(--ease-soft), filter 0.55s var(--ease-soft); }
.flip-inner[data-revealed="true"] { filter: drop-shadow(0 18px 24px rgb(5 8 26 / 0.25)); }
```

The existing `.flip-inner` transition line is replaced by this one.

- [ ] **Step 5: Constellations and summary**

**`DeckConstellation.tsx`.**
- The polyline gets `pathLength={1} strokeDasharray="1" className={draw ? 'constellation-line animate-draw-line' : 'constellation-line'}`, with a new prop `draw?: boolean` (default `true` for `lg`, `false` for `sm`).
- Circles get `className={cn(states[i] === 'mastered' && 'animate-twinkle', draw && 'animate-pop-in')}`, with `animationDelay: `${Math.min(i, 24) * 25}ms``.
- Append to `src/index.css`: `@media (hover: hover) { .group:hover .constellation-line { animation: draw-line 1.2s var(--ease-soft) both; } }`.

**`DecksPage.tsx`.** The deck grid (around line 115) gets `stagger`. Each deck card's wrapper gets `group` and `interactive` on its Card.

**`ReviewSummary.tsx`.**
- Light one star per card reviewed, capped at 12: replace `Array.from({ length: 7 }…)` with `Array.from({ length: Math.min(12, Math.max(1, data.reviewed)) }…)`, using `className="animate-pop-in absolute size-5"` and `animationDelay: `${i * 90}ms``. Spread the positions across `w-64`: `left: `${(i / Math.max(1, Math.min(12, data.reviewed) - 1)) * 90}%``.
- Count the tile values up: create `function Tile({ label, value, suffix = '', cls }: { label: string; value: number; suffix?: string; cls?: string })`, which calls `useCountUp(value)`, and use it for all four tiles. Accuracy passes `value={Math.round(data.accuracy * 100)} suffix="%"`, and XP passes a `+` prefix in the label rendering.
- The tile grid gets `stagger`.

- [ ] **Step 6: Run the gate and commit**

Run: `npm test && npm run typecheck && npm run lint` (Expected: green)

```bash
git add src/features/flashcards src/index.css
git commit -m "feat(flashcards): constellation draw-in, deeper flip, grade-tinted card exit, starry summary

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Quizzes (question transitions, answer feedback, results reveal)

**Files:** Modify `src/features/quizzes/QuizzesPage.tsx`, `QuizRunner.tsx`, `ResultsPage.tsx`, `ResultsSky.tsx`

- [ ] **Step 1: List and runner**

- **`QuizzesPage.tsx`:** the quiz grid (around line 109) gets `stagger`, and quiz cards get `interactive`.
- **`QuizRunner.tsx`:**
  - the question `Card` gets `key={q.id}` and `className="animate-[step-in-right_320ms_var(--ease-soft)_both]"` (keyframe from Task 7);
  - option buttons, when `locked`, add `right && 'animate-pop-in'` and `picked && !right && 'animate-shake'`. Right options also show `<Check className="ml-auto inline size-4" />` (import `Check` from lucide). Their className becomes `flex items-center gap-2`, with the existing number span kept;
  - the feedback box gets `animate-rise-in`.

- [ ] **Step 2: Results**

**`ResultsPage.tsx`.**
- `const shownScore = useCountUp(a.score)` (computed after the guards: move the `a` dependency by calling `useCountUp(q.data?.score ?? 0)` at the top with the other hooks).
- Render `{shownScore}/{a.total}`.
- The perfect banner `<div …>Supernova!…</div>`: wrap the text in `<span className="text-shimmer animate-shimmer-text">`.
- The topic `grid gap-4 sm:grid-cols-3` gets `stagger`.

**`ResultsSky.tsx`.**
- Answer circles get `className="animate-pop-in"`, with `style={{ animationDelay: `${Math.min(index, 30) * 50}ms`, transformOrigin: `${x}px ${y}px` }}`. Add `index` from `answers.map((a, index) => …)`. For gold circles, merge the existing `filter` style.
- Topic halos get `animate-fade-in`.

- [ ] **Step 3: Run the gate and commit**

Run: `npm test && npm run typecheck && npm run lint` (Expected: green)

```bash
git add src/features/quizzes
git commit -m "feat(quizzes): question transitions, correct/wrong feedback, results count-up and sequential sky

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Tutor (message rise, paragraph reveal, chips, composer)

**Files:** Modify `src/features/tutor/ChatView.tsx`, `ModeBar.tsx`, `Composer.tsx`, `ConversationList.tsx`

- [ ] **Step 1: Apply**

**`ChatView.tsx`.**
- Each message `<li>` gets `animate-rise-in`.
- The assistant `MarkdownView` gets `reveal={m.id === lastAssistant?.id}`, so only the newest reply reveals and history doesn't re-animate.
- The welcome container (passed as `empty`) is unchanged.

**`ModeBar.tsx`.** The mode chip className appends `transition-[background-color,border-color,color,scale] duration-200 ease-float active:scale-95`, plus `on && 'animate-pop-in'`.

**`Composer.tsx`.**
- The form className appends `transition-[border-color,box-shadow] duration-200 focus-within:shadow-[0_0_0_4px_var(--primary-soft)]`.
- The send `Button` gets `className={cn('rounded-xl', text.trim() && '-translate-y-px shadow-[0_0_0_4px_var(--primary-soft)]')}`.

**`ConversationList.tsx`.** The `<ul>` gets `stagger [--stagger-step:30ms]`.

- [ ] **Step 2: Run the gate and commit**

Run: `npm test && npm run typecheck && npm run lint` (Expected: green)

```bash
git add src/features/tutor
git commit -m "feat(tutor): rising messages, paragraph reveal for new replies, springy mode chips, glowing composer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Planner and Plan with Nova

**Files:** Modify `src/features/planner/PlannerPage.tsx`, `TaskChip.tsx`, `MonthView.tsx`, `WeekView.tsx`, `DayView.tsx`, `PlanTimeline.tsx`, `AiPlannerPage.tsx`, `src/features/planner/calendar.ts`

- [ ] **Step 1: Chips and checkbox**

**`TaskChip.tsx`.**
- The root gets `animate-pop-in transition-[opacity,translate,box-shadow] duration-200`.
- While dragging, lift the chip: add `onDragStart` → `e.currentTarget.classList.add('chip-dragging')` and `onDragEnd` → `e.currentTarget.classList.remove('chip-dragging')`.
- The checkbox replaces `accent-[var(--primary)]` with `check-pop text-ink-faint`, and the size classes stay.
- The title span gets `transition-[opacity] duration-300` alongside `line-through` when done.

- [ ] **Step 2: Drop targets, today pulse and view crossfade**

**`calendar.ts` `dayDropProps`.**
- Add `onDragEnter: (e) => { if (e.dataTransfer.types.includes(TASK_DRAG_TYPE)) e.currentTarget.classList.add('drop-glow'); }` and `onDragLeave: (e) => e.currentTarget.classList.remove('drop-glow')`.
- In `onDrop`, also `e.currentTarget.classList.remove('drop-glow')`.
- Type the event as `DragEvent<HTMLElement>`, importing the `DragEvent` type from react.

Append to `src/index.css`:

```css
.chip-dragging { opacity: .6; translate: 0 -2px; box-shadow: var(--glow); }
.drop-glow { box-shadow: inset 0 0 0 2px var(--primary-soft); background-color: color-mix(in oklab, var(--primary) 6%, transparent); }
```

- **`MonthView.tsx`:** the today date button adds `animate-pulse-once` when `isToday`.
- **`PlannerPage.tsx`:** wrap the view block in `<div key={`${view}:${dateKey}`} className="animate-fade-in">…</div>`. The Someday list `<ul>` gets `stagger`.
- **`DayView.tsx`:** the `<ol>` gets `stagger`.

- [ ] **Step 3: Plan with Nova**

- **`PlanTimeline.tsx`:** the days `<ol>` gets `stagger [--stagger-step:50ms]`. The exam-day `<span aria-hidden>★</span>` gets `className="inline-block animate-twinkle"`.
- **`AiPlannerPage.tsx`:** the Your plans `<ul>` gets `stagger`.

- [ ] **Step 4: Run the gate and commit**

Run: `npm test && npm run typecheck && npm run lint` (Expected: green)

```bash
git add src/features/planner src/index.css
git commit -m "feat(planner): popping chips and ticks, drag lift and drop glow, today pulse, view crossfade, staggered plans

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Study, stats, settings and profile

**Files:**
- Modify:
  - `src/components/sky/OrbitTimer.tsx`, `src/features/study/SessionSetup.tsx`
  - `src/features/stats/charts.tsx`, `StatsPage.tsx`
  - `src/features/settings/SettingsPage.tsx`, `sections/ProfileSection.tsx`, `sections/StudySection.tsx`, `sections/PasswordSection.tsx`
  - `src/features/subjects/SubjectPicker.tsx` (`ColorSwatches`), `src/features/profile/ProfilePage.tsx`

**Interfaces:** Consumes `usePrefersReducedMotion` (Task 3) and `Button` `done` (Task 3).

- [ ] **Step 1: Study**

**`OrbitTimer.tsx`.**
- Add a trail arc before the planet group. It's a path along the orbit covering the last 0.06 of a turn behind the planet:

  ```tsx
  {progress > 0.01 && (() => {
    const end = progress * 2 * Math.PI - Math.PI / 2;
    const start = Math.max(-Math.PI / 2, end - 0.06 * 2 * Math.PI);
    const p = (a: number) => `${150 + Math.cos(a) * r} ${150 + Math.sin(a) * r}`;
    return <path d={`M ${p(start)} A ${r} ${r} 0 0 1 ${p(end)}`} fill="none" stroke={isBreak ? 'var(--teal)' : 'var(--gold)'} strokeWidth="6" strokeLinecap="round" opacity=".25" />;
  })()}
  ```

- The phase label `<div className="text-sm uppercase …">` gets `key={phase}` and `animate-pop-in`.

**`SessionSetup.tsx`.** The setup `Card` gets `animate-rise-in`.

- [ ] **Step 2: Stats**

**`charts.tsx`.**
- In `FocusBars` and `AccuracyLine`, add `const reduce = usePrefersReducedMotion();`.
- Replace `isAnimationActive={false}` with `isAnimationActive={!reduce} animationDuration={700} animationEasing="ease-out"`.
- `SubjectBars`: the inner bar div adds `origin-left animate-grow-x transition-[width] duration-500 ease-soft`.

**`StatsPage.tsx`.** The tiles `<section aria-label="Totals" …>` gets `stagger`.

- [ ] **Step 3: Settings and profile**

**`SettingsPage.tsx`.**
- The sections `<nav>` gets `stagger [--stagger-step:30ms]`.
- The active section `Card` gets `key={active.id}` and `animate-rise-in`.
- Link items append `transition-colors duration-200`.

**`ProfileSection.tsx`, `StudySection.tsx`, `PasswordSection.tsx`.**
- Add `const [saved, setSaved] = useState(false);`.
- After each successful save (next to its existing `toast.success`), call `setSaved(true); setTimeout(() => setSaved(false), 1600);`.
- Pass `done={saved}` to that section's save `Button`.

**`SubjectPicker.tsx` `ColorSwatches`.**
- The button className appends `transition-[scale,border-color] duration-200 ease-float hover:scale-110 aria-checked:scale-110`.
- The inner span: when checked, `style` adds `boxShadow: `0 0 14px 3px ${c}``. When unchecked it stays `0 0 10px ${c}`, and its className gets `transition-shadow duration-300`.

**`ProfilePage.tsx`.**
- Wrap `<Avatar …/>` in `<span className="rounded-full p-1 shadow-[0_0_0_2px_var(--primary-soft),0_0_24px_var(--primary-soft)] animate-pop-in">`.
- The stats grid `mt-4 grid gap-4 sm:grid-cols-3` gets `stagger`.

- [ ] **Step 4: Run the gate and commit**

Run: `npm test && npm run typecheck && npm run lint` (Expected: green)

```bash
git add src/components/sky/OrbitTimer.tsx src/features/study src/features/stats src/features/settings src/features/subjects/SubjectPicker.tsx src/features/profile
git commit -m "feat(ui): orbit trail, animated charts, staggered settings with save ticks, glowing swatches and avatar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Visual verification across screens and themes

**Files:**
- Create (temporary, deleted at the end): `preview/kit.html`, `preview/kit.tsx`
- Modify: `scripts/shoot.mjs` (add a `SHOOT_REDUCED=1` env option)

- [ ] **Step 1: Reduced-motion option for screenshots**

In `scripts/shoot.mjs`, create each context with `reducedMotion: process.env.SHOOT_REDUCED ? 'reduce' : 'no-preference'` (Playwright `newContext` option).

- [ ] **Step 2: Kit preview page**

`preview/kit.tsx` renders, with sample data:
- a `PageHeader`;
- buttons of every variant, including `done`;
- `Card` and `Card interactive`;
- `Tabs`, a `Switch` and a `Skeleton`;
- an `EmptyState`;
- a `stagger` grid of 8 cards;
- `ProgressBar` and `ProgressRing`;
- a `TaskChip`-style `check-pop` checkbox;
- a `DeckConstellation` (lg);
- a `ResultsSky` with 10 answers;
- a `FlipCard` (revealed);
- an `OrbitTimer` at progress 0.4;
- the `StrengthStars` through `PasswordInput` with `showStrength`.

Add buttons that open a `Dialog`, a `Sheet` and a `Menu`.

`preview/kit.html` is the same skeleton as earlier previews: it imports `@/index.css` and sets the `data-theme` from `prefers-color-scheme`.

- [ ] **Step 3: Screenshot and inspect**

Run, with the dev server on 5174:
- `MSYS_NO_PATHCONV=1 npm run shoot -- /login /signup /set-password /preview/kit.html`
- `SHOOT_REDUCED=1 MSYS_NO_PATHCONV=1 npm run shoot -- /login /preview/kit.html`

Read every PNG in `.shots/` and check:
- no horizontal overflow warnings;
- no console errors;
- the auth split screen at 1280 and the sky band at 375, in both themes;
- readable contrast on gradient buttons;
- under reduced motion, all content is visible at its final state (nothing stuck at opacity 0).

Fix any issue in its owning file and re-shoot.

- [ ] **Step 4: Remove the preview and run the full gate**

```bash
rm -rf preview
npm test && npm run lint && npm run build && npm run check:bundle
```

Expected: tests pass, lint is clean, the build succeeds and the scanner prints ✓.

- [ ] **Step 5: Commit**

```bash
git add scripts/shoot.mjs
git commit -m "chore(ui): reduced-motion screenshots and visual verification of the polish pass

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

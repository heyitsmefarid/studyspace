const clamp = (n: number) => Math.max(-1, Math.min(1, n));

/** Pointer position relative to an element's centre: -1…1 on each axis, clamped at the edges. */
export function parallaxVector(rect: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number) {
  return {
    x: clamp(((clientX - rect.left) / rect.width) * 2 - 1),
    y: clamp(((clientY - rect.top) / rect.height) * 2 - 1),
  };
}

/**
 * Sets --px/--py (-1…1) on `el` from the pointer anywhere on the page, rAF-throttled, so depth layers can drift
 * against it. Off on touch-only devices and with reduced motion.
 */
export function installParallax(el: HTMLElement, win: Window = window): () => void {
  if (!win.matchMedia('(hover: hover)').matches || win.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  let frame = 0;
  let last: PointerEvent | null = null;
  const apply = () => {
    frame = 0;
    if (!last) return;
    const { x, y } = parallaxVector(el.getBoundingClientRect(), last.clientX, last.clientY);
    el.style.setProperty('--px', x.toFixed(3));
    el.style.setProperty('--py', y.toFixed(3));
  };
  const onMove = (e: PointerEvent) => { last = e; if (!frame) frame = win.requestAnimationFrame(apply); };
  win.document.addEventListener('pointermove', onMove, { passive: true });
  return () => { win.document.removeEventListener('pointermove', onMove); if (frame) win.cancelAnimationFrame(frame); };
}

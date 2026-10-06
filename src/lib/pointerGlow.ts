/** Element-relative pointer position for the [data-glow] radial highlight. */
export function glowPosition(rect: { left: number; top: number }, clientX: number, clientY: number) {
  return { mx: `${Math.round(clientX - rect.left)}px`, my: `${Math.round(clientY - rect.top)}px` };
}

/**
 * One passive, rAF-throttled pointermove listener for the whole app that moves the glow under the pointer on the
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

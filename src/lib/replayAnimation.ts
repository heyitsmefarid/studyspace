interface Animatable { classList: { remove(c: string): void; add(c: string): void }; readonly offsetWidth: number }

/** Restarts a CSS animation class on the same element (no remount, so focus and field state survive). */
export function replayAnimation(el: Animatable | null | undefined, className: string): void {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth; // force a reflow so the browser sees the class as new
  el.classList.add(className);
}

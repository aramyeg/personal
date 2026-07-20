/**
 * Small World is a scroll-DRIVEN experience: the journey samples `window.scrollY`
 * every frame and maps it to 0..1 progress. That collides with the browser's
 * default scroll restoration — reload while scrolled deep (Aram's tuning sessions)
 * and the browser re-applies that deep scrollY during the load window, so the
 * journey samples a stale, often near-end progress (the "loads at the end" flash)
 * before the layout settles.
 *
 * Fix: take MANUAL control of scroll restoration for the lifetime of the lab route
 * and pin to top, so every load starts clean at progress 0. Restoring the prior
 * mode on unmount keeps normal anchor/scroll behavior on every OTHER route intact
 * (this only ever holds while the scene is mounted).
 *
 * Kept as a tiny leaf module (no React import) so the restoration + pin logic is
 * unit-testable without mounting the WebGL scene.
 */

/** Switch the browser to manual scroll restoration; returns a restore fn that
 *  puts the previous mode back (call on unmount). Safe when `history` is absent. */
export function beginManualScrollRestoration(): () => void {
  if (typeof history === 'undefined' || !('scrollRestoration' in history)) {
    return () => {}
  }
  const prev = history.scrollRestoration
  try {
    history.scrollRestoration = 'manual'
  } catch {
    // Some embedded browsers make it read-only; nothing to restore then.
    return () => {}
  }
  return () => {
    try {
      history.scrollRestoration = prev
    } catch {
      // ignore — best-effort restore
    }
  }
}

/** Jump the document to the top INSTANTLY, bypassing the global
 *  `scroll-behavior: smooth` (otherwise the reset would animate as a visible
 *  "snap back" from the restored position). */
export function pinScrollToTop(): void {
  if (typeof window === 'undefined') return
  const el = typeof document !== 'undefined' ? document.documentElement : null
  const prevBehavior = el?.style.scrollBehavior
  if (el) el.style.scrollBehavior = 'auto'
  try {
    window.scrollTo(0, 0)
  } catch {
    // ignore — best-effort
  }
  if (el && prevBehavior !== undefined) el.style.scrollBehavior = prevBehavior
}

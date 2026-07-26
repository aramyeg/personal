/**
 * WHERE THE READER'S HAND ALREADY IS (E3 R-2, second half).
 *
 * r3f only ever learns about a pointer from a pointer EVENT on its canvas. A
 * reader whose hand is already resting on a piece — because they arrived at the
 * page that way, or because the book was busy booting or turning when they got
 * there — produces no further events, so nothing in the scene knows the hand is
 * there and the cursor keeps saying "dead paper" until they jiggle. The blind
 * re-review measured exactly that: "Move onto a grabbable and stop: cursor stays
 * empty. Jiggle the pointer 1px: cursor becomes grab. The cursor lies whenever
 * the reader pauses." Confirmed on the lane server — a pointer parked on the s6
 * tab through the boot read `hover: null` for six seconds, and a keyboard turn
 * away and back left it null for good.
 *
 * There is no browser API for "where is the pointer now", so this keeps the
 * answer from the last move the WINDOW saw (installed by the lab loader, which
 * mounts long before the canvas does — the point is to catch the move that
 * happens while the book is still loading) and re-delivers it to the canvas as a
 * plain pointermove whenever the book becomes able to answer differently.
 *
 * The synthetic event carries `offsetX/offsetY` because that is what r3f's own
 * `compute` reads (its default `eventPrefix`); a constructed PointerEvent has
 * them at 0, which would aim every replayed ray at the canvas's top-left corner.
 */

let last: { x: number; y: number } | null = null
let installed = false

const onMove = (e: PointerEvent): void => {
  last = { x: e.clientX, y: e.clientY }
}

/** Starts remembering the pointer. Idempotent; safe to call on every mount. */
export function installPointerTracker(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('pointermove', onMove, { passive: true })
}

export function lastWindowPointer(): { x: number; y: number } | null {
  return last
}

/** Test seam — the tracker is a module singleton by design. */
export function __setLastWindowPointer(p: { x: number; y: number } | null): void {
  last = p
}

/**
 * Re-delivers the reader's last known pointer position to `el` as a pointermove,
 * so the scene re-runs its hit test for a hand that never moved. No-op when the
 * pointer has never been seen, or is not over the canvas.
 */
export function primeHover(el: HTMLElement): void {
  if (!last || typeof window === 'undefined') return
  const r = el.getBoundingClientRect()
  if (last.x < r.left || last.x > r.right || last.y < r.top || last.y > r.bottom) return
  const ev = new PointerEvent('pointermove', {
    clientX: last.x,
    clientY: last.y,
    bubbles: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
  })
  Object.defineProperty(ev, 'offsetX', { value: last.x - r.left })
  Object.defineProperty(ev, 'offsetY', { value: last.y - r.top })
  el.dispatchEvent(ev)
}

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

/**
 * Jump the document to the top INSTANTLY, bypassing the global
 * `scroll-behavior: smooth` (otherwise the reset would animate as a visible
 * "snap back" from the restored position).
 *
 * ── IT DID NOT BYPASS ANYTHING, AND FOR THREE ROUNDS NOBODY COULD TELL (Task 106) ────────────
 *
 * The old body set `documentElement.style.scrollBehavior = 'auto'`, called `scrollTo`, and put
 * the previous value back — all in one synchronous block. That does not work in Chrome. The
 * assignment only marks style dirty; `scrollTo` reads the CACHED computed `scroll-behavior`, so
 * it still saw `smooth` from `app/globals.css`, and the restore meant a recalculation with
 * `auto` in place never happened at all. Measured on the shipped build from the bottom of the
 * track: the "instant" pin animated 14 220 px over 90 frames and 1 529 ms.
 *
 * It survived because the only caller was the mount pin, and on a fresh load the page is
 * ALREADY at 0 — a no-op cannot animate. Task 106's restart is the first caller that runs it
 * from a deep scroll, and it inherited exactly the clanky rewind the restart exists to remove.
 *
 * The fix is belt and braces because the two halves cover different engines. `behavior:
 * 'instant'` is the spec's own override of the CSS property and needs no style mutation; it is
 * also newer than the style trick, and an engine that does not know the enum value throws, which
 * is what the fallback is for. Reading `offsetHeight` between the assignment and the scroll is
 * what makes the style route actually take — a forced layout is a forced style recalculation.
 * All three variants were measured against the shipped one (see the report); the shipped one is
 * the only one that animates.
 */
export function pinScrollToTop(): void {
  pinScrollTo(0)
}

/**
 * Whether a lab-issued JUMP is waiting to be accounted for by the driver's next
 * frame (Task 126).
 *
 * Module-level mutable state, deliberately, and it is the narrowest thing that
 * works. `pinScrollTo` is already this lab's single authority for a document jump
 * that must not animate, so it is also the only place that knows a jump happened —
 * and its callers are a button handler, an iris and a driver frame, with no shared
 * object between them to thread a flag through. The alternative was to make every
 * caller announce itself to the driver, which is three call sites remembering a
 * convention instead of one function keeping a fact.
 *
 * It is a one-shot: read it and it clears, so a jump is honoured by exactly one
 * frame and cannot leak into the next.
 */
let jumpPending = false

/**
 * WHAT KIND OF WRITE THIS IS, and why the driver's own writes must say so.
 *
 * 'jump'  — the reader asked to BE somewhere: skip to the desk, restart, the mount
 *           pin. Honoured instantly by the governor, which is the point of them.
 * 'pace'  — the lab moving the document as part of the reading itself: Task 125's
 *           baseline carry topping a beat up, Task 126's leash holding it back.
 *           These must NOT read as jumps, or the governor would teleport to the
 *           position its own ceiling just wrote and the ceiling would undo itself
 *           every frame.
 *
 * The default is 'jump' because every caller that predates this is one.
 */
export type PinKind = 'jump' | 'pace'

/** Reads and clears the pending-jump flag. Called once per driver frame. */
export function takePendingJump(): boolean {
  const pending = jumpPending
  jumpPending = false
  return pending
}

/**
 * The same instant jump, aimed anywhere (Task 108).
 *
 * The iris now covers TWO destinations — the top for the restart and the bottom of the track for
 * "skip to the desk" — and both need the identical property: the document moves in ONE frame,
 * because the whole point of the cover is that nothing under it is seen moving. A second
 * implementation of the bypass would be a second chance to inherit the smooth-scroll bug the block
 * above documents, so the top is now a special case of this rather than its own routine.
 */
export function pinScrollTo(top: number, kind: PinKind = 'jump'): void {
  if (typeof window === 'undefined') return
  if (kind === 'jump') jumpPending = true
  const el = typeof document !== 'undefined' ? document.documentElement : null
  const prevBehavior = el?.style.scrollBehavior
  if (el) {
    el.style.scrollBehavior = 'auto'
    // Force the recalculation the assignment above only asked for.
    void el.offsetHeight
  }
  try {
    window.scrollTo({ top, left: 0, behavior: 'instant' })
  } catch {
    // Older engines reject the enum value; the style route above is already in force.
    try {
      window.scrollTo(0, top)
    } catch {
      // ignore — best-effort
    }
  }
  if (el && prevBehavior !== undefined) el.style.scrollBehavior = prevBehavior
}

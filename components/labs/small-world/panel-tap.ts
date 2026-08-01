/**
 * Task 61 — the seam that lets the CANVAS take pointer events while tap-to-advance still works.
 *
 * THE PROBLEM THIS EXISTS FOR. `chapter-panels.tsx` used to advance the journey from a
 * full-viewport `pointer-events: auto` div (`sw-panel-tap`, `inset: 0`) laid over the canvas
 * whenever a panel was up. That is a blanket: at every checkpoint dwell it swallowed every click, so
 * the lab's first canvas interaction — the yeti easter egg — was unreachable exactly where a visitor
 * is most likely to try it. Measured: at a dwell `elementFromPoint` at the egg's hotspot returned
 * the tap div and the canvas received no trusted click at all; mid-travel, with no panel up, it
 * received all three events and the egg worked.
 *
 * THE RULING (round 18) was to invert it: the canvas takes the click, and panel-advance becomes the
 * FALLBACK via r3f's `onPointerMissed`, which fires only when a click hit no interactive object. So
 * clicking ON the egg peeks and clicking anywhere else advances — which is what tap-to-advance
 * always meant, and it fixes the class rather than the instance (the ending will want
 * canvas interactivity too).
 *
 * WHY A REGISTRY RATHER THAN A PROP. The two halves live on opposite sides of the tree:
 * `onPointerMissed` is a prop of the `<Canvas>` in `scene.tsx`, while "is a panel up, and which
 * chapter does it advance to" is known only inside `JourneyOverlay`. Threading a callback between
 * them would mean restructuring the experience component. This is the narrow seam instead.
 *
 * THE LIFETIME IS THE POINT, and it is what makes rail 3 structural rather than a check. The
 * registration lives exactly as long as the panel component does: `ChapterPanels` only renders while
 * a panel is up, so when it unmounts the registration clears and `firePanelAdvance()` becomes a
 * no-op. There is therefore no state to consult and no way for a stale advance to fire during
 * travel — including the awkward case where the visitor scrubs across the dwell edge between
 * pointerdown and pointerup, which simply lands on a cleared registry.
 */

/** The live panel's advance action, or null when no panel is up. */
let advance: (() => void) | null = null

/**
 * Publish (or retract) the current panel's advance action.
 *
 * Retraction is guarded on IDENTITY rather than clearing unconditionally. React can mount the next
 * panel before running the previous one's cleanup, and an unconditional clear in that order would
 * wipe the incoming registration and leave tap-to-advance dead until the next re-render.
 */
export function setPanelAdvance(fn: (() => void) | null): () => void {
  advance = fn
  return () => {
    if (advance === fn) advance = null
  }
}

/**
 * Fire the live panel's advance, if there is one. Safe to call on every missed click — during
 * travel there is no panel and this does nothing.
 */
export function firePanelAdvance(): void {
  advance?.()
}

/** Whether a panel is currently accepting a tap. Exported for tests and for nothing else. */
export function panelTapArmed(): boolean {
  return advance !== null
}

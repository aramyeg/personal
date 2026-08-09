/**
 * HOW A CONTROL IN THIS LAB ANSWERS A POINTER AND A KEYBOARD — one law, because
 * the two places that need it were disagreeing.
 *
 * ============================================================================
 * THE DEFECT (Task 105, Aram): "some sort of black border" WHEN YOU CLICK
 * ============================================================================
 * `ending-connect.tsx` draws a measured ink focus ring — 2px paper, 5px ink, a
 * double box-shadow that clears 3:1 on both surfaces it can fall on — and it
 * armed that ring from `onFocus`. `onFocus` does not mean "a keyboard arrived":
 * it fires on mousedown too. So clicking the plain-CV link or the restart put a
 * 5px black ring around the word and left it there until something else took
 * focus, which is exactly the black border he saw. `cv-sheet-link.tsx` had the
 * other half of the same problem from the other end: no focus styling at all, so
 * a keyboard visitor got the BROWSER's default ring, which on this paper is also
 * a black box, and a phone got the platform tap highlight on top of it.
 *
 * ============================================================================
 * THE LAW
 * ============================================================================
 *  1. A FOCUS RING IS FOR A KEYBOARD. It is drawn when the browser says the
 *     focus is visible-worthy, and never merely because a pointer landed.
 *  2. IT IS NEVER REMOVED, ONLY REPLACED. `outline: none` on its own is how a
 *     keyboard visitor loses the page, so every control that suppresses the
 *     default ring draws one of the lab's own in its place.
 *  3. A PRESS IS ITS OWN STATE, and it is drawn in the lab's language rather
 *     than the platform's — a hand-written control presses by moving, the way
 *     a pen does, not by growing a rectangle it never had.
 */

/**
 * Does this element deserve a focus ring right now?
 *
 * `:focus-visible` is the browser's own answer to "did a keyboard put focus
 * here", and it is the only honest source for it — heuristics over `keydown`
 * re-implement the thing the platform already knows.
 *
 * IT FAILS OPEN, and that is the accessibility default rather than caution: an
 * engine that does not understand the selector throws from `matches`, and in
 * that case a visible ring is the safe answer. (jsdom is one such engine, which
 * is why the unit suites still see the ring they have always asserted.)
 */
export function isKeyboardFocus(el: Element | null | undefined): boolean {
  if (!el) return false
  try {
    return el.matches(':focus-visible')
  } catch {
    return true
  }
}

/**
 * How far a pressed control moves, in px.
 *
 * One pixel, down. It is the smallest displacement that reads as contact and it
 * is the one the hand-written row can afford: the controls there already ride a
 * `translateY` for their entrance, so a press composes with that rather than
 * replacing it.
 */
export const PRESS_SHIFT_PX = 1

/** The platform's own tap flash, off — the lab draws its own press instead. */
export const NO_TAP_HIGHLIGHT = { WebkitTapHighlightColor: 'transparent' } as const

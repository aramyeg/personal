/**
 * TURN-TIME CULLING of interaction-only pieces (Batch C-3).
 *
 * The book's draw-call peak is not a spread at rest — it is the middle of a page
 * turn, when TWO spreads are mounted and animating at once. Some pieces earn
 * their draws only when the reader can actually touch them: the dispatch dial
 * and its window card, and the winch's driven sub-pieces (disc, semaphore, iris
 * blades, counterweight). Mid-turn they are edge-on slivers on a sheet sweeping
 * past at speed, and nobody is reading them — so they stop drawing.
 *
 * This is VISUAL ONLY. No solver, no pose, no envelope and no fold-flat proof is
 * touched: the pieces still solve to exactly the same corners, they simply are
 * not submitted. The keep itself is explicitly NOT culled — it is the spread's
 * structure, and watching it fold IS the wonder.
 *
 * THE WINDOW is the cross-pack convention from the s4 pack §4c: hidden from
 * t = 0.03, restored "inside the landing-settle window so the reappearance hides
 * under the settle". The pack's literal upper bound of 0.97 is UNREACHABLE under
 * the shipped driver, and that is not a rounding quibble — taken literally it
 * inverts the intent. The M2 landing settle publishes `frame.t` through
 * `easeTurnWeightedInv`, so the value tops out at ~0.905 (the whole 250ms settle
 * tail occupies t 0.822..0.905) and then the frame goes null at commit. A literal
 * 0.97 gate would hold both pieces hidden through the entire settle and snap them
 * back on the commit frame — the loudest possible pop, exactly what the pack is
 * trying to avoid.
 *
 * So the restore band is DERIVED from the driver rather than hardcoded: it is the
 * settle tail itself, start to finish. That is the pack's sentence taken at its
 * word, it cannot drift if SETTLE_MS or TURN_MS are retuned, and it buys a 250ms
 * fade-in landing on the same beat as the rest of the landing choreography
 * instead of a 3%-of-sweep flicker.
 */

import { SETTLE_MS, TURN_MS, turnPublishedT } from './use-turn-driver'

/**
 * Fully hidden from here to the restore band. The pack's primary window opens at
 * 0.03 and its sanctioned fallback, "if pop-in is visible at the edges", is 0.08.
 * THE EYE-GATE CALLED FOR THE FALLBACK: at TURN_MS 1250 a 0.03 margin is 37ms —
 * about two frames — and the leading margin is the one stretch of the turn where
 * the page has not moved at all (the weighted easing leaves eased progress at ~0
 * until t ~0.2), so there is no motion to hide the fade behind. Two frames on a
 * dead-still scene reads as a blink, not a fade. At 0.08 the same fade gets 100ms
 * (~6 frames) and reads as intended. Captures: bench/out/c6-spread-4_0.005_next
 * .png through _0.035_next.png (at 0.03) and _0.02_/_0.05_/_0.09_ (at 0.08).
 */
export const TURN_CULL_HIDE_AT = 0.08

/** The landing settle in published-t terms: the tail starts the instant the main
 *  sweep ends and runs to the commit. The pieces ramp back across exactly this
 *  band, so they are whole again as the page sighs into rest. */
export const TURN_CULL_RESTORE_FROM = turnPublishedT(TURN_MS, TURN_MS)
export const TURN_CULL_RESTORE_TO = turnPublishedT(TURN_MS + SETTLE_MS, TURN_MS)

/**
 * Opacity multiplier for an interaction-only piece at the driver's published RAW
 * turn progress `t` (`TurnFrame.t` — NOT the eased value; the easing is so
 * weighted that eased progress is still ~0 a fifth of the way through, which
 * would put the fade nowhere near where the pack specifies it). At rest, where
 * callers pass 0 because there is no frame at all, this is exactly 1.
 */
export function turnCullOpacity(t: number): number {
  if (!Number.isFinite(t)) return 1
  if (t <= 0) return 1
  if (t < TURN_CULL_HIDE_AT) return 1 - t / TURN_CULL_HIDE_AT
  if (t < TURN_CULL_RESTORE_FROM) return 0
  if (t >= TURN_CULL_RESTORE_TO) return 1
  return (t - TURN_CULL_RESTORE_FROM) / (TURN_CULL_RESTORE_TO - TURN_CULL_RESTORE_FROM)
}

/** True while the piece is fully culled — the caller hides its group, which is
 *  what actually returns the draw calls (a zero-opacity mesh still draws). */
export function turnCulled(t: number): boolean {
  return turnCullOpacity(t) <= 0
}

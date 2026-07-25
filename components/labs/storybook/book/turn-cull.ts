/**
 * TURN-TIME CULLING of interaction-only pieces (Batch C-3).
 *
 * The book's draw-call peak is not a spread at rest — it is the middle of a page
 * turn, when TWO spreads are mounted and animating at once. Some pieces earn
 * their draws only when the reader can actually touch them: the dispatch dial
 * and its window card, and the winch's driven sub-pieces (disc, semaphore,
 * iris blades, counterweight). Mid-turn they are edge-on slivers on a sheet
 * sweeping past at speed, and nobody is reading them — so they stop drawing.
 *
 * This is VISUAL ONLY. No solver, no pose, no envelope and no fold-flat proof
 * is touched: the pieces still solve to exactly the same corners, they simply
 * are not submitted. The keep itself is explicitly NOT culled — it is the
 * spread's structure, and watching it fold IS the wonder.
 *
 * The window is a ramp, not a switch (risk R6, pop-in): opacity falls to zero
 * over the first `TURN_CULL_RAMP` of the eased turn, holds at zero through the
 * fast middle, and comes back over the last `TURN_CULL_RAMP` — which lands the
 * reappearance inside the turn's settle beat, the same moment the rest of the
 * landing choreography resolves.
 */

/** Fraction of the eased turn spent fading out (and again fading back in). */
export const TURN_CULL_RAMP = 0.15

/**
 * Opacity multiplier for an interaction-only piece at eased turn progress `e`
 * (0 = the turn's start pose, 1 = landed). At rest — where callers pass 0 —
 * this is exactly 1, so a book that never turns behaves as if the mechanism
 * did not exist.
 */
export function turnCullOpacity(e: number): number {
  if (!Number.isFinite(e)) return 1
  if (e <= 0 || e >= 1) return 1
  if (e < TURN_CULL_RAMP) return 1 - e / TURN_CULL_RAMP
  if (e > 1 - TURN_CULL_RAMP) return (e - (1 - TURN_CULL_RAMP)) / TURN_CULL_RAMP
  return 0
}

/** True while the piece is fully culled — the caller hides its group, which is
 *  what actually returns the draw calls (a zero-opacity mesh still draws). */
export function turnCulled(e: number): boolean {
  return turnCullOpacity(e) <= 0
}

/**
 * Task 49 — the canyon geyser eruption cycle. A PURE, deterministic function of the
 * unwrapped journey `rotation` (no wall-clock), so the plume's grow/shrink is bit-
 * reproducible when the girl scrubs the scroll back and forth — the same discipline as
 * journey-timeline.approachRevealGrow and the delta wildlife bob.
 *
 * Aram's flicker-family veto is the hard constraint: the plume is a sculpted opaque clay
 * column that GROWS and SHRINKS on a SLOW cycle — never a shimmer, sparkle, or particle
 * spray. This returns the plume's height fraction ∈ [0, 1]; the render scales one merged
 * clay-puff column by it (uniform scale about the vent), so the eruption reads as a solid
 * mineral jet rising and settling, not flickering. The cycle is C1-continuous (value AND
 * first derivative are continuous, including across the wrap between cycles), so the growth
 * is smooth with no stepping at the default.
 *
 * One eruption cycle spans `period` radians of rotation. Within a cycle the plume is:
 *   dormant [0, 0.12) → 0 (a quiet vent; the base mineral pool still bubbles, drawn
 *                          separately and always present)
 *   rising  [0.12, 0.34) → 0…1 (the jet climbs)
 *   full    [0.34, 0.60) → 1 (a sustained column)
 *   falling [0.60, 0.82) → 1…0 (it subsides)
 *   dormant [0.82, 1)   → 0
 * `phase` desyncs neighbouring geysers so they never erupt in lockstep.
 */

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
const smoothstep01 = (t: number): number => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}
const frac = (v: number): number => v - Math.floor(v)

/** Cycle-phase boundaries (fractions of one eruption cycle). Rise and fall use smoothstep
 *  ramps whose slopes vanish at both ends, so the cycle is C1 across every boundary AND
 *  across the wrap (the value is 0 at both ends of the cycle with zero slope). */
const RISE_LO = 0.12
const RISE_SPAN = 0.22
const FALL_LO = 0.6
const FALL_SPAN = 0.22

/**
 * Plume height fraction ∈ [0, 1] at the current `rotation` for a geyser with the given
 * `phase` offset and eruption `period` (radians of rotation per cycle). Pure + deterministic;
 * 0 for a non-positive period (a disabled geyser). Smooth (no stepping) at the default period.
 */
export function geyserPlume(rotation: number, phase: number, period: number): number {
  if (period <= 0) return 0
  const u = frac(rotation / period + phase)
  const rise = smoothstep01((u - RISE_LO) / RISE_SPAN)
  const fall = 1 - smoothstep01((u - FALL_LO) / FALL_SPAN)
  return rise * fall
}

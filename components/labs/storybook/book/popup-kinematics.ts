/**
 * Pure math driving pop-up layer fold/rise progress from the turning page's
 * own motion — no three.js imports, same jsdom-testable convention as
 * page-geometry.ts; popup-spread.tsx is the only consumer.
 *
 * v2 mechanics (user pivot: "when a new page is turned, from the page
 * itself these cutouts should be unfolded like a real pop-up book would"):
 * fold progress is a function of the page's EASED sweep progress — i.e. of
 * the page's actual angle, since theta = PI * easedProgress — not of the
 * raw clock. The mechanical model is a real book's linkage:
 *
 *   page rising 0..vertical   (eased p ∈ [0, 0.5])  the departing page
 *     pushes/pulls its own spread's paper flat — every piece is folded by
 *     the time the page stands vertical over the gutter;
 *   page falling vertical..flat (eased p ∈ [0.5, 1])  the arriving page
 *     drags the new spread's paper upright, finishing exactly as the page
 *     lays flat.
 *
 * Because both sides key off the same eased progress the paper moves when
 * — and only when — the page moves; if the page's easing slows near its
 * ends, the paper slows with it, the way glued paper must.
 *
 * The last stretch from RISE_LANDING_STAND to a full stand of 1 is *not*
 * handled here — the caller's spring takes over once the layer's role
 * flips from "incoming" to "current" at commit, landing as a small,
 * natural paper-snap settle rather than a kinematic stop.
 */

export const PAGE_VERTICAL_P = 0.5
export const RISE_LANDING_STAND = 0.95

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

/**
 * Outgoing-spread fold progress, driven by the page's eased sweep progress
 * `p` (0 = page flat at rest, PAGE_VERTICAL_P = page vertical over the
 * gutter): `start` (whatever stand value the layer was captured at when it
 * became outgoing — never assumed 1) closes down to 0 as the page rises,
 * reaching flat exactly when the page reaches vertical. `phaseOffset`
 * (small, per-layer) lets foreground paper lead by a hair without ever
 * pushing the finish past vertical.
 */
export function outgoingFoldStand(p: number, start: number, phaseOffset: number): number {
  if (start <= 0) return 0
  const windowEnd = PAGE_VERTICAL_P
  const windowStart = Math.min(phaseOffset, windowEnd - 0.05)
  if (p <= windowStart) return start
  if (p >= windowEnd) return 0
  const u = clamp01((p - windowStart) / (windowEnd - windowStart))
  // cos-shaped closure: paper glued to a rotating page closes on a cosine
  // of the page angle, fastest mid-swing, gentle at both ends.
  return start * (0.5 + 0.5 * Math.cos(Math.PI * u))
}

/**
 * Incoming-spread rise progress, driven by the same eased sweep progress:
 * 0 while the page is still rising (p < PAGE_VERTICAL_P), then dragged
 * upright by the descending page, reaching RISE_LANDING_STAND exactly as
 * the page lays flat at p = 1. `phaseOffset` lets backdrop paper engage a
 * hair earlier than foreground, inside the same window.
 */
export function incomingRiseStand(p: number, phaseOffset: number): number {
  const windowStart = Math.max(PAGE_VERTICAL_P - phaseOffset, 0.05)
  if (p <= windowStart) return 0
  if (p >= 1) return RISE_LANDING_STAND
  const u = clamp01((p - windowStart) / (1 - windowStart))
  // sin-shaped opening: the mirror of the fold — slow engagement as the
  // page passes vertical, decisive through the middle, easing into flat.
  return RISE_LANDING_STAND * (0.5 - 0.5 * Math.cos(Math.PI * u))
}

// ---------------------------------------------------------------------------
// v3 attachment mechanics: which sheet a piece is glued to, and how it rides.
//
// The moving sheet on a 'next' turn is the near stack's top page; on 'prev',
// the far stack's. Physically, that sheet CARRIES paper on both faces:
//  - the outgoing spread's pieces hinged on the sheet's side of the gutter
//    fold flat against its top face and ride it up;
//  - the incoming spread's pieces hinged on the sheet's LANDING side are
//    glued to its back face and ride it down, unfolding as it lays flat.
// Pieces hinged on the stationary page unfold/fold in place. Riding is what
// makes "the cutouts unfold from the page itself" literal — and it makes
// sheet/paper intersection geometrically impossible, because the paper is
// attached to the thing that would otherwise sweep through it.

/** The moving sheet's angle over the NEAR side, in radians 0..π — matches
 *  the curl math's theta exactly (see page-geometry.ts). */
export function sheetTheta(dir: 'next' | 'prev', easedP: number): number {
  const p = clamp01(easedP)
  return dir === 'next' ? Math.PI * p : Math.PI * (1 - p)
}

const HALF_PI = Math.PI / 2

/**
 * Extra rotation (radians, about the gutter axis) a piece's assembly picks
 * up from the sheet it is glued to during a turn — 0 for pieces glued to
 * stationary paper. `hingeZ` < 0 is the far side of the gutter.
 *
 * Angles are capped at ±π/2: past vertical the riding piece is fully folded
 * (stand 0, hidden by the ε-visibility rule), so the cap only spares the
 * pose math from chasing an invisible piece under the landed sheet.
 */
export function rideAngle(
  role: 'outgoing' | 'incoming',
  dir: 'next' | 'prev',
  hingeZ: number,
  theta: number
): number {
  const nearHinged = hingeZ >= 0
  if (dir === 'next') {
    // Moving sheet: the near page, sweeping theta 0 -> π.
    if (role === 'outgoing' && nearHinged) return -Math.min(theta, HALF_PI)
    if (role === 'incoming' && !nearHinged) return Math.max(0, Math.min(Math.PI - theta, HALF_PI))
    return 0
  }
  // 'prev': the far page's sheet, sweeping theta π -> 0 (still measured from
  // the near side, so its own lift off the far stack is π - theta).
  if (role === 'outgoing' && !nearHinged) return Math.max(0, Math.min(Math.PI - theta, HALF_PI))
  if (role === 'incoming' && nearHinged) return -Math.min(theta, HALF_PI)
  return 0
}

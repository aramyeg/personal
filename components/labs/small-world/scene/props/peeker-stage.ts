import { easeOutBack, smoothstep } from '../../journey-timeline'

/**
 * Task 53 — pure staging math for the CHECKPOINT PEEKERS: per-biome clay characters that
 * lean in from the top-left and top-right of the frame while a chapter's panel is up.
 *
 * Everything here is pure and frame-independent so the rig (peekers.tsx) is a thin
 * transform writer. Two things are deliberately NOT hardcoded:
 *
 *  - Placement is derived from the live frustum half-extents at the peeker depth, so the
 *    corners follow the viewport (a phone's frustum corner is nowhere near a desktop's).
 *  - Entrance/exit/idle are driven by the chapter's PANEL DWELL FRACTION (JourneyState.panel.t,
 *    the same source the DOM panels read), never a wall clock — scrubbing back and forth
 *    replays them exactly.
 */

const TAU = Math.PI * 2
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

// --- depth ------------------------------------------------------------------
//
// The peekers live in SKY, well behind the planet: at this camera-space depth every
// peeker fragment is farther from the camera than the planet's ceiling budget, so the
// depth buffer alone guarantees the standing "planet is never covered" contract — a
// peeker physically cannot draw over the world. It is also far in front of the sky plane
// (world z = -20). peeker-stage.test.ts pins both margins against the real camera numbers.
export const PEEKER_DEPTH = 17.5

// --- size -------------------------------------------------------------------
//
// A figure is authored ~1 unit tall inside a bounding sphere of PEEKER_FIGURE_RADIUS, so
// `size` IS its world height. Sizing off the frustum's half-HEIGHT keeps a peeker the same
// share of the screen at every aspect (three's fov is vertical); the half-width term only
// bites on narrow/portrait viewports, where it shrinks the figures so a phone's corner is
// not swallowed by one animal.
export const PEEKER_SIZE_FRAC = 0.36
export const PEEKER_NARROW_GAIN = 1.35
/** Local-space bounding radius every cast figure is authored inside (clearance benches use it). */
export const PEEKER_FIGURE_RADIUS = 0.62

// --- parked / hidden pose ---------------------------------------------------
/**
 * Parked inset from the frame edge, in figure-heights. Tuned by capture against the panel
 * spread: the pair sits far enough in that a whole head clears the frame edge, and high enough
 * that the head lands in the clear band ABOVE the comic cards (the art card's top edge is the
 * tighter of the two, so the left corner is what set these numbers).
 */
export const PEEKER_INSET_X = 0.52
export const PEEKER_INSET_Y = 0.5
/** How far above the top edge the figure waits before entering, in figure-heights. */
export const PEEKER_HIDE_RISE = 1.15
/** Extra outward drift while hidden — they swing in around the corner, not straight down. */
export const PEEKER_HIDE_OUT = 0.22
/** Parked inward lean (rad), plus the extra tilt carried while still off-frame. */
export const PEEKER_LEAN = 0.2
export const PEEKER_LEAN_EXTRA = 0.34
/** Yaw so each figure turns its face toward the middle of the frame. */
export const PEEKER_FACE_IN = 0.3

// --- dwell windows ----------------------------------------------------------
//
// Panel dwell is t ∈ [0,1). The panel card itself is fully in by t ≈ 0.45 (easeOutBack of
// t*2.2 in chapter-panels.tsx); the peekers ride in just behind it so the card lands first
// and keeps the read, then they clear out before the dwell ends.
export const PEEK_IN_START = 0.06
export const PEEK_IN_END = 0.36
export const PEEK_OUT_START = 0.84
export const PEEK_OUT_END = 1
/** The right-hand peeker trails its partner by this much dwell — a beat, not a mirror. */
export const PEEK_SIDE_STAGGER = 0.05

/**
 * Presence 0 → 1 across the dwell: 0 while parked off-frame, 1 (with an easeOutBack
 * overshoot past the parked pose) once in. Used directly as the hidden→parked lerp, so the
 * overshoot IS the settle. Reduced motion swaps the springy ramp for a plain smoothstep.
 */
export function peekerPresence(t: number, reduced = false): number {
  const rise = clamp01((t - PEEK_IN_START) / (PEEK_IN_END - PEEK_IN_START))
  const fall = clamp01((t - PEEK_OUT_START) / (PEEK_OUT_END - PEEK_OUT_START))
  // Multiplied, not min()'d: a min would clip the entrance overshoot flat against the exit
  // term's 1 and quietly cost the springy settle.
  return (reduced ? smoothstep(rise) : easeOutBack(rise)) * (1 - smoothstep(fall))
}

/** Signed −1…1 idle oscillation over the dwell — the one gesture each character owns. */
export function peekerIdle(t: number, cycles: number, phase: number): number {
  return Math.sin(TAU * (t * cycles + phase))
}

// --- pangolin roll ----------------------------------------------------------
/** Dwell window over which a pangolin unfurls from its ball, just after it parks. */
export const PEEK_UNROLL_START = 0.34
export const PEEK_UNROLL_SPAN = 0.24
/** Turns the ball spins away while rolling in. */
export const PEEK_ROLL_TURNS = 1.6

export function peekerUnroll(t: number): number {
  return smoothstep(clamp01((t - PEEK_UNROLL_START) / PEEK_UNROLL_SPAN))
}

/** Ball spin (rad) that unwinds to exactly 0 as the figure reaches its parked pose. */
export function peekerRollSpin(presence: number): number {
  return (1 - clamp01(presence)) * PEEK_ROLL_TURNS * TAU
}

// --- placement --------------------------------------------------------------

export type PeekerPlacement = {
  /** World height of a figure (uniform scale — figures are authored ~1 unit tall). */
  size: number
  /** Parked distance from the frame's centre line; multiply by the side (−1 left, +1 right). */
  x: number
  /** Parked height above the frame's centre line. */
  y: number
  /** Height the figure waits at while off-frame. */
  hiddenY: number
  /** Extra outward offset carried while off-frame. */
  hiddenOut: number
}

/** Figure height for a frustum — see PEEKER_SIZE_FRAC. */
export function peekerSize(halfH: number, halfW: number): number {
  return PEEKER_SIZE_FRAC * Math.min(halfH, halfW * PEEKER_NARROW_GAIN)
}

/**
 * Corner staging for the frustum half-extents at PEEKER_DEPTH. Derived, never hardcoded:
 * `halfH = depth · tan(fov/2)` and `halfW = halfH · aspect` come from the live camera, so a
 * resize or a phone viewport re-stages the pair instead of stranding them mid-frame.
 */
export function peekerPlacement(halfH: number, halfW: number): PeekerPlacement {
  const size = peekerSize(halfH, halfW)
  return {
    size,
    x: halfW - PEEKER_INSET_X * size,
    y: halfH - PEEKER_INSET_Y * size,
    hiddenY: halfH + PEEKER_HIDE_RISE * size,
    hiddenOut: PEEKER_HIDE_OUT * size,
  }
}

/**
 * Vertical clearance (in NDC-y) between the lowest point a parked peeker can reach and the
 * planet's silhouette in the same screen column. Positive means the corner is pure sky.
 *
 * The planet projects as an ellipse: NDC-y radius `tan(asin(ceiling/dist)) / tan(fov/2)`,
 * NDC-x radius the same over the aspect. `ceiling` is the standing terrain+prop ceiling
 * budget (1.35·R), not the mean radius — the bench must clear the tallest possible spire.
 */
export function peekerPlanetClearance(
  aspect: number,
  fovDeg: number,
  cameraDistance: number,
  ceiling: number
): number {
  const halfH = PEEKER_DEPTH * Math.tan((fovDeg * Math.PI) / 360)
  const halfW = halfH * aspect
  const place = peekerPlacement(halfH, halfW)
  const lowest = (place.y - PEEKER_FIGURE_RADIUS * place.size) / halfH
  const column = Math.abs(place.x + PEEKER_HIDE_OUT * place.size) / halfW

  const ry = Math.tan(Math.asin(ceiling / cameraDistance)) / Math.tan((fovDeg * Math.PI) / 360)
  const rx = ry / aspect
  if (column >= rx) return lowest // no planet at all in that column
  return lowest - ry * Math.sqrt(1 - (column / rx) * (column / rx))
}

/** Depth margin (world units) between the nearest peeker fragment and the planet's ceiling. */
export function peekerDepthMargin(
  halfH: number,
  halfW: number,
  cameraDistance: number,
  ceiling: number
): number {
  const size = peekerSize(halfH, halfW)
  return PEEKER_DEPTH - PEEKER_FIGURE_RADIUS * size - (cameraDistance + ceiling)
}

// --- the cast ---------------------------------------------------------------

export type PeekerKind =
  | 'macaw'
  | 'cockatoo'
  | 'crocGape'
  | 'crocPeek'
  | 'camelAdult'
  | 'camelCalf'
  | 'pangolinBig'
  | 'pangolinSmall'
  | 'yetiBig'
  | 'yetiSmall'

export type PeekerPair = readonly [left: PeekerKind, right: PeekerKind]

/**
 * Journey-order cast. Chapter → wedge is fixed by the scene mounts: 0 = A0 spring,
 * 1 = A1 jungle, 2 = A2 delta, 3 = B0 desert, 4 = B1 canyon, 5 = B2 winter.
 *
 * Spring is deliberately BARE for now — Aram's "first woody area" reads as the jungle
 * chapter (he had already asked for birds over the jungle canopy), so the birds land there
 * and chapter 1 gets nothing until he says otherwise.
 *
 * The two sides are always DIFFERENT characters from the same family: a scarlet macaw and a
 * crested cockatoo, a gaping croc and a squinting one, a camel and its calf, a big pangolin
 * and a small one, a shaggy yeti and a small curious one.
 */
export const PEEKER_CAST: readonly (PeekerPair | null)[] = [
  null,
  ['macaw', 'cockatoo'],
  ['crocGape', 'crocPeek'],
  ['camelAdult', 'camelCalf'],
  ['pangolinBig', 'pangolinSmall'],
  ['yetiBig', 'yetiSmall'],
]

export function peekerCastFor(chapter: number): PeekerPair | null {
  return PEEKER_CAST[chapter] ?? null
}

import * as THREE from 'three'
import { easeOutBack, smoothstep } from '../../journey-timeline'

/**
 * Task 53 — pure staging math for the CHECKPOINT PEEKERS: per-biome clay characters that
 * lean in from the top-left and top-right of the frame while a chapter's panel is up.
 *
 * Everything here is pure and frame-independent so the rig (peekers.tsx) is a thin
 * transform writer. Three things are deliberately NOT hardcoded:
 *
 *  - Placement is derived from the live frustum half-extents at the peeker depth, so the
 *    corners follow the viewport (a phone's frustum corner is nowhere near a desktop's).
 *  - The left-hand figure is staged around the labs chrome's fixed-pixel back-link pill,
 *    which swallows a larger share of the corner the smaller the viewport gets.
 *  - Entrance/exit/idle are driven by the chapter's PANEL DWELL FRACTION (JourneyState.panel.t,
 *    the same source the DOM panels read), never a wall clock — scrubbing back and forth
 *    replays them exactly.
 */

const TAU = Math.PI * 2
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

// --- depth ------------------------------------------------------------------
//
// The peekers live in SKY, well behind the planet: at this camera-space depth every peeker
// fragment is farther from the camera than the planet's ceiling budget, so the depth buffer
// alone guarantees the standing "planet is never covered" contract — a peeker physically
// cannot draw over the world. It is also far in front of the sky plane (world z = -20).
export const PEEKER_DEPTH = 17.5

// --- size -------------------------------------------------------------------
//
// A figure is authored ~1 unit tall, so `size` IS its world height. Sizing off the frustum's
// half-HEIGHT keeps a peeker the same share of the screen at every aspect (three's fov is
// vertical); the half-width term only bites on narrow/portrait viewports, where it shrinks the
// figures so a phone's corner is not swallowed by one animal.
export const PEEKER_SIZE_FRAC = 0.36
/**
 * How much of the half-WIDTH a figure may claim on portrait frames. Lowered from 1.35 when the
 * corrected clearance bench showed the old value grazing the planet on tall portrait viewports:
 * a narrow frame puts the corner column close to the middle, where the planet's silhouette is
 * tallest, and the entrance overshoot then dipped the figure's lower-outer corner into it.
 */
export const PEEKER_NARROW_GAIN = 1.15

/**
 * The local bounding box every cast figure fits inside, in figure-heights, across its whole
 * gesture range — MEASURED, not assumed: peeker-cast.test.ts builds the real merged geometry
 * for all ten characters, reproduces the scene graph (root tilt, limb joints, limb transforms),
 * sweeps the gesture range and pins this box. Both clearance benches below rest on it, so a
 * figure that quietly outgrew it would make both of them optimistic.
 *
 * Signed and per-axis on purpose: a macaw's raised wingtip reaches far further up and out than
 * anything reaches DOWN, and only the downward and inward reaches bear on planet clearance.
 * Authored for dir = +1 (the left-hand facing); the right-hand figure is its mirror.
 */
export const PEEKER_FIGURE_BOX = {
  minX: -0.72,
  maxX: 0.71,
  minY: -0.7,
  maxY: 0.89,
  absZ: 0.37,
} as const

/** Largest whole-figure sway any cast member asks for (pinned against PEEKER_SPECS). */
export const PEEKER_MAX_SWAY = 0.06

// --- parked / hidden pose ---------------------------------------------------
/** Parked inset from the frame edge, in figure-heights (so the outer sliver crops off-frame). */
export const PEEKER_INSET_X = 0.46
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

// --- the top-left navigation pill -------------------------------------------
//
// The labs chrome's "← GALLERY" back-link is a FIXED-PIXEL pill in the top-left corner —
// measured at 16..115 x 16..44 on every viewport from 390px to 1600px wide. It is shared UI this
// lab does not own and must not move, and because it does not scale it swallows a larger share
// of the corner the smaller the viewport gets. Two consequences, both handled here:
//
//  - The left-hand figure parks low enough that its EYE BAND clears the pill. Its crown may
//    still sit behind the pill; faces read from the eyes down, and dropping far enough to clear
//    a whole skull would push the figure into the planet on portrait viewports.
//  - Below PEEKER_LEFT_MIN_WIDTH the pill simply IS the top-left corner: at 390px it spans a
//    quarter of the frame's width and covers the whole of a peeker's head, with the panel card
//    immediately beneath it. No staging recovers a readable character there, so the left side is
//    dropped and the checkpoint shows its right-hand figure alone.
export const PEEKER_NAV_PILL = { right: 115, bottom: 44, pad: 6 } as const
export const PEEKER_LEFT_MIN_WIDTH = 575
/** Top of a figure's eye band, in figure-heights above its origin (authoring convention). */
export const PEEKER_FACE_TOP = 0.3
/** Cap on the left figure's nav drop, so a very short viewport cannot push it into the planet. */
export const PEEKER_LEFT_MAX_DROP = 0.28

// --- dwell windows ----------------------------------------------------------
//
// Panel dwell is t ∈ [0,1). The panel card itself is fully in by t ≈ 0.45 (easeOutBack of
// t*2.2 in chapter-panels.tsx); the peekers ride in just behind it so the card lands first
// and keeps the read, then they clear out before the dwell ends.
export const PEEK_IN_START = 0.06
export const PEEK_IN_END = 0.36
export const PEEK_OUT_START = 0.84
export const PEEK_OUT_END = 1

/**
 * The right-hand figure trails its partner by this much dwell — a beat, not a mirror.
 *
 * The stagger delays the ENTRANCE and pulls the exit EARLIER by the same amount. That asymmetry
 * is deliberate: `panel` goes null the instant dwell reaches 1, so a figure still mid-exit at
 * that moment is dropped rather than finishing. Delaying the trailing figure's exit instead
 * would leave it on frame at presence ≈ 0.23 when the panel unmounts, and any value past ~0.06
 * would make it pop out visibly at the end of every dwell. Leading the exit means both figures
 * are provably at exactly 0 before the panel can vanish, at any stagger.
 */
export const PEEK_SIDE_STAGGER = 0.05

/**
 * Presence 0 → 1 across the dwell: 0 while parked off-frame, 1 (with an easeOutBack overshoot
 * past the parked pose) once in. Used directly as the hidden→parked lerp, so the overshoot IS
 * the settle. Reduced motion swaps the springy ramp for a plain smoothstep.
 */
export function peekerPresence(t: number, reduced = false, stagger = 0): number {
  const rise = clamp01((t - stagger - PEEK_IN_START) / (PEEK_IN_END - PEEK_IN_START))
  const fall = clamp01((t + stagger - PEEK_OUT_START) / (PEEK_OUT_END - PEEK_OUT_START))
  // Multiplied, not min()'d: a min would clip the entrance overshoot flat against the exit
  // term's 1 and quietly cost the springy settle.
  return (reduced ? smoothstep(rise) : easeOutBack(rise)) * (1 - smoothstep(fall))
}

/** Peak of easeOutBack — how far past the parked pose a figure overshoots on the way in. */
export const PEEKER_PRESENCE_PEAK = 1.1

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
  /** Parked height above the frame's centre line (the right-hand figure). */
  y: number
  /** Parked height for the LEFT figure, dropped clear of the navigation pill. */
  leftY: number
  /** Whether the left corner has room for a figure at all (see PEEKER_LEFT_MIN_WIDTH). */
  leftVisible: boolean
  /** Height the figure waits at while off-frame. */
  hiddenY: number
  /** Extra outward offset carried while off-frame. */
  hiddenOut: number
}

/** Figure height for a frustum — see PEEKER_SIZE_FRAC. */
export function peekerSize(halfH: number, halfW: number): number {
  return PEEKER_SIZE_FRAC * Math.min(halfH, halfW * PEEKER_NARROW_GAIN)
}

/** Frustum half-height at the peeker depth for a vertical fov in degrees. */
export function peekerHalfHeight(fovDeg: number): number {
  return PEEKER_DEPTH * Math.tan((fovDeg * Math.PI) / 360)
}

/**
 * Corner staging for the frustum half-extents at PEEKER_DEPTH. Derived, never hardcoded:
 * `halfH = depth · tan(fov/2)` and `halfW = halfH · aspect` come from the live camera, so a
 * resize or a phone viewport re-stages the pair instead of stranding them mid-frame.
 *
 * `viewport` is needed because the navigation pill is a fixed PIXEL box: how far the left figure
 * must drop to clear it, and whether the left corner exists at all, are questions about absolute
 * screen size rather than aspect.
 */
export function peekerPlacement(
  halfH: number,
  halfW: number,
  viewport: { width: number; height: number }
): PeekerPlacement {
  const size = peekerSize(halfH, halfW)
  const y = halfH - PEEKER_INSET_Y * size

  // World height of the pill's lower edge, then the highest the left figure may sit for its eye
  // band to clear it — clamped so a very short viewport cannot drive the figure into the planet.
  const pillBottom = PEEKER_NAV_PILL.bottom + PEEKER_NAV_PILL.pad
  const pillBottomY = halfH * (1 - (2 * pillBottom) / viewport.height)
  const wanted = pillBottomY - PEEKER_FACE_TOP * size
  const leftY = Math.max(y - PEEKER_LEFT_MAX_DROP * size, Math.min(y, wanted))

  return {
    size,
    x: halfW - PEEKER_INSET_X * size,
    y,
    leftY,
    leftVisible: viewport.width >= PEEKER_LEFT_MIN_WIDTH,
    hiddenY: halfH + PEEKER_HIDE_RISE * size,
    hiddenOut: PEEKER_HIDE_OUT * size,
  }
}

/** The parked height for a side — the left one is dropped clear of the navigation pill. */
export function peekerParkedY(place: PeekerPlacement, side: -1 | 1): number {
  return side === -1 ? place.leftY : place.y
}

// --- reach and clearance ----------------------------------------------------

const _euler = new THREE.Euler()
const _mat = new THREE.Matrix4()
const _vec = new THREE.Vector3()

export type PeekerReach = {
  /** Lowest point the figure reaches, in world units above the frame's centre line. */
  lowestY: number
  /** Closest the figure comes to the frame's centre column, in world units. */
  innerX: number
  /** Nearest camera-space depth any of its geometry reaches. */
  nearestDepth: number
}

/**
 * Where a figure ACTUALLY reaches, for a given side and point in the entrance.
 *
 * Rotates the measured bounding box by the rig's own yaw and roll rather than assuming a sphere,
 * and takes `hide` as a parameter so callers can evaluate the entrance OVERSHOOT pose:
 * easeOutBack peaks at 1.10, which drives the figure 0.165·size BELOW its parked height and
 * slightly inward. Sampling the parked pose alone — or the outward hidden-drift column — measures
 * the easy side of the figure and flatters the clearance.
 */
export function peekerReach(
  place: PeekerPlacement,
  side: -1 | 1,
  hide: number,
  sway: number
): PeekerReach {
  const yaw = -side * PEEKER_FACE_IN
  const roll = side * (PEEKER_LEAN + hide * PEEKER_LEAN_EXTRA) + sway
  _euler.set(0, yaw, roll, 'XYZ')
  _mat.makeRotationFromEuler(_euler)

  const b = PEEKER_FIGURE_BOX
  // the right-hand figure is the mirror of the authored box
  const xs = side === -1 ? [b.minX, b.maxX] : [-b.maxX, -b.minX]
  const parkedY = peekerParkedY(place, side)
  const cx = side * (place.x + hide * place.hiddenOut)
  const cy = parkedY + hide * (place.hiddenY - parkedY)

  let lowestY = Infinity
  let innerX = Infinity
  let nearestDepth = Infinity
  for (const x of xs) {
    for (const y of [b.minY, b.maxY]) {
      for (const z of [-b.absZ, b.absZ]) {
        _vec.set(x, y, z).applyMatrix4(_mat).multiplyScalar(place.size)
        lowestY = Math.min(lowestY, cy + _vec.y)
        innerX = Math.min(innerX, Math.abs(cx + _vec.x))
        // camera-space depth is -z; local +z leans toward the camera and shortens it
        nearestDepth = Math.min(nearestDepth, PEEKER_DEPTH - _vec.z)
      }
    }
  }
  return { lowestY, innerX, nearestDepth }
}

/** Poses swept by the benches: the settle window, where a figure sits lowest and most inward. */
const SETTLE_HIDES = [-0.1, -0.05, 0, 0.1, 0.2, 0.35]
const SWAYS = [-PEEKER_MAX_SWAY, 0, PEEKER_MAX_SWAY]

/** NDC-y radius of the planet's projected silhouette for a given world extent. */
export function planetNdcRadius(fovDeg: number, cameraDistance: number, extent: number): number {
  return Math.tan(Math.asin(extent / cameraDistance)) / Math.tan((fovDeg * Math.PI) / 360)
}

/**
 * Vertical separation (NDC-y) between the lowest point any peeker reaches and the planet's
 * silhouette in that same screen column — swept over both sides, the settle window and the sway
 * range, worst case returned. Positive means the corner is clear sky.
 *
 * Which `extent` to measure against is a real choice, so it is a parameter:
 *
 *  - The planet's own radius is the silhouette a reader actually sees, and is what the shipped
 *    test gates on.
 *  - The 1.35·R terrain+prop CEILING budget is a different question. A maximal spire CAN rise
 *    into a peeker's column on portrait viewports; when it does, the planet occludes the
 *    peeker's lower body, which is depth-correct and harmless, because every peeker sits behind
 *    the entire budget (peekerDepthMargin). It can never happen the other way round.
 *
 * So this bench gates visual separation from the planet you see. The depth margin, not this, is
 * what makes "the planet is never covered" true.
 *
 * DELIBERATELY CONSERVATIVE, roughly 2x. `peekerReach` minimises the lowest y and the innermost x
 * INDEPENDENTLY across the box corners, so what gets compared is a point the figure never actually
 * occupies — lowest and innermost at the same time. It can therefore only ever UNDER-report
 * separation, never over-report, which is the safe direction for a guard; peeker-stage.test.ts
 * checks that property against a real surface sample. The cost is phantom alarms: at the shipped
 * constants it reports +0.049 where the true separation is +0.090, and it goes NEGATIVE over a
 * band around 575-730 x 640-840 px that no figure comes near. If you widen the swept viewport list
 * and see red there, that is this approximation talking — measure the true separation before
 * touching any staging constant, because re-tuning against a phantom would cost real readability.
 */
export function peekerPlanetClearance(
  viewport: { width: number; height: number },
  fovDeg: number,
  cameraDistance: number,
  extent: number
): number {
  const halfH = peekerHalfHeight(fovDeg)
  const halfW = (halfH * viewport.width) / viewport.height
  const place = peekerPlacement(halfH, halfW, viewport)
  const ry = planetNdcRadius(fovDeg, cameraDistance, extent)
  const rx = ry / (viewport.width / viewport.height)

  let worst = Infinity
  for (const side of [-1, 1] as const) {
    if (side === -1 && !place.leftVisible) continue
    for (const hide of SETTLE_HIDES) {
      for (const sway of SWAYS) {
        const reach = peekerReach(place, side, hide, sway)
        const column = reach.innerX / halfW
        const lowest = reach.lowestY / halfH
        const planetTop = column >= rx ? -Infinity : ry * Math.sqrt(1 - (column / rx) * (column / rx))
        worst = Math.min(worst, lowest - planetTop)
      }
    }
  }
  return worst
}

/**
 * Depth margin (world units) between the nearest peeker fragment and the planet's ceiling — the
 * hard guarantee that a peeker can never draw in front of the world. Swept over the same poses,
 * because the rig's yaw swings part of a figure's x extent into depth.
 */
export function peekerDepthMargin(
  viewport: { width: number; height: number },
  fovDeg: number,
  cameraDistance: number,
  ceiling: number
): number {
  const halfH = peekerHalfHeight(fovDeg)
  const halfW = (halfH * viewport.width) / viewport.height
  const place = peekerPlacement(halfH, halfW, viewport)

  let worst = Infinity
  for (const side of [-1, 1] as const) {
    for (const hide of SETTLE_HIDES) {
      for (const sway of SWAYS) {
        worst = Math.min(worst, peekerReach(place, side, hide, sway).nearestDepth)
      }
    }
  }
  return worst - (cameraDistance + ceiling)
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

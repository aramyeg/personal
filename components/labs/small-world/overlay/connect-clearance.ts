import { TRACK_END } from '../ending-timeline'
import {
  CAMERA_FOV,
  ENDING_AIM_DROP,
  ZOOM_FACTOR,
  cameraPositionAt,
  cameraTargetAt,
  endingRig,
} from '../scene/camera'
import { DESK_NOTE } from '../scene/desk-stage'
import { PARALLAX_PITCH_MAX, orbitEyeInto, orbitRig, yawMaxFor } from '../scene/camera-parallax'
import { noteShiftBetween } from '../scene/note-parallax-shift'
import { noteNearEdgePoint } from './note-settle'

/**
 * HOW LOW THE NOTE HANGS UNDER EACH CONTROL, AND WHAT THE NARROW LAYOUT OWES IT
 * (Task 72 addendum — the phone half of review finding C2).
 *
 * ============================================================================
 * WHY THIS EXISTS SEPARATELY FROM `note-settle.ts`
 * ============================================================================
 * That file answers WHEN the note stops travelling, and one number does for every viewport because
 * ndc y is aspect-free. This one answers WHERE the note is under a given control, and that is not
 * aspect-free at all: the note's near edge FALLS to the right (775 px under Email against 794 under
 * LinkedIn at 1440x900), the pill row is px-anchored and centred, and which part of the edge a pill
 * covers therefore depends on the viewport's width. Two different questions about the same edge, so
 * both read `noteNearEdgePoint` and neither restates the geometry.
 *
 * ============================================================================
 * WHAT WAS ACTUALLY WRONG, MEASURED
 * ============================================================================
 * T72 shipped the entrance solved at 1440x900 and the phone inherited it. On the shipped build at
 * 390x844 the resting frame put the LinkedIn pill on 197 px of the note at full opacity, and the
 * approach was worse than the resting frame: Email was drawn over the sheet until it was 82%
 * revealed, GitHub until 98%, and LinkedIn never cleared at all. The desktop-tuned beat was correct
 * for the frame it was tuned on and simply did not describe the narrow one.
 *
 * The block cannot be scheduled out of this, because the collision is at REST. So on narrow frames
 * the row moves DOWN, by an amount this file derives rather than an amount anybody typed.
 *
 * ============================================================================
 * WHERE THE ROOM COMES FROM, AND IN WHICH ORDER
 * ============================================================================
 * The block is anchored to the bottom edge and stacks nav → gap → restart → inset. Moving the pills
 * down means spending one of the two spacings, and they are spent in a deliberate order:
 *
 *  1. THE GAP FIRST, down to `GAP_FLOOR`. It is decorative spacing between two lines of the same
 *     block, and tightening it reads as one group rather than two.
 *  2. THE INSET SECOND, down to `INSET_FLOOR`. It is the block's margin from the edge of the
 *     screen, so it is spent last and floored well above zero. `env(safe-area-inset-bottom)` still
 *     wins over it through the same `max()` the block always used, so a notched phone is unaffected
 *     by this arithmetic entirely.
 *
 * If the two together cannot cover what the geometry asks for, `connectSpacingFor` returns what it
 * could buy AND the shortfall, rather than silently under-delivering — the caller ships the best
 * available layout and the test suite fails loudly on the number.
 *
 * ============================================================================
 * AND THEN THE BREATH MOVED THE NOTE (second addendum)
 * ============================================================================
 * Everything above solves the layout at ZERO pointer input. Task 72's parallax orbits the camera at
 * the money shot, which slides the note in the frame while this block stays bolted to the viewport;
 * a blind review caught the LinkedIn pill cutting through the "Aram" signature.
 *
 * Solving the clearance across the whole envelope INSTEAD is impossible, and the numbers are in
 * `note-parallax-shift.ts`: the worst pose asks the row to sit 57.9 px lower at 1440x900, which puts
 * the restart link off the bottom of the viewport. So the block RIDES the note instead, and what is
 * left for this file is the residual that tracking cannot remove — the sheet's own perspective
 * shear, because a flat quad seen at an angle does not translate rigidly on screen.
 *
 * That residual is real: at 1440x900 it turns a 2.3 px resting clearance into −5.99 px at the
 * pitched-up corner. So the solve now takes the WORSE of two requirements, and the second one
 * reaches wide frames that the first deliberately does not.
 *
 * ============================================================================
 * WHAT THIS DOES NOT FIX, AND THE NUMBERS THAT SAY SO
 * ============================================================================
 * Moving the row down fixes the resting frame and IMPROVES the approach, but does not clear it: the
 * note still crosses the row while the pills are partly revealed (0.34 / 0.41 / 0.61 against the old
 * 0.82 / 0.98 / never). It cannot be closed by moving the row further, because the camera's
 * smoothstep has zero derivative at 1 — the note's last stretch is asymptotic, so it lingers just
 * below wherever the row sits and no reachable offset buys meaningful timing. Closing it needs a
 * narrow-specific entrance start, which is a second beat and a separate call; it is written up in
 * task-72-report.md rather than half-built here.
 */

/**
 * Below this viewport width the RESTING term applies. At and above it, the resting layout is the
 * approved desktop composition with its own thin margin and Aram's call was to leave it — so only
 * the envelope term below can move a wide frame, and only when a breath can actually happen.
 */
export const NARROW_MAX_WIDTH = 900

/** How far below the note's lowest point under the row the pills' top edge must sit.
 *
 *  8 px rather than a hair: desktop's own worst clearance is 1.7 px by this model (3.4 rendered),
 *  which is exactly the margin that made the phone's inherited version collide the moment the frame
 *  changed shape. A margin that survives a re-bake nudging the note is the point. */
export const CLEARANCE_MARGIN = 8

/**
 * ...and how far it must clear at the EXTREMES of the breath, which is a different question.
 *
 * Smaller than the resting margin on purpose. `CLEARANCE_MARGIN` protects the frame everybody sees
 * and screenshots — the settled money shot — and it is sized to survive a re-bake nudging the note
 * or a font changing the row's height. This one guards a pose a visitor can only hold by keeping
 * the pointer jammed in a corner, where the requirement is that the row is VISIBLY off the sheet
 * rather than comfortably clear of it. 4 px is still wider than the 3.4 px the approved desktop
 * resting composition shipped with for four rounds.
 *
 * It is a judgement, and it is the one number in this file that is not solved from geometry. What
 * keeps it honest is that both shipped viewports are gated against it with no shortfall, and the
 * report prints where each lands.
 */
export const ENVELOPE_MARGIN = 4

/** The block's authored spacings — the desktop layout, unchanged and load-bearing as the baseline. */
export const GAP_BASE = 12
export const INSET_BASE = 20
/** ...and how far each may be spent. */
export const GAP_FLOOR = 6
export const INSET_FLOOR = 10

const TAN_HALF_FOV = Math.tan((CAMERA_FOV * Math.PI) / 360)

/** A camera basis, spelled the way `lookAt` builds one. */
type Basis = { cam: readonly number[]; right: readonly number[]; up: readonly number[]; fwd: readonly number[] }

/** A point on the note's near edge, projected to viewport pixels through a given pose. */
function nearEdgePxAt(lx: number, rig: Basis, width: number, height: number): { x: number; y: number } {
  const p = noteNearEdgePoint(lx)
  const v = [p[0] - rig.cam[0], p[1] - rig.cam[1], p[2] - rig.cam[2]]
  const depth = v[0] * rig.fwd[0] + v[1] * rig.fwd[1] + v[2] * rig.fwd[2]
  const up = v[0] * rig.up[0] + v[1] * rig.up[1] + v[2] * rig.up[2]
  const right = v[0] * rig.right[0] + v[1] * rig.right[1] + v[2] * rig.right[2]
  const aspect = width / height
  const ndcX = right / (depth * TAN_HALF_FOV * aspect)
  const ndcY = up / (depth * TAN_HALF_FOV)
  return { x: ((ndcX + 1) / 2) * width, y: ((1 - ndcY) / 2) * height }
}

/**
 * The un-orbited money-shot pose.
 *
 * The camera sits on the x = 0 plane with `fwd.x = 0` and no roll (`camera.ts`'s `endingRig`), so
 * world x IS the camera's right axis — the same fact `camera-parallax.ts` builds its turntable on.
 * `endingRig` is called at the fully pulled-back pose because this is a question about the RESTING
 * layout; `noteLowestPxAtPose` below is the same question at a pose the breath has moved.
 */
function restingBasis(): Basis {
  const rig = endingRig(ZOOM_FACTOR, ENDING_AIM_DROP)
  // the base rig sits on x = 0 with fwd.x = 0 and no roll, so world x IS its right axis
  return { cam: rig.cam, right: [1, 0, 0], up: rig.up, fwd: rig.fwd }
}

function nearEdgePx(lx: number, width: number, height: number): { x: number; y: number } {
  return nearEdgePxAt(lx, restingBasis(), width, height)
}

/** How finely the edge is walked. 600 samples across 2.37 world units is under a tenth of a pixel
 *  of screen spacing at every shipped viewport, so the maximum below is the edge's, not the walk's. */
const EDGE_SAMPLES = 600

/**
 * The LOWEST the note's near edge reaches on screen between two viewport x positions, in px from the
 * top — or `null` when the edge does not cross that span at all (nothing to clear).
 *
 * Sampled rather than solved: the edge's screen path is a projected straight line, but the span test
 * is on the projected x, and walking it is exact enough at a tenth of a pixel while staying obviously
 * correct. Validated against rendered masks — see the table in the test.
 */
export function noteLowestPxBetween(
  x0: number,
  x1: number,
  width: number,
  height: number
): number | null {
  let lowest: number | null = null
  const half = DESK_NOTE.width / 2
  for (let i = 0; i <= EDGE_SAMPLES; i++) {
    const lx = -half + (i / EDGE_SAMPLES) * DESK_NOTE.width
    const p = nearEdgePx(lx, width, height)
    if (p.x < x0 || p.x > x1) continue
    if (lowest === null || p.y > lowest) lowest = p.y
  }
  return lowest
}

/**
 * The same, at an ARBITRARY camera pose — what the parallax envelope is gated with.
 *
 * The resting solve above is the special case where the eye is the un-orbited one. This exists so
 * the gate can ask the question at the poses the breath actually reaches, through the same
 * projection and the same edge walk rather than through a second copy of them.
 */
export function noteLowestPxAtPose(
  x0: number,
  x1: number,
  width: number,
  height: number,
  eye: readonly [number, number, number],
  aim: readonly [number, number, number]
): number | null {
  const rig = orbitRig(eye, aim)
  let lowest: number | null = null
  const half = DESK_NOTE.width / 2
  for (let i = 0; i <= EDGE_SAMPLES; i++) {
    const lx = -half + (i / EDGE_SAMPLES) * DESK_NOTE.width
    const p = nearEdgePxAt(lx, rig, width, height)
    if (p.x < x0 || p.x > x1) continue
    if (lowest === null || p.y > lowest) lowest = p.y
  }
  return lowest
}

/** The five pointer deflections the breath can reach: centred, and each corner at full throw. */
const ENVELOPE: [number, number][] = [
  [0, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]

/**
 * The worst clearance the row has anywhere in the parallax envelope, WITH the block's tracking
 * applied — i.e. the number the visitor can actually produce by shoving the pointer into a corner.
 *
 * Tracking makes the note's motion and the block's motion cancel to first order, so what is left is
 * the sheet's own perspective shear: it is a flat quad seen at an angle, and it does not translate
 * rigidly on screen. That residual is what this measures, and it is the whole reason the envelope
 * needs its own term rather than inheriting the resting one — at 1440x900 it eats 8.3 px, which is
 * five times the resting margin the approved composition happens to have.
 */
export function worstClearanceOverEnvelope(
  navTop: number,
  navLeft: number,
  navRight: number,
  width: number,
  height: number
): number {
  const base = cameraPositionAt(TRACK_END)
  const aim = cameraTargetAt(TRACK_END)
  const aspect = width / height
  let worst = Infinity
  for (const [cx, cy] of ENVELOPE) {
    const eye = orbitEyeInto(
      base,
      aim,
      cx * yawMaxFor(aspect),
      cy * PARALLAX_PITCH_MAX,
      [0, 0, 0]
    )
    const d = noteShiftBetween(base, eye, aim, aspect)
    // the block rides the note, so its rectangle moves by the same amount the note does
    const dx = (d.x * width) / 2
    const dy = (-d.y * height) / 2
    const low = noteLowestPxAtPose(navLeft + dx, navRight + dx, width, height, eye, aim)
    if (low === null) continue
    const clearance = navTop + dy - low
    if (clearance < worst) worst = clearance
  }
  return worst === Infinity ? Number.POSITIVE_INFINITY : worst
}

export type ConnectSpacing = {
  /** Gap between the pill row and the restart link, px. */
  gap: number
  /** The block's own inset from the bottom edge, px — before `env(safe-area-inset-bottom)`. */
  inset: number
  /** How far the row moved down from the authored layout, px. */
  lift: number
  /** What the geometry asked for but the floors could not buy, px. 0 when fully satisfied. */
  shortfall: number
  /** The resulting gap between the note's lowest point under the row and the row's top edge, px. */
  clearance: number
}

/** The authored layout, which is what every wide frame gets. */
const BASE: ConnectSpacing = {
  gap: GAP_BASE,
  inset: INSET_BASE,
  lift: 0,
  shortfall: 0,
  clearance: Number.NaN,
}

/**
 * The spacings the connect block should use, given where its row has actually been laid out.
 *
 * `navTop`, `navLeft` and `navRight` are the row's MEASURED rectangle. They are measured rather than
 * derived because the row's height and width depend on font loading and on the label text — the
 * restart link is set in the hand (`--sw-font-hand`), which lands late — and a layout solved from
 * assumed text metrics is a layout that is wrong for the first paint and after any copy change.
 * The geometry is pure and testable; only the rectangle comes from the DOM.
 *
 * Wide frames return the authored constants by IDENTITY, not by arithmetic that happens to agree:
 * the desktop resting layout is approved and this may not perturb it by a float.
 */
export function connectSpacingFor(
  rect: {
    width: number
    height: number
    navTop: number
    navLeft: number
    navRight: number
  },
  opts: { parallax?: boolean } = {}
): ConnectSpacing {
  const { width, height, navTop, navLeft, navRight } = rect
  if (!(width > 0) || !(height > 0) || !(navRight > navLeft)) return BASE

  const lowest = noteLowestPxBetween(navLeft, navRight, width, height)
  if (lowest === null) return BASE

  // THE RESTING TERM. Narrow frames only: the desktop resting composition is approved with its own
  // thin margin and Aram's call was to leave it, so this term does not reach it.
  const restWanted =
    width >= NARROW_MAX_WIDTH ? 0 : lowest + CLEARANCE_MARGIN - navTop

  // THE ENVELOPE TERM. Every frame, but only when a breath can actually happen — a reduced-motion
  // visitor has no parallax and must not pay a pixel for one.
  const envelopeWanted =
    opts.parallax === false
      ? 0
      : ENVELOPE_MARGIN - worstClearanceOverEnvelope(navTop, navLeft, navRight, width, height)

  const wanted = Math.max(restWanted, envelopeWanted)
  if (!(wanted > 0)) return { ...BASE, clearance: navTop - lowest }

  const fromGap = Math.min(wanted, GAP_BASE - GAP_FLOOR)
  const fromInset = Math.min(wanted - fromGap, INSET_BASE - INSET_FLOOR)
  const lift = fromGap + fromInset
  return {
    gap: GAP_BASE - fromGap,
    inset: INSET_BASE - fromInset,
    lift,
    shortfall: wanted - lift,
    clearance: navTop + lift - lowest,
  }
}

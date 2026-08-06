import { ENDING_AIM_DROP, ZOOM_FACTOR, ndcYAt } from '../scene/camera'
import { DESK_NOTE, DESK_TOP_Y } from '../scene/desk-stage'

/**
 * WHERE THE NOTE IS IN THE FRAME, AND WHEN IT HAS STOPPED GOING THERE (Task 72, review finding C2).
 *
 * ============================================================================
 * THE THING THAT IS ACTUALLY MOVING
 * ============================================================================
 * A blind playthrough found the connect pills printed across the note's second line through roughly
 * 96–98% of the track, and described the note as sliding under them. The note does not slide. It is
 * a static mesh on a static desk (`DESK_NOTE`, seated at z = 10.55) and it never moves at all.
 *
 * What moves is the CAMERA. The ending pulls back and re-aims downward on one shared smoothstep
 * (`scene/camera.ts`), and the desk is the nearest thing in the scene, so as the aim drops the desk
 * — and the note lying on it — sweeps UP the frame from below the bottom edge. Measured on the
 * shipped build at 1440x900, the note's near edge is off the bottom of the frame until about 96% of
 * the track, crosses the pills' band between 96.5% and 99%, and only clears their top edge in the
 * last percent. That crossing is the defect: the pills were already at 0.52–0.93 opacity while the
 * note was still travelling through them.
 *
 * So "wait until the note settles" is a statement about the camera's curve, and this module is the
 * arithmetic for it. It is separated from `ending-connect.tsx` because it is geometry rather than
 * presentation, and because the connect block should be reading a derived beat rather than carrying
 * a projection of its own.
 *
 * ============================================================================
 * WHY THIS IS ONE NUMBER AND NOT ONE PER VIEWPORT
 * ============================================================================
 * ndc Y does not depend on the aspect. three.js holds the VERTICAL fov fixed and widens the
 * horizontal one with the viewport, so every point's height in the frame is the same on a phone and
 * on an ultrawide — the same aperture argument `desk-stage.ts` rests its containment proof on and
 * `camera.ts` rests the money shot's composition on. The note's screen TRAVEL is therefore a pure
 * function of `zoom`, and a beat solved from it holds at every viewport at once. (The pills' own
 * position is px-anchored to the bottom edge and so is NOT aspect-free; that is why the gate below
 * is on the note's motion rather than on an overlap, and why the overlap is then MEASURED at both
 * shipped viewports rather than asserted.)
 *
 * ============================================================================
 * THE EDGE THAT MATTERS
 * ============================================================================
 * The pills sit below the note, so the binding edge is the note's NEAR one — its lowest line on
 * screen. The sheet is yawed by `DESK_NOTE.rot`, so that edge is not at a constant z: it runs from
 * one corner to the other, and its lowest point is a corner far to the right of the pills. Sampling
 * the corner would therefore describe a part of the note the pills cannot reach. This samples the
 * near edge where the pills actually are — at world x = 0, the frame's centre line — by solving the
 * yawed edge for the u that lands there.
 *
 * The model was checked against pixels rather than trusted: it predicts the near edge at 787.7 px on
 * a 900 px frame at full pull-back where the rendered mask measures 783, and it holds that ~5 px
 * bias (the sheet's anti-aliased lip) at every stop from 97% to 100% of the track. A model that
 * tracks the render to five pixels across the whole window is measuring the right line.
 */

const smoothstep = (t: number): number => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

const LOG_ZOOM = Math.log(ZOOM_FACTOR)

/**
 * The z of the note's near edge where it crosses the frame's centre line.
 *
 * The sheet's local near edge is the set of points (u, +depth/2) for u across its width; the yaw
 * turns that into world (x, z). Solving x(u) = 0 and substituting gives the z below. With the
 * shipped yaw of −0.13 rad it lands at 11.193, a little nearer than the un-yawed 11.180.
 */
export const NOTE_NEAR_Z = (() => {
  const s = Math.sin(DESK_NOTE.rot)
  const c = Math.cos(DESK_NOTE.rot)
  const halfDepth = DESK_NOTE.depth / 2
  // x(u) = u·c − halfDepth·s + DESK_NOTE.x  =  0
  const u = (halfDepth * s - DESK_NOTE.x) / c
  return u * s + halfDepth * c + DESK_NOTE.z
})()

/** ...and how high that edge rides, which is the flat sheet rather than the curled corner. */
const NOTE_EDGE_Y = DESK_TOP_Y + DESK_NOTE.lift

/**
 * The note's near edge in ndc y at a point in the pull-back. −1 is the bottom of the frame, so the
 * value CLIMBS through the ending: it is −6.65 at the top of the pull-back (far below the frame)
 * and −0.75 at the money shot.
 */
export function noteEdgeNdcY(zoom: number): number {
  const e = smoothstep(zoom)
  return ndcYAt([0, NOTE_EDGE_Y, NOTE_NEAR_Z], Math.exp(LOG_ZOOM * e), ENDING_AIM_DROP * e)
}

/**
 * How much of the note's screen travel may still be ahead of it for it to count as SETTLED.
 *
 * Expressed as a fraction of its own total travel rather than in ndc or in pixels, because the
 * question "has it stopped moving" is about the curve rather than about the distance: the camera's
 * smoothstep has zero derivative at 1, so the note's last stretch is asymptotic and there is no
 * frame at which it exactly halts. A fraction of the whole is what makes "settled" decidable.
 *
 * 0.02 is not a taste, it is a measured boundary. Both candidates were captured on the running
 * build at 1440x900 and the note's rendered mask was counted under each control's own rectangle
 * (the pills are drawn OVER the note, so the count is taken from a clean plate with the block
 * forced transparent). At 0.03 the LinkedIn pill sits on 39 px of note at 0.911 opacity — above
 * `LIVE_AT`, i.e. the exact defect the review reported, merely smaller — and at 98.5% of the track
 * all three anchors are drawn across the sheet (779, 1334 and 2211 px). At 0.02 every control is at
 * opacity 0.000 for that whole stretch, and the largest overlap anywhere in a control's LEGIBLE
 * range is zero. Tightening further buys nothing measurable and costs entrance length, which is the
 * one thing this window has none of to spare.
 *
 * ── TWO THINGS THIS CANNOT FIX, RECORDED RATHER THAN HIDDEN ───────────────────────────────────
 * FIRST: the approved money shot clears the LinkedIn pill by 2.4 px at 1440x900. There is no
 * threshold that buys a comfortable margin, because the resting composition does not have one.
 *
 * SECOND, and it is the one worth escalating: at 390x844 the resting frame does not clear it at
 * all. The LinkedIn pill overlaps the note by 217 px at full opacity AT THE BOTTOM OF THE TRACK,
 * on the shipped build, before and after this change alike — the block is px-anchored to the
 * bottom edge while the note's height in the frame is aspect-free, so the narrow viewport hands the
 * same rest position less room. Scheduling cannot reach it: it is where the pills REST, and the
 * resting layout is approved. Fixing it means moving a resting position, which is a separate call.
 */
export const NOTE_SETTLE_REMAINING = 0.02

/**
 * The zoom at which the note has settled — SOLVED, so a retuned aim drop, zoom factor, desk height
 * or note placement walks the connect block's entrance with it instead of leaving it stranded on a
 * beat that used to be true.
 *
 * The bisection is honest because the note's height in the frame is monotone in `zoom`: the camera
 * withdraws and aims down on one shared easing that never reverses, and the note is a fixed point in
 * front of it, so its remaining travel falls without a turning point.
 *
 * It lands at 0.812 of the pull-back — about 98.2% of the whole track. That is very late, and it is
 * late because the geometry leaves nowhere else to be: the note is still crossing the pills' band at
 * 99%. The entrance that fits is ~30vh of scroll, which is a third of a viewport and a perfectly
 * ordinary reveal distance; what it is not is the 149vh the old window spent.
 */
export const NOTE_SETTLED_ZOOM = (() => {
  const end = noteEdgeNdcY(1)
  const total = end - noteEdgeNdcY(0)
  let lo = 0
  let hi = 1
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if ((end - noteEdgeNdcY(mid)) / total > NOTE_SETTLE_REMAINING) lo = mid
    else hi = mid
  }
  return hi
})()

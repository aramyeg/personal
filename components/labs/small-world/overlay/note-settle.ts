import { ENDING_AIM_DROP, ZOOM_FACTOR, ndcYAt } from '../scene/camera'
import { DESK_NOTE } from '../scene/desk-stage'
import { DESK_PAD } from '../scene/props/desk-glb-contract'

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
 * one corner to the other, and it falls to the RIGHT — measured, 775 px under the Email pill against
 * 794 under LinkedIn at 1440x900. This module samples it at world x = 0, the frame's centre line,
 * which is the right sample for the question it answers (WHEN has the note stopped travelling) and
 * the wrong one for the question `connect-clearance.ts` answers (WHERE is it under each control).
 * That file takes the whole edge; this one takes the centre, and both read `noteNearEdgePoint`.
 *
 * The earlier note here claimed the low corner sat "far to the right of the pills", which the
 * corrected geometry falsifies: the pill row reaches into exactly the part of the edge that dips.
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
 * A point on the note's near edge, in world space — SPELLED THE WAY `desk-note.tsx` SPELLS IT.
 *
 * ── A CORRECTION, TASK 72 ADDENDUM ────────────────────────────────────────────────────────────
 * This file originally wrote the yaw as `x = lx·c − hd·s`, `z = lx·s + hd·c`. The mesh writes
 * `x = x₀ + lx·c + lz·s`, `z = z₀ − lx·s + lz·c` (`desk-note.tsx`, the sheet's vertex loop), and it
 * seats the sheet on `DESK_PAD.top` rather than on `DESK_TOP_Y`. Two errors, both small at the one
 * place this file used to look: 0.016 world units of z and 0.036 of y at the frame's centre line,
 * which is why the ±5 px pixel check below passed and why `NOTE_SETTLED_ZOOM` barely moves.
 *
 * They are NOT small away from the centre. The z sign flips the edge's SLOPE across the note's
 * width — the old spelling has the sheet rising to the right where the render has it falling — so
 * anything asking where the note is under a control at some x got the mirror image of the truth.
 * `connect-clearance.ts` asks exactly that, which is how this surfaced. Corrected here rather than
 * worked around there, so there is one spelling of the note's geometry and it is the mesh's.
 *
 * `lx` runs across the sheet's width, −width/2 at its left edge; the near edge is `lz = +depth/2`.
 */
export function noteNearEdgePoint(lx: number): [number, number, number] {
  const s = Math.sin(DESK_NOTE.rot)
  const c = Math.cos(DESK_NOTE.rot)
  const lz = DESK_NOTE.depth / 2
  return [
    DESK_NOTE.x + lx * c + lz * s,
    // the flat sheet rather than the curled corner, seated on the PAD the figurines also sit on
    DESK_PAD.top + DESK_NOTE.lift,
    DESK_NOTE.z - lx * s + lz * c,
  ]
}

/** Where that edge crosses the frame's centre line — the sample the settle beat is solved on. */
export const NOTE_NEAR_Z = (() => {
  const s = Math.sin(DESK_NOTE.rot)
  const c = Math.cos(DESK_NOTE.rot)
  const lz = DESK_NOTE.depth / 2
  // x(lx) = DESK_NOTE.x + lx·c + lz·s = 0
  const lx = (-DESK_NOTE.x - lz * s) / c
  return noteNearEdgePoint(lx)[2]
})()

const NOTE_EDGE_Y = noteNearEdgePoint(0)[1]

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
 * ── WHAT A THRESHOLD CANNOT REACH, RECORDED RATHER THAN HIDDEN ────────────────────────────────
 * FIRST: the approved money shot clears the LinkedIn pill by 1.7 px of model (3.4 rendered) at
 * 1440x900. There is no threshold that buys a comfortable margin, because the approved resting
 * composition does not have one. Left alone deliberately, and pinned by a test so it cannot quietly
 * get worse.
 *
 * SECOND: every number in this file was measured at 1440x900, and the phone did not inherit the
 * result — at 390x844 the resting frame put the LinkedIn pill ON the sheet, and the approach was
 * worse than the rest (Email drawn over the note until 82% revealed, GitHub until 98%, LinkedIn
 * never clearing). A resting collision is not a scheduling problem, so it is not solved here:
 * `connect-clearance.ts` moves the ROW on narrow frames, by a derived amount, and this window is
 * left exactly as it was. The residue that neither file fixes — the note still crossing a partly
 * revealed row on the way up, now at 0.34/0.41/0.61 instead of 0.82/0.98/never — is in that file's
 * header and in task-72-report.md, because closing it needs a second, narrow-specific beat.
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

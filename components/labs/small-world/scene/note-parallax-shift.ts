import { noteNearEdgePoint } from '../overlay/note-settle'
import { CAMERA_FOV } from './camera'
import { orbitRig } from './camera-parallax'

/**
 * HOW FAR THE PARALLAX HAS SLID THE NOTE, IN NDC — the one number the connect block needs
 * (Task 72, second addendum).
 *
 * ============================================================================
 * WHY THIS EXISTS AT ALL
 * ============================================================================
 * The breath orbits the camera at the money shot, so every object in the scene slides in the frame.
 * The connect block is NOT in the scene — it is real DOM anchored to the viewport's bottom edge
 * (Task 65 chose that deliberately, so the addresses survive being tabbed to, copied and read
 * aloud). Two things that must keep a fixed relationship were therefore attached to two different
 * frames of reference, and the first pointer move pulled them apart: a blind review of the combined
 * tip caught the LinkedIn pill's edge cutting through the hand-written "Aram" signature.
 *
 * THE FIX THAT DOES NOT WORK, WITH THE NUMBERS THAT KILL IT. The obvious move is to solve the
 * block's clearance against the note's extent across the WHOLE parallax envelope instead of at zero
 * input — the same solve `connect-clearance.ts` already does, over five poses instead of one. It is
 * arithmetically fine and physically impossible. The pitch swings the note's near edge ±50 px in
 * the frame, so the worst pose asks the row to sit 57.9 px lower at 1440×900 and 42.6 px lower at
 * 390×844. The block is ~85 px tall and rests ~20 px off the bottom edge: granting either would
 * push the restart link clean off the viewport (932 px of layout in a 900 px frame). There is no
 * lift that satisfies the envelope, at any viewport, because the envelope is larger than the space
 * beneath the note.
 *
 * So the block stops fighting the camera and RIDES it. The relationship is made invariant instead
 * of made roomy: the block translates by exactly the displacement the parallax gives the note, so
 * the gap the approved layout has at zero input is the gap it has at every pose. Nothing about the
 * resting composition moves — at zero pointer input this is exactly ±0 and the block is where Task
 * 65 put it, to the pixel.
 *
 * ============================================================================
 * WHAT IS PUBLISHED, AND WHY IT IS A DIFFERENCE RATHER THAN A POSITION
 * ============================================================================
 * The rig writes the note's reference point projected through the COMPOSED pose minus the same
 * point through the UN-ORBITED pose. A difference, for two reasons:
 *
 *  1. It is exactly zero whenever the parallax is, by subtraction of identical arithmetic — so the
 *     journey, the still beat and a reduced-motion visitor pay nothing and the block cannot drift.
 *  2. It contains no scroll. The pull-back's own motion is in BOTH terms and cancels, so this
 *     carries the pointer's contribution alone and the block stays a pure function of scroll plus
 *     the same pointer layer the camera already reads. A published absolute position would have
 *     smuggled the camera's scroll animation into the DOM.
 *
 * In NDC rather than pixels because the rig does not know the viewport in CSS pixels — r3f's
 * drawing buffer is not the layout box under a device pixel ratio, and the block is laid out in CSS
 * pixels. The overlay multiplies by its own half-width and half-height, which is the only place
 * both facts are known.
 *
 * The vertical field of view is read from `camera.ts`'s own constant rather than off the live
 * camera object: it is what the composition was solved at and what every containment proof in the
 * lab assumes, so a camera that ever disagreed with it would be the bug, not the input.
 *
 * ============================================================================
 * THE REFERENCE POINT, AND THE ERROR THAT COMES WITH CHOOSING ONE
 * ============================================================================
 * The note is a flat sheet seen in perspective, so it does not translate rigidly on screen — it
 * shears and scales slightly as the camera swings. One point cannot describe that exactly, and the
 * point chosen is the near edge at the sheet's centre (`lx = 0`), which is the part of the note the
 * row actually sits under.
 *
 * The residual is NOT argued away, it is measured and then paid for. `connect-clearance.test.ts`
 * re-runs the real per-pill clearance at all five poses WITH this tracking applied; the shear comes
 * to 6.29 px at 1440x900 (2.5 px on a phone), which is more than the approved desktop resting
 * composition's own margin.
 * So `connect-clearance.ts` carries an ENVELOPE term that buys the row enough room to absorb it —
 * tracking alone would still have let the pill touch the sheet at the pitched-up corner (−5.99 px),
 * and the first draft of this paragraph claimed otherwise before the gate was written.
 */

/** The point on the note whose screen motion the block follows — see the header. */
export const NOTE_TRACK_POINT: readonly [number, number, number] = noteNearEdgePoint(0)

/**
 * The published shift, in NDC, written every frame by the camera rig and read by the overlay.
 *
 * A module-level mutable object rather than state or context: it is written inside `useFrame` and
 * read inside a `requestAnimationFrame`, sixty times a second, by two trees that do not share a
 * React parent (the canvas and the overlay are siblings). Anything reactive here would re-render
 * the overlay on every frame of a pointer move, which is the cost this design exists to avoid.
 */
export const noteParallaxShift = { x: 0, y: 0 }

const TAN_HALF_FOV = Math.tan((CAMERA_FOV * Math.PI) / 360)

/** ndc of a world point at a pose, given the basis `lookAt` builds. */
function ndcOf(
  p: readonly [number, number, number],
  rig: ReturnType<typeof orbitRig>,
  aspect: number
): { x: number; y: number } {
  const v = [p[0] - rig.cam[0], p[1] - rig.cam[1], p[2] - rig.cam[2]]
  const depth = v[0] * rig.fwd[0] + v[1] * rig.fwd[1] + v[2] * rig.fwd[2]
  const right = v[0] * rig.right[0] + v[1] * rig.right[1] + v[2] * rig.right[2]
  const up = v[0] * rig.up[0] + v[1] * rig.up[1] + v[2] * rig.up[2]
  return { x: right / (depth * TAN_HALF_FOV * aspect), y: up / (depth * TAN_HALF_FOV) }
}

/**
 * The note's parallax displacement between an un-orbited eye and the orbited one, in NDC.
 *
 * Pure, and returned rather than written, so the whole thing is testable without a canvas; the
 * writer below is the only stateful part.
 */
export function noteShiftBetween(
  baseEye: readonly [number, number, number],
  orbitedEye: readonly [number, number, number],
  aim: readonly [number, number, number],
  aspect: number
): { x: number; y: number } {
  const a = ndcOf(NOTE_TRACK_POINT, orbitRig(baseEye, aim), aspect)
  const b = ndcOf(NOTE_TRACK_POINT, orbitRig(orbitedEye, aim), aspect)
  return { x: b.x - a.x, y: b.y - a.y }
}

/**
 * Publish it. Called from the camera rig with the poses it has already solved.
 *
 * The exact-zero branch is the same discipline `orbitEyeInto` uses and matters for the same reason:
 * a visitor who never moves a pointer, and a visitor under `prefers-reduced-motion`, must get a
 * hard +0 rather than a denormal that would leave the block permanently nudged by a subpixel and
 * the overlay's own change check permanently firing.
 */
export function writeNoteParallaxShift(
  baseEye: readonly [number, number, number],
  orbitedEye: readonly [number, number, number],
  aim: readonly [number, number, number],
  aspect: number,
  moved: boolean
): void {
  if (!moved) {
    noteParallaxShift.x = 0
    noteParallaxShift.y = 0
    return
  }
  const d = noteShiftBetween(baseEye, orbitedEye, aim, aspect)
  noteParallaxShift.x = d.x
  noteParallaxShift.y = d.y
}

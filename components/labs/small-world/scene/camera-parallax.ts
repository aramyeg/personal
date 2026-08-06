import type { EndingState } from '../ending-timeline'
import { STUDIO_LIGHTS_FULL } from './desk-studio'

/**
 * THE BREATH (Task 72) — a few degrees of orbit at the desk stop, and nothing anywhere else.
 *
 * ============================================================================
 * WHAT THIS IS FOR
 * ============================================================================
 * Aram's question was "how do we show this is a real 3D scene and not a photograph of one", and
 * his answer was that at the final stop the scene should BREATHE. A still frame and a rendered
 * frame are indistinguishable until something moves relative to something else; the cheapest
 * honest proof of depth is PARALLAX, so the pointer nudges the camera a couple of degrees around
 * the pose it has settled into and the desk slides against the world behind it. The speculars come
 * with it — the glaze, the coffee and the rose gold all compute their reflection from
 * `cameraPosition` per fragment (`desk-glb.tsx`), so a camera that moves is a highlight that
 * sweeps, which is the second thing a photograph cannot do.
 *
 * ============================================================================
 * THE ARCHITECTURE LAW, AND HOW IT IS KEPT
 * ============================================================================
 * This is an ADDITIVE LAYER COMPOSED AFTER the scroll camera. `scene/camera.ts` still solves the
 * whole pose from scroll and nothing here may edit that solve — the Task 63 / Task 66 invariant
 * (the pose is BIT-IDENTICAL to the static pose everywhere rotation can still change, position AND
 * aim) is what the renewal proofs, the hidden flip window and every GatedProp margin rest on.
 *
 * Two independent things keep it, and the first would be enough:
 *
 *  1. THE ENVELOPE IS EXACTLY ZERO until the pull-back is nearly over. `parallaxGainAt` is
 *     `smootherstep` of a window that opens at `STUDIO_LIGHTS_FULL`, and `smootherstep` clamps, so
 *     it returns exactly +0 for every `zoom` at or below that — which is the entire journey, the
 *     entire still beat and the first four fifths of the pull-back. The angles are the damped
 *     pointer TIMES that gain (never damped toward a gain-scaled target), so `gain === 0` makes
 *     them exactly ±0 by multiplication rather than by a damping race that a fast scrub could lose.
 *  2. `orbitEyeInto` GUARDS ON EXACT ZERO and returns a COPY of the base pose, not arithmetic that
 *     happens to be an identity. `(E − T) + T` is not guaranteed to be `E` in IEEE-754, so a rig
 *     that "rotated by zero" would be bit-identical only by luck. This one is bit-identical by
 *     construction, and `camera-parallax.test.ts` sweeps it rather than trusting the sentence.
 *
 * THE AIM NEVER MOVES. The orbit is about the aim point, so `cameraTargetInto` is not composed with
 * anything at all — the Task 66 aim invariant is untouched in the strongest possible way, by there
 * being no second code path for the aim to travel. It is also the right picture: the subject stays
 * framed and the VIEWPOINT slides around it, which is what leaning to see past something looks
 * like. Orbiting about the camera instead would be a pan, and a pan moves the composition Aram
 * approved.
 *
 * SCROLL PURITY HOLDS. Scroll still fully determines the base pose; this reads the POINTER only,
 * never scroll. The one clock in the file is the touch drift, and it is multiplied by the same
 * envelope, so during the journey no clock reaches the camera at all.
 *
 * ============================================================================
 * WHY THE WINDOW OPENS AT `STUDIO_LIGHTS_FULL`
 * ============================================================================
 * Not "at zoom === 1", which would be a step: the parallax would snap on at one scroll position
 * and be absent a pixel above it. Not "over the whole pull-back" either — a camera that is already
 * travelling does not need help proving it can move, and a pointer-driven wobble on top of a
 * moving pull-back is two gestures competing.
 *
 * `STUDIO_LIGHTS_FULL` is the beat where the ending stops CHANGING: the studio reaches full there
 * and the closing fifth of the pull-back is deliberately settled at the approved picture
 * (`desk-studio.ts` argues that at length). So the breath begins exactly where the arrival ends,
 * and the two can never overlap. Taken as a relation rather than restated as a number, so retuning
 * the studio's ramp moves this with it instead of silently opening a gap.
 */

/** Where the pointer's orbit begins, as a fraction of the pull-back — the beat the studio finishes on. */
export const PARALLAX_IN_AT = STUDIO_LIGHTS_FULL

/**
 * How far the camera may swing, in DEGREES, at full envelope and full pointer deflection.
 *
 * "A few degrees max" was the instruction and these are the small end of it, for a reason that is
 * about the composition rather than about taste. At the money shot the eye sits 18.86 world units
 * from the aim, so a degree of yaw is 0.33 units of lateral travel — and the frame is only ±5.6
 * units wide where the desk's back edge crosses it. Every degree spends a real fraction of a
 * composition that was solved to three targets (`camera.ts`), and the parallax is not allowed to
 * re-open that solve.
 *
 * PITCH IS HALF OF YAW, and that asymmetry is the geometry rather than a preference. The frame's
 * vertical budget is spent: the desk's back edge is pinned at `DESK_EDGE_V`, the world's lower
 * silhouette sits `STAND_GAP` above it, and the globe stand's foot has 0.151 of the frame's
 * half-height of clearance under whichever edge is holding it. Horizontally the slab is sized for
 * an aspect of 4 and the backdrop plane is 140 units wide, so yaw has room that pitch does not.
 * `camera-parallax.test.ts` gates both directions against the real frustum instead of trusting
 * this paragraph, and the numbers are in task-72-report.md.
 */
export const PARALLAX_YAW_DEG = 2.4
export const PARALLAX_PITCH_DEG = 1.2

const DEG = Math.PI / 180

/** ...in radians, which is what the rig actually multiplies. */
export const PARALLAX_YAW_MAX = PARALLAX_YAW_DEG * DEG
export const PARALLAX_PITCH_MAX = PARALLAX_PITCH_DEG * DEG

/**
 * The aspect the budget above is spent at: the frame every approved capture of this ending was
 * judged on (1440×900, Task 66 through Task 71). Stated as the ratio rather than as 1.6 so it
 * reads as the reference frame it is.
 */
export const PARALLAX_REF_ASPECT = 1440 / 900

/**
 * THE YAW SHRINKS ON A NARROW FRAME, AND THE PITCH DOES NOT.
 *
 * This is arithmetic, not a mobile special case. three's PerspectiveCamera holds the VERTICAL fov
 * fixed and widens the horizontal one, so ndc y does not depend on the aspect at all while ndc x
 * is divided by it — the same aperture argument `desk-stage.ts` rests its containment proof on. A
 * fixed yaw ANGLE therefore buys a fixed world-space swing that costs a phone 3.5× as much of its
 * frame as it costs a laptop: measured on the shipped geometry, 2.4° slides the note 0.113 of ndc
 * at 1440×900 and 0.392 at 390×844, and the ratio is exactly the ratio of the aspects.
 *
 * There is a thing in frame that makes the difference matter rather than merely be untidy. The
 * note was sized to very nearly FILL the phone (`desk-stage.ts`, `DESK_NOTE.width`) — captured at
 * the declared 360-wide floor, "Aram" is already cropped by the right edge on the shipped build,
 * before any of this existed. A composition with no side margin cannot afford a camera that
 * spends side margin, and the note may not be resized: Task 71's money shot is approved.
 *
 * So the budget is spent in FRAME units and converted to an angle per aspect, which makes the
 * parallax cost exactly the same fraction of the picture on every device. Capped at 1 rather than
 * scaled both ways: an ultrawide frame has the room for more, but "more" would be a different
 * gesture than the one that was judged, and the reference is a ceiling rather than a target.
 */
export function yawMaxFor(aspect: number): number {
  if (!(aspect > 0)) return PARALLAX_YAW_MAX
  return PARALLAX_YAW_MAX * Math.min(1, aspect / PARALLAX_REF_ASPECT)
}

/**
 * How fast the camera catches up with the pointer, as an exponential rate in inverse seconds.
 *
 * Heavily damped on purpose. The pointer is a discontinuous input — it teleports across the window
 * between two frames if the visitor flicks — and a camera that tracked it exactly would be a
 * judder, not a breath. At 2.2 the camera covers 90% of a jump in about a second, which reads as
 * the frame LEANING rather than following.
 *
 * Frame-rate independent by construction: the step is `1 − exp(−λ·dt)`, so a 30 Hz visitor and a
 * 120 Hz visitor see the same motion in wall-clock terms rather than the same motion per frame.
 * `useDampedJourney` uses the identical form at λ = 4 for the scroll itself; this is deliberately
 * slower than the thing it rides on.
 */
export const PARALLAX_LAMBDA = 2.2

/**
 * Below this much of a remaining gap, the damper LANDS instead of approaching.
 *
 * An exponential never arrives, and "never arrives" is how a value that should be zero stays a
 * denormal forever — which would mean the rig re-derives and re-`lookAt`s the camera on every
 * frame of a scene nobody is touching, and the skip in `scene.tsx` would never fire again. The
 * snap is what gives the pointer a real path back to EXACTLY zero (leave the window, and the
 * target is 0; a second later the angle is 0 and the rig goes quiet).
 *
 * 1e-5 radians is 0.0006 degrees, which at the money shot's 18.86-unit lever is 0.0002 world
 * units — four orders of magnitude below a pixel. It is a rounding decision, not a visible one.
 */
export const PARALLAX_SNAP = 1e-5

/**
 * THE TOUCH DRIFT — what a device with no pointer gets instead.
 *
 * A finger cannot hover, so there is no pointer position to read and the whole mechanism would
 * simply be absent on a phone. Aram asked for "a very slow autonomous drift instead (long-period,
 * small)", and the shape that gives is two sine waves at periods that do not divide each other:
 * the pair repeats only every LCM(19, 27) = 513 seconds, so nothing about it reads as a loop
 * inside any visit.
 *
 * The amplitude is a FRACTION of the pointer's, and lower than it, because the two are answering
 * different questions. A pointer-driven orbit is a response — the visitor moved, the frame
 * answered — and it may be as large as the composition allows. An autonomous one is ambient, and
 * an ambient motion at the same amplitude is the frame drifting off its marks by itself.
 *
 * The clock is the one impurity in this file and it is scoped to nothing: the drift is multiplied
 * by the same envelope every other consumer reads, so outside the money shot it contributes
 * exactly ±0 and the camera is a pure function of scroll again. Two touch visitors who sit at the
 * bottom of the track for different lengths of time see different frames; nothing else differs,
 * and nothing that is proved about this lab is proved about the bottom of the track.
 */
export const DRIFT_SCALE = 0.55
export const DRIFT_YAW_PERIOD = 19
export const DRIFT_PITCH_PERIOD = 27

/** Zero in the first and second derivative at both ends — the same easing the studio's own ramp
 *  uses, and for the same reason: neither end of this may be a catchable event. */
const smootherstep = (t: number): number => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/**
 * How much of the orbit is available at a pull-back position.
 *
 * Exactly +0 at and below `PARALLAX_IN_AT` (`smootherstep` clamps, and `0·0·0·(…)` is +0) and
 * exactly 1 at `zoom === 1` (`1·1·1·(6−15+10)`), so both ends are exact rather than asymptotic —
 * which is what lets the bit-identity claim above be a claim about arithmetic rather than about
 * tolerance.
 */
export function parallaxGainAt(zoom: number): number {
  return smootherstep((zoom - PARALLAX_IN_AT) / (1 - PARALLAX_IN_AT))
}

/** The same, from an ending state — the form the rig actually calls. */
export const parallaxGainFor = (ending: EndingState): number => parallaxGainAt(ending.zoom)

/**
 * One exponential damping step. `cur` and `target` equal ⇒ returns `target` EXACTLY, which is the
 * property the whole zero-input story rests on: `Math.abs(0 − 0) < PARALLAX_SNAP` is true, so a
 * camera nobody has touched returns +0 without ever evaluating `Math.exp`.
 */
export function dampAngle(cur: number, target: number, lambda: number, dt: number): number {
  if (Math.abs(target - cur) < PARALLAX_SNAP) return target
  return cur + (target - cur) * (1 - Math.exp(-lambda * dt))
}

/**
 * The autonomous drift's angles at a wall-clock time, in radians BEFORE the envelope.
 *
 * Written into `out` so the frame loop allocates nothing.
 */
export function driftAnglesInto(
  seconds: number,
  aspect: number,
  out: [number, number]
): [number, number] {
  out[0] = Math.sin((seconds / DRIFT_YAW_PERIOD) * Math.PI * 2) * yawMaxFor(aspect) * DRIFT_SCALE
  out[1] = Math.sin((seconds / DRIFT_PITCH_PERIOD) * Math.PI * 2) * PARALLAX_PITCH_MAX * DRIFT_SCALE
  return out
}

/**
 * A pointer position in the viewport → the orbit it asks for, in radians BEFORE the envelope.
 *
 * `px`/`py` are the viewport in normalised device terms: −1 at the left/top edge, +1 at the
 * right/bottom, 0 dead centre. Clamped, because a pointer can be reported outside the viewport
 * (drag out of the window, a trackpad overshoot) and the composition's budget was solved for the
 * edges rather than for wherever the browser last saw the cursor.
 *
 * SIGNS: the camera FOLLOWS the pointer. Move right and the eye swings right, revealing the
 * desk's right-hand side — the gesture of leaning over to see past something. The opposite
 * convention (the scene leans toward the pointer) reads as the object turning to face you, which
 * is a different and busier idea, and it fights the fact that the aim is pinned.
 */
export function pointerAnglesInto(
  px: number,
  py: number,
  aspect: number,
  out: [number, number]
): [number, number] {
  const x = px < -1 ? -1 : px > 1 ? 1 : px
  const y = py < -1 ? -1 : py > 1 ? 1 : py
  out[0] = x * yawMaxFor(aspect)
  out[1] = y * PARALLAX_PITCH_MAX
  return out
}

/**
 * THE COMPOSITION — the base eye orbited about the base aim, written into `out`.
 *
 * `R = Ry(yaw) · Rx(pitch)` applied to `eye − aim`. Pitch first about world x and yaw second about
 * world y, which is a turntable: the eye stays on a sphere about the aim, and because the BASE rig
 * puts the camera on the x = 0 plane with no roll, world x IS the camera's right axis at the pose
 * the rotation starts from. `camera.lookAt` then rebuilds the basis against world up, so the
 * horizon stays level at every combination of the two — there is no roll to accumulate.
 *
 * THE GUARD IS THE POINT. At exactly zero this COPIES; it does not rotate by zero. See the header.
 * `-0 === 0` is true in JavaScript, so an angle that arrived as `x · +0` with a negative `x` takes
 * the same branch.
 */
export function orbitEyeInto(
  eye: readonly [number, number, number],
  aim: readonly [number, number, number],
  yaw: number,
  pitch: number,
  out: [number, number, number]
): [number, number, number] {
  if (yaw === 0 && pitch === 0) {
    out[0] = eye[0]
    out[1] = eye[1]
    out[2] = eye[2]
    return out
  }
  const vx = eye[0] - aim[0]
  const vy = eye[1] - aim[1]
  const vz = eye[2] - aim[2]

  // Rx(pitch): a positive pitch LOWERS the eye, so pushing the pointer down leans the view toward
  // the desk's own plane rather than up over it.
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const px = vx
  const py = vy * cp - vz * sp
  const pz = vy * sp + vz * cp

  // Ry(yaw): a positive yaw carries the eye toward +x, i.e. toward a pointer on the right.
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  out[0] = aim[0] + px * cy + pz * sy
  out[1] = aim[1] + py
  out[2] = aim[2] - px * sy + pz * cy
  return out
}

/**
 * The camera's full basis at an orbited pose — SPELLED THE WAY `THREE.Camera.lookAt` SPELLS IT.
 *
 * The containment gate has to project world points through the pose the renderer will actually
 * use, and "the pose the renderer will actually use" is `orbitEyeInto` followed by `lookAt`. So
 * this reproduces `Object3D.lookAt`'s own construction — `z = normalize(eye − target)`,
 * `x = normalize(up × z)`, `y = z × x`, with `up` the default (0, 1, 0) — rather than an
 * independently derived orthonormal frame that would agree with it only until one of them changed.
 * `camera.ts`'s `endingRig` is the un-orbited special case of this and stays where it is; it is
 * load-bearing for the composition solve and must not grow a parameter.
 */
export function orbitRig(
  eye: readonly [number, number, number],
  aim: readonly [number, number, number]
): {
  cam: [number, number, number]
  right: [number, number, number]
  up: [number, number, number]
  fwd: [number, number, number]
} {
  const zx = eye[0] - aim[0]
  const zy = eye[1] - aim[1]
  const zz = eye[2] - aim[2]
  const zl = Math.hypot(zx, zy, zz)
  const z: [number, number, number] = [zx / zl, zy / zl, zz / zl]
  // up × z, with up = (0, 1, 0)
  const xx = z[2]
  const xz = -z[0]
  const xl = Math.hypot(xx, 0, xz)
  const x: [number, number, number] = [xx / xl, 0, xz / xl]
  const y: [number, number, number] = [
    z[1] * x[2] - z[2] * x[1],
    z[2] * x[0] - z[0] * x[2],
    z[0] * x[1] - z[1] * x[0],
  ]
  return { cam: [eye[0], eye[1], eye[2]], right: x, up: y, fwd: [-z[0], -z[1], -z[2]] }
}

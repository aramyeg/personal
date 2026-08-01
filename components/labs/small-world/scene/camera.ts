import { endingStateAt, type EndingState } from '../ending-timeline'

/**
 * THE CAMERA — its one static pose, and the ending's pull-back path.
 *
 * Pure scalar math, no three.js import, so the invariant below can be pinned in a
 * plain unit test without a canvas. scene.tsx mounts the Canvas with
 * `CAMERA_POSITION` and drives it per frame through `cameraPositionInto` and
 * `cameraTargetInto`.
 *
 * Composition target (reference-language research): whole planet visible with
 * void margin, filling ~55% of the viewport's shorter axis; camera above the
 * planet's centre height, looking down ~20°.
 *
 * THE INVARIANT (ending-timeline.ts carries the argument; this is the arithmetic
 * that honours it): for every progress where rotation can still change, this
 * module must return the static pose BIT-IDENTICALLY, not approximately.
 *   - `endingStateAt` returns `zoom = 0` for all progress <= ZOOM_FIRST_MOVE.
 *   - `smoothstep(0)` is exactly 0 (0·0·(3−0)).
 *   - `Math.exp(x·0)` is exactly 1 (ECMAScript: exp(+0) → 1).
 *   - `CAMERA_DISTANCE · 1` is exactly CAMERA_DISTANCE (IEEE-754: x·1 = x).
 *   - `ENDING_AIM_DROP · 0` is exactly +0 and `0 − (+0)` is exactly +0, so the AIM
 *     is bit-identically CAMERA_TARGET over the same domain — the ending re-aims
 *     as well as withdraws (Task 66), and both halves of the pose have to hold.
 *   - `CAMERA_RAY[i] · CAMERA_DISTANCE` is exactly `CAMERA_DISTANCE · CAMERA_RAY[i]`
 *     (IEEE-754 multiplication is commutative), which is how CAMERA_POSITION is
 *     spelled — so the two expressions agree to the last bit rather than to some
 *     epsilon a future edit could quietly widen.
 * There is no branch doing this work; the identity falls out of the arithmetic,
 * and `ending-camera.test.ts` samples the whole journey domain to prove it.
 */

export const CAMERA_FOV = 38
export const CAMERA_PITCH_DEG = 20
/** World units from the planet's centre — tuned against CAMERA_FOV for the fill target above. */
export const CAMERA_DISTANCE = 12.1

const PITCH = (CAMERA_PITCH_DEG * Math.PI) / 180

/** Unit ray from the planet's centre toward the camera. The pull-back travels along it. */
export const CAMERA_RAY: readonly [number, number, number] = [0, Math.sin(PITCH), Math.cos(PITCH)]

/** What the camera aims at DURING THE JOURNEY, and where the ending's aim path starts. */
export const CAMERA_TARGET: readonly [number, number, number] = [0, 0, 0]

/**
 * The planet's radius, restated rather than imported.
 *
 * `land-bake.ts` owns it, and importing it here would pull the whole bake module — worker glue,
 * noise fields, the epilogue tables — into every consumer of the camera, including the DOM-side
 * overlay. `ending-camera.test.ts` pins `WORLD_RADIUS === PLANET_RADIUS` so the copy cannot drift;
 * that is a relation pin, which is the form T63 learned to prefer after a range pin let the
 * camera/peeker priority tie through review.
 */
export const WORLD_RADIUS = 2.2

const TAN_HALF_FOV = Math.tan((CAMERA_FOV * Math.PI) / 360)

/** The one static pose: what the Canvas mounts with, and what the rig must reproduce exactly. */
export const CAMERA_POSITION: [number, number, number] = [
  0,
  CAMERA_DISTANCE * Math.sin(PITCH),
  CAMERA_DISTANCE * Math.cos(PITCH),
]

/**
 * ============================================================================
 * THE MONEY SHOT, AS THREE NUMBERS (Task 66)
 * ============================================================================
 * Round 20 pulled back 3× and Aram's verdict was "too much white space around the
 * globe sitting on the desk". The instinct is to zoom less — but zooming less, on
 * its own, does not remove any white space at all. It MOVES it: the desk's back
 * edge is a line whose screen height is a pure 1/depth in the pull-back, so it
 * climbs into frame more slowly than the world shrinks. Measured on the shipped
 * Round-20 geometry, sky owns 43.5% of the centre column at 3× and 43.0% at 1.5×.
 * The complaint survives the obvious fix.
 *
 * What actually spends that sky is where the frame is AIMED. So the composition is
 * authored as three targets and everything else is solved from them:
 *
 *   GLOBE_FRAME  — how tall the world stands in the frame at full pull-back.
 *                  Solves ZOOM_FACTOR.
 *   DESK_FRAME   — how much of the frame the desk surface owns there.
 *                  Solves ENDING_AIM_DROP (here) and DESK_TOP_Y (desk-stage.ts).
 *   STAND_GAP    — the band between the world's bottom silhouette and the desk's
 *                  back edge, which is exactly the room the globe stand stands in.
 *
 * They are not independent of each other and that is the point: pick the world's
 * size and the desk's share, and the aim that seats one on the other is arithmetic
 * rather than taste. `ending-camera.test.ts` re-derives all three off the shipped
 * constants instead of restating them.
 */

/** The world's silhouette as a fraction of the viewport HEIGHT at full pull-back. */
export const GLOBE_FRAME = 0.355

/** ...and the share of the frame the desk surface owns there, measured from the bottom. */
export const DESK_FRAME = 0.4

/**
 * The band the stand occupies, in ndc (the frame spans 2). Small on purpose: the
 * cradle wraps the world's lower silhouette, so most of the stand's screen height
 * is ABOVE the world's bottom rather than below it, and what is left under it is a
 * collar and a hint of stem before the desk's edge takes over.
 */
export const STAND_GAP = 0.12

/** The desk's back edge in ndc y at full pull-back — what DESK_FRAME means as a line. */
export const DESK_EDGE_V = DESK_FRAME * 2 - 1

/**
 * How much further away the camera ends up at full pull-back — SOLVED from GLOBE_FRAME.
 *
 * A sphere of radius R seen from distance D subtends asin(R/D); its silhouette fills
 * `tan(asin(R/D)) / tan(fov/2)` of the frame's height. Inverting that for D and
 * dividing by CAMERA_DISTANCE is the whole derivation, in closed form:
 *
 *     u = GLOBE_FRAME · tan(fov/2),   sin = u/√(1+u²),   D = R/sin
 *
 * 0.355 lands ZOOM_FACTOR at 1.498 — a little under half Round 20's 3×. The world
 * goes from 53.7% of the frame at rest to 35.5%, where Round 20 took it to 17.6%.
 * It also barely widens the visible cap: acos(R/D) goes from 79.5° to 83.0°, so the
 * pull-back reveals 3.5° of new surface — all of it in its final renewal state,
 * since every gate is saturated at ROTATION_TOTAL. The sky follows the zoom for
 * free (see `cameraZoomScale`).
 */
export const ZOOM_FACTOR = (() => {
  const u = GLOBE_FRAME * TAN_HALF_FOV
  return WORLD_RADIUS * Math.sqrt(1 + u * u) / (CAMERA_DISTANCE * u)
})()

// ---------------------------------------------------------------------------
// THE PROJECTION, in the plane the whole ending lives in
// ---------------------------------------------------------------------------
//
// The camera is on the x = 0 plane, aims at a point on it, and has no roll, so every
// composition question in this ending — where the world's silhouette lands, where the
// desk's back edge lands, where the stand's foot lands — is a question about ndc Y,
// and ndc Y does not depend on the aspect at all (three.js holds the VERTICAL fov
// fixed and widens the horizontal one). That is the same aperture argument
// `desk-stage.ts` rests its containment proof on, reused here for the composition.

/** The camera's basis at a zoom scale and an aim drop. `up` is `right × fwd` with right = +x. */
export function endingRig(k: number, aimDrop: number) {
  const cam: [number, number, number] = [0, CAMERA_DISTANCE * k * Math.sin(PITCH), CAMERA_DISTANCE * k * Math.cos(PITCH)]
  const len = Math.hypot(cam[1] + aimDrop, cam[2])
  const fwd: [number, number, number] = [0, (-aimDrop - cam[1]) / len, -cam[2] / len]
  return { cam, fwd, up: [0, -fwd[2], fwd[1]] as [number, number, number] }
}

/** A world point's ndc y (the frame spans [-1, 1]) at a zoom scale and an aim drop. */
export function ndcYAt(p: readonly [number, number, number], k: number, aimDrop: number): number {
  const r = endingRig(k, aimDrop)
  const v = [p[0] - r.cam[0], p[1] - r.cam[1], p[2] - r.cam[2]]
  const depth = v[0] * r.fwd[0] + v[1] * r.fwd[1] + v[2] * r.fwd[2]
  return (v[0] * r.up[0] + v[1] * r.up[1] + v[2] * r.up[2]) / (depth * TAN_HALF_FOV)
}

/**
 * The world's silhouette edges in ndc y — the TANGENT points, not the centre ± a radius.
 *
 * Off the view axis those differ: a sphere projects to a circle whose centre is not the
 * projection of its centre, and the aim drop puts the world off axis by design. Solved
 * exactly by walking the tangent bearings in the (y, z) plane rather than approximated.
 */
export function globeEdgesAt(k: number, aimDrop: number): { top: number; bot: number } {
  const r = endingRig(k, aimDrop)
  const d = Math.hypot(r.cam[1], r.cam[2])
  const alpha = Math.asin(WORLD_RADIUS / d)
  const axis = Math.atan2(-r.cam[1], -r.cam[2])
  const reach = Math.sqrt(d * d - WORLD_RADIUS * WORLD_RADIUS)
  const ys = [axis + alpha, axis - alpha].map((ang) =>
    ndcYAt([0, r.cam[1] + reach * Math.sin(ang), r.cam[2] + reach * Math.cos(ang)], k, aimDrop)
  )
  return { top: Math.max(ys[0], ys[1]), bot: Math.min(ys[0], ys[1]) }
}

/**
 * How far BELOW the origin the ending's camera ends up aiming — SOLVED, so the money
 * shot's balance is a consequence of the three targets rather than a number someone
 * nudged until a screenshot looked right.
 *
 * The condition is one line: at full pull-back the world's bottom silhouette sits
 * exactly STAND_GAP above the desk's back-edge line. Both sides of it move together
 * when the aim moves — that is why the aim is what sets the DESK's share of the frame
 * while `DESK_TOP_Y` (desk-stage.ts) sets the gap — so the solve is monotone and a
 * bisection is honest. It runs once, at module load, and never again.
 *
 * At the shipped targets it comes out at 1.8857 world units, which is 5.391° of extra
 * downward pitch by the bottom of the track. Task 65 considered a re-aim and declined
 * it, correctly, on the grounds that 3× already split the frame evenly; at 1.5× it no
 * longer does, and the same option is now the thing that makes the composition work.
 */
export const ENDING_AIM_DROP = (() => {
  const want = DESK_EDGE_V + STAND_GAP
  let lo = 0
  let hi = 12
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (globeEdgesAt(ZOOM_FACTOR, mid).bot < want) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
})()

/**
 * The pull-back is GEOMETRIC in distance, not linear: apparent size goes as 1/D,
 * so a linear ramp shrinks the world fast and then crawls. Interpolating the
 * LOGARITHM makes the rate of apparent shrink constant, which is what a pull-back
 * is supposed to feel like. exp(0) = 1 exactly, so the identity above survives it.
 */
const LOG_ZOOM = Math.log(ZOOM_FACTOR)

const smoothstep = (t: number): number => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

/**
 * The camera's distance from the planet's centre. Exactly CAMERA_DISTANCE for the
 * whole journey and the whole still beat; geometric from there to
 * CAMERA_DISTANCE · ZOOM_FACTOR at the bottom of the track.
 */
export function endingCameraDistance(ending: EndingState): number {
  return CAMERA_DISTANCE * Math.exp(LOG_ZOOM * smoothstep(ending.zoom))
}

/**
 * How far below the origin the camera is aiming — 0 for the whole journey and the
 * whole still beat, then eased to ENDING_AIM_DROP on the SAME curve the distance
 * uses, so the pull-back and the re-aim are one gesture rather than two.
 *
 * The invariant survives it for the same reason the distance does: `smoothstep(0)`
 * is exactly 0, and `x · 0` is exactly +0, so the aim is bit-identically
 * CAMERA_TARGET everywhere the camera is required not to have moved.
 */
export function endingAimDrop(ending: EndingState): number {
  return ENDING_AIM_DROP * smoothstep(ending.zoom)
}

/**
 * How far the world has receded, as a plain multiplier on the rest distance
 * (1 → ZOOM_FACTOR). The sky uses it to scale itself about the origin, which
 * keeps its projection EXACTLY invariant while everything else shrinks — see
 * sky.tsx.
 */
export function cameraZoomScale(ending: EndingState): number {
  return Math.exp(LOG_ZOOM * smoothstep(ending.zoom))
}

/**
 * The camera's position at an ending state, written into `out` — the rig owns one
 * scratch tuple, so the per-frame path allocates nothing. Returns `out` so tests
 * can pass a fresh tuple and read it back.
 */
export function cameraPositionInto(
  ending: EndingState,
  out: [number, number, number]
): [number, number, number] {
  const d = endingCameraDistance(ending)
  out[0] = CAMERA_RAY[0] * d
  out[1] = CAMERA_RAY[1] * d
  out[2] = CAMERA_RAY[2] * d
  return out
}

/** ...and what it aims at, written into `out` on the same allocation-free terms. */
export function cameraTargetInto(
  ending: EndingState,
  out: [number, number, number]
): [number, number, number] {
  out[0] = CAMERA_TARGET[0]
  out[1] = CAMERA_TARGET[1] - endingAimDrop(ending)
  out[2] = CAMERA_TARGET[2]
  return out
}

/** The camera's position at a scroll position. Allocates — for tests and benches, not the frame loop. */
export function cameraPositionAt(progress: number): [number, number, number] {
  return cameraPositionInto(endingStateAt(progress), [0, 0, 0])
}

/** ...and its aim. Same terms. */
export function cameraTargetAt(progress: number): [number, number, number] {
  return cameraTargetInto(endingStateAt(progress), [0, 0, 0])
}

/**
 * Frame-loop ordering. r3f sorts `useFrame` subscribers ascending by priority and
 * only hands rendering to a subscriber whose priority is > 0, so a negative
 * priority is purely an ordering key. The camera rig must run AFTER
 * `useDampedJourney` (−1) writes the frame's JourneyState, and BEFORE every
 * camera-FOLLOWING consumer — the peeker rig copies the camera's transform every
 * frame (peekers.tsx), and would trail the pull-back by one frame if it read a
 * stale pose.
 *
 * −0.75 rather than −0.5, and the difference is the whole point: the peeker rig
 * ALREADY subscribes at −0.5, and r3f's sort is stable, so a tie would resolve by
 * subscription order — i.e. by which component happens to mount first. That is not
 * a rule anyone can build against. Strictly below every follower makes it one.
 */
export const CAMERA_RIG_PRIORITY = -0.75

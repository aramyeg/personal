import { endingStateAt, type EndingState } from '../ending-timeline'

/**
 * THE CAMERA — its one static pose, and the ending's pull-back path.
 *
 * Pure scalar math, no three.js import, so the invariant below can be pinned in a
 * plain unit test without a canvas. scene.tsx mounts the Canvas with
 * `CAMERA_POSITION` and drives it per frame through `cameraPositionAt`.
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

/** What the camera aims at. A named constant so T65 can re-aim the ending toward a desk
 *  composition by changing this path's target, without touching the rig that applies it. */
export const CAMERA_TARGET: readonly [number, number, number] = [0, 0, 0]

/** The one static pose: what the Canvas mounts with, and what the rig must reproduce exactly. */
export const CAMERA_POSITION: [number, number, number] = [
  0,
  CAMERA_DISTANCE * Math.sin(PITCH),
  CAMERA_DISTANCE * Math.cos(PITCH),
]

/**
 * How much further away the camera ends up at full pull-back.
 *
 * 3× puts the planet at 17.6% of the viewport's height (it is 52.8% at rest —
 * apparent diameter is 2R/(D·tan(fov/2)) of the half-height), which is a clay
 * object on a desk rather than a world. It also barely widens the visible cap of
 * the planet: acos(R/D) goes from 79.5° to 86.5°, so the pull-back reveals 7° of
 * new surface — all of it in its final renewal state, since every gate is
 * saturated at ROTATION_TOTAL. T65 can raise this for its composition; the sky
 * follows it for free (see `cameraZoomScale`) and nothing else in the scene cares.
 */
export const ZOOM_FACTOR = 3

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
 * whole journey and the whole curtain call; geometric from there to
 * CAMERA_DISTANCE · ZOOM_FACTOR at the bottom of the track.
 */
export function endingCameraDistance(ending: EndingState): number {
  return CAMERA_DISTANCE * Math.exp(LOG_ZOOM * smoothstep(ending.zoom))
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

/** The camera's position at a scroll position. Allocates — for tests and benches, not the frame loop. */
export function cameraPositionAt(progress: number): [number, number, number] {
  return cameraPositionInto(endingStateAt(progress), [0, 0, 0])
}

/**
 * Frame-loop ordering. r3f sorts `useFrame` subscribers ascending by priority and
 * only hands rendering to a subscriber whose priority is > 0, so a negative
 * priority is purely an ordering key. The camera rig must run AFTER
 * `useDampedJourney` (−1) writes the frame's JourneyState, and BEFORE every
 * camera-FOLLOWING consumer — the peeker rig copies the camera's transform every
 * frame (peekers.tsx), and would trail the pull-back by one frame if it read a
 * stale pose. T64's curtain-call rig inherits that requirement.
 *
 * −0.75 rather than −0.5, and the difference is the whole point: the peeker rig
 * ALREADY subscribes at −0.5, and r3f's sort is stable, so a tie would resolve by
 * subscription order — i.e. by which component happens to mount first. That is not
 * a rule anyone can build against. Strictly below every follower makes it one.
 */
export const CAMERA_RIG_PRIORITY = -0.75

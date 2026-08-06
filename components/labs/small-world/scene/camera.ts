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
 *
 * TASK 76 WIDENS IT RATHER THAN WEAKENING IT. The ending's pose now forks by ASPECT
 * (see THE PHONE'S FRAME, below), so "the camera is static" has to hold at every
 * aspect, not just at the one the sweep used to run at. It does, and by the same
 * arithmetic: both zoom targets are positive and both aim targets are positive, so
 * `Math.exp(x·0)` is 1 and `y·0` is +0 whatever the viewport. The sweep now walks
 * the journey domain crossed with a set of aspects from 0.30 to 4.
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
const zoomForGlobeFrame = (globeFrame: number): number => {
  const u = globeFrame * TAN_HALF_FOV
  return WORLD_RADIUS * Math.sqrt(1 + u * u) / (CAMERA_DISTANCE * u)
}

export const ZOOM_FACTOR = zoomForGlobeFrame(GLOBE_FRAME)

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

const smoothstep = (t: number): number => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

/**
 * Interpolate so BOTH ends are EXACT, which `a + (b − a)·s` is not — the same form
 * `girl-exit.ts` adopted, and for a sharper reason here. At s = 0 this is
 * `1·a + 0·b`: `1·a` is bit-identically a (IEEE-754), `0·b` is +0 for every positive
 * b, and `a + (+0)` is bit-identically a. That single line is what makes the whole
 * portrait fork below invisible to a landscape viewport — not a branch that happens
 * to agree, but arithmetic that cannot disagree.
 */
const mix = (a: number, b: number, s: number): number => (1 - s) * a + s * b

/**
 * ============================================================================
 * THE PHONE'S FRAME (Task 76) — the one fork this ending is allowed
 * ============================================================================
 * At 390×844 the money shot crops the entire desk payoff. That is not a tuning
 * miss, it is the aperture argument's other half. three.js holds the VERTICAL fov
 * fixed and widens the horizontal one, so ndc Y is aspect-free — every composition
 * claim above holds on a phone — but the WORLD WIDTH the frame covers is not. At
 * the figurine row the frame spans ±4.92 world units on 1440×900 and ±1.42 on
 * 390×844. Measured off the shipped `desk.glb` by connected components, the mug
 * stands at x ∈ [−3.16, −2.25] and the donut at [−2.18, −1.38]. Neither can be in a
 * portrait frame at this pull-back, at any aim, ever.
 *
 * ============================================================================
 * WHAT MAY MOVE, AND WHAT MAY NOT
 * ============================================================================
 * `DESK_TOP_Y` CANNOT FORK. The desk is one static mesh baked in Blender; its height
 * is a property of the asset, not of the viewport. Only the CAMERA may fork.
 *
 * That single fact collapses the design. On landscape three targets are authored and
 * everything else is solved (see THE MONEY SHOT, ABOVE). On portrait the desk plane
 * is ALREADY SPENT, so:
 *
 *   GLOBE_FRAME_PORTRAIT  is authored. It solves ZOOM_FACTOR_PORTRAIT in the same
 *                         closed form, because that solve never mentioned the desk.
 *   DESK_FRAME            is REUSED, not re-authored. The desk owns the same 40% of
 *                         a phone's frame that it owns of a laptop's, and the aim
 *                         that puts it there is solved against the desk's real back
 *                         edge rather than against the globe.
 *   STAND_GAP             is no longer authorable at all. With the desk plane fixed,
 *                         the gap between the world's bottom and the desk's edge is
 *                         a function of the ZOOM alone — it moves by 0.0002 across
 *                         the whole usable aim range — so a bisection on it would be
 *                         solving a singular equation. It becomes a CONSEQUENCE,
 *                         `STAND_GAP_PORTRAIT`, reported and gated rather than set.
 *
 * So the phone's composition is ONE authored number. What it buys, at 390×844: the
 * frame at the figurine row goes ±1.42 → ±1.93, Aram's note stops being cropped
 * (95% of it was in frame; 100% is now), and the trinket dish, the donut, the
 * sculpting tool and the plasticine box's near corner come into the picture.
 *
 * ============================================================================
 * THE WALL, STATED RATHER THAN WORKED AROUND
 * ============================================================================
 * 0.30 is not where the picture stops improving; it is where the DESK RUNS OUT.
 * `camera-parallax.test.ts` gates that no bottom corner ray reaches the desk plane
 * beyond `DESK_NEAR_Z` — the slab's own baked end at z = 14.198 — because past it
 * the frame shows a void under the table. Pulling back moves that crossing out fast:
 * at GLOBE_FRAME_PORTRAIT 0.30 the worst corner lands at 13.81 (0.39 of headroom),
 * at 0.29 it lands at 14.195 (0.003), and at 0.28 it is 0.36 units PAST the slab.
 * Reaching the mug needs 0.185, which lands 5.8 units past it.
 *
 * The remedy is therefore not in this file: either the slab is re-baked longer, or
 * the T69 prop set is re-laid-out so the payoff is not spread to |x| = 4.4. Both are
 * Blender work. This module goes exactly as far as the shipped asset allows and no
 * further, and the test named below is what stops a later edit from going past it
 * without noticing.
 */

/** The aspect at and above which the ending's pose is EXACTLY the approved landscape one. */
export const LANDSCAPE_ASPECT = 1

/**
 * ...and at and below which the portrait composition is in force in full.
 *
 * Every phone the lab is captured at sits under it (360×800 = 0.450, 390×844 = 0.462,
 * 430×932 = 0.461, 375×667 = 0.562 is the one close call and still lands at 96% of
 * the fork). A portrait tablet at 0.75 takes half of it, which is right: its frame is
 * 47% of a laptop's width and it has half the problem.
 */
export const PORTRAIT_ASPECT = 0.5

/**
 * How much of the portrait composition is in force at an aspect — the ONE quantity
 * the fork is expressed through.
 *
 * Smoothstepped rather than switched, so rotating a device walks the pose instead of
 * snapping it, and so the derivative is zero at both ends. Exactly 0 at and above
 * `LANDSCAPE_ASPECT` (`smoothstep` clamps, and `0·0·(3−0)` is exactly 0) and exactly
 * 1 at and below `PORTRAIT_ASPECT`. The guard is `yawMaxFor`'s: a viewport that has
 * not measured itself yet reports 0 or NaN, and the landscape pose is the safe
 * answer for both.
 */
export function portraitWeight(aspect: number): number {
  if (!(aspect > 0)) return 0
  return smoothstep((LANDSCAPE_ASPECT - aspect) / (LANDSCAPE_ASPECT - PORTRAIT_ASPECT))
}

/** The world's silhouette as a fraction of the viewport HEIGHT at full pull-back, ON A PHONE. */
export const GLOBE_FRAME_PORTRAIT = 0.3

/** ...which solves the portrait pull-back in the same closed form GLOBE_FRAME does. */
export const ZOOM_FACTOR_PORTRAIT = zoomForGlobeFrame(GLOBE_FRAME_PORTRAIT)

/**
 * THE DESK'S BACK EDGE, RESTATED — the one point the portrait aim solve needs and the
 * one point this module is not allowed to import.
 *
 * `desk-stage.ts` solves `DESK_TOP_Y` and `DESK_BACK_Z` from `DESK_EDGE_V` at the
 * landscape pose, and it imports THIS module to do it; importing it back would be a
 * cycle whose module-evaluation order decides whether a const is in its temporal dead
 * zone. So the solve is restated — the same bisection, on the same predicate, over the
 * same bracket, which makes it bit-identical rather than merely close — and
 * `ending-camera.test.ts` pins `DESK_EDGE_POINT` against desk-stage's own pair with
 * `Object.is`. That is the WORLD_RADIUS treatment, for the same reason and with the
 * same relation pin: a copy that cannot drift because a test compares it, not because
 * a comment asks it not to.
 *
 * `DESK_CLEARANCE` comes with it. It is the only desk number this file has to know.
 */
const DESK_CLEARANCE = 0.35
const HALF_FOV = (CAMERA_FOV * Math.PI) / 360
const FLOOR_SLOPE = Math.tan(PITCH + HALF_FOV)
/** The first z at which a surface at `topY` is still DESK_CLEARANCE below the journey's bottom edge. */
const backZFor = (topY: number): number =>
  CAMERA_POSITION[2] - (CAMERA_POSITION[1] - topY - DESK_CLEARANCE) / FLOOR_SLOPE

export const DESK_EDGE_POINT: readonly [number, number, number] = (() => {
  let lo = -6
  let hi = 6
  for (let i = 0; i < 90; i++) {
    const mid = (lo + hi) / 2
    if (ndcYAt([0, mid, backZFor(mid)], ZOOM_FACTOR, ENDING_AIM_DROP) < DESK_EDGE_V) lo = mid
    else hi = mid
  }
  const topY = (lo + hi) / 2
  return [0, topY, backZFor(topY)]
})()

/**
 * How far below the origin the PORTRAIT ending aims — solved, like its landscape
 * sibling, but against the other end of the same relation.
 *
 * Landscape solves the aim from the GLOBE (put the world's bottom `STAND_GAP` above
 * `DESK_EDGE_V`) and then lets `DESK_TOP_Y` place the desk to match. Portrait cannot:
 * the desk is already placed. So it solves the aim from the DESK (put the real back
 * edge back on `DESK_EDGE_V`) and lets the gap fall where the zoom leaves it. Same
 * composition, read from the end that is still free.
 *
 * Monotone over the bracket — aiming lower carries every point in front of the camera
 * UP the frame, with no turning point anywhere in [0, 12] at any zoom the blend can
 * produce — so the bisection is honest. It runs once, at module load.
 */
export const ENDING_AIM_DROP_PORTRAIT = (() => {
  let lo = 0
  let hi = 12
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (ndcYAt(DESK_EDGE_POINT, ZOOM_FACTOR_PORTRAIT, mid) < DESK_EDGE_V) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
})()

/**
 * The band the stand stands in ON A PHONE — a CONSEQUENCE, not a target (see the
 * header). It comes out at 0.058 against the laptop's authored 0.120: the phone's
 * world sits nearer its desk because it is further away, which is the price the one
 * authored number pays. Positive is the claim that matters, and it is gated.
 */
export const STAND_GAP_PORTRAIT =
  globeEdgesAt(ZOOM_FACTOR_PORTRAIT, ENDING_AIM_DROP_PORTRAIT).bot - DESK_EDGE_V

/**
 * The pull-back's two targets at an aspect. Everything below is a pure function of
 * these plus `ending.zoom`, which is what keeps the fork a change of INPUT rather
 * than a second code path: at any landscape aspect `zoomFactorFor` returns
 * `ZOOM_FACTOR` and `endingAimTargetFor` returns `ENDING_AIM_DROP`, bit for bit, so
 * every expression below reduces to the one Task 66 shipped.
 */
export function zoomFactorFor(aspect: number): number {
  return mix(ZOOM_FACTOR, ZOOM_FACTOR_PORTRAIT, portraitWeight(aspect))
}

/** ...and how far below the origin that aspect's ending ends up aiming. */
export function endingAimTargetFor(aspect: number): number {
  return mix(ENDING_AIM_DROP, ENDING_AIM_DROP_PORTRAIT, portraitWeight(aspect))
}

/**
 * How far the world has receded, as a plain multiplier on the rest distance
 * (1 → the aspect's own zoom factor). The sky uses it to scale itself about the
 * origin, which keeps its projection EXACTLY invariant while everything else
 * shrinks — see sky.tsx, which now reads the ASPECT'S factor, because a sky scaled
 * by the laptop's factor under a phone's pull-back would stop being invariant and
 * could show its edge.
 *
 * The pull-back is GEOMETRIC in distance, not linear: apparent size goes as 1/D, so
 * a linear ramp shrinks the world fast and then crawls. Interpolating the LOGARITHM
 * makes the rate of apparent shrink constant, which is what a pull-back is supposed
 * to feel like. `exp(x·0)` is exactly 1 (ECMAScript: exp(+0) → 1), so the identity
 * at the top of this file survives it — AT EVERY ASPECT, which is stronger than what
 * Task 63 needed and is exactly what a forkable pose has to promise.
 */
export function cameraZoomScaleFor(ending: EndingState, aspect: number): number {
  return Math.exp(Math.log(zoomFactorFor(aspect)) * smoothstep(ending.zoom))
}

/**
 * The camera's distance from the planet's centre. Exactly CAMERA_DISTANCE for the
 * whole journey and the whole still beat AT EVERY ASPECT; geometric from there to
 * CAMERA_DISTANCE · `zoomFactorFor(aspect)` at the bottom of the track.
 */
export function endingCameraDistanceFor(ending: EndingState, aspect: number): number {
  return CAMERA_DISTANCE * cameraZoomScaleFor(ending, aspect)
}

/**
 * How far below the origin the camera is aiming — 0 for the whole journey and the
 * whole still beat, then eased to the aspect's target on the SAME curve the distance
 * uses, so the pull-back and the re-aim are one gesture rather than two.
 *
 * The invariant survives it for the same reason the distance does: `smoothstep(0)`
 * is exactly 0, and `x · 0` is exactly +0, so the aim is bit-identically
 * CAMERA_TARGET everywhere the camera is required not to have moved — on a phone as
 * much as on a laptop, since both targets are positive and both are multiplied by
 * the same exact zero.
 */
export function endingAimDropFor(ending: EndingState, aspect: number): number {
  return endingAimTargetFor(aspect) * smoothstep(ending.zoom)
}

/**
 * The camera's position at an ending state and an aspect, written into `out` — the
 * rig owns one scratch tuple, so the per-frame path allocates nothing. Returns `out`
 * so tests can pass a fresh tuple and read it back.
 */
export function cameraPositionIntoFor(
  ending: EndingState,
  aspect: number,
  out: [number, number, number]
): [number, number, number] {
  const d = endingCameraDistanceFor(ending, aspect)
  out[0] = CAMERA_RAY[0] * d
  out[1] = CAMERA_RAY[1] * d
  out[2] = CAMERA_RAY[2] * d
  return out
}

/** ...and what it aims at, written into `out` on the same allocation-free terms. */
export function cameraTargetIntoFor(
  ending: EndingState,
  aspect: number,
  out: [number, number, number]
): [number, number, number] {
  out[0] = CAMERA_TARGET[0]
  out[1] = CAMERA_TARGET[1] - endingAimDropFor(ending, aspect)
  out[2] = CAMERA_TARGET[2]
  return out
}

/**
 * THE LANDSCAPE PATH, which is the aspect-free special case rather than a copy.
 *
 * `girl-exit.ts`, `sky.tsx` and the overlay's two clearance modules were all written
 * against these signatures and against a pose that had no aspect in it. They keep
 * both. Each is the aspect-taking function evaluated at `LANDSCAPE_ASPECT`, where
 * `portraitWeight` is exactly 0 and `mix` is exactly the identity — so there is no
 * second implementation that could drift, and `ending-camera.test.ts` sweeps the
 * pair with `Object.is` at every landscape aspect it can name.
 */
export function endingCameraDistance(ending: EndingState): number {
  return endingCameraDistanceFor(ending, LANDSCAPE_ASPECT)
}

/** @see endingCameraDistance for why this is not a second implementation. */
export function endingAimDrop(ending: EndingState): number {
  return endingAimDropFor(ending, LANDSCAPE_ASPECT)
}

/** @see endingCameraDistance for why this is not a second implementation. */
export function cameraZoomScale(ending: EndingState): number {
  return cameraZoomScaleFor(ending, LANDSCAPE_ASPECT)
}

/** @see endingCameraDistance for why this is not a second implementation. */
export function cameraPositionInto(
  ending: EndingState,
  out: [number, number, number]
): [number, number, number] {
  return cameraPositionIntoFor(ending, LANDSCAPE_ASPECT, out)
}

/** @see endingCameraDistance for why this is not a second implementation. */
export function cameraTargetInto(
  ending: EndingState,
  out: [number, number, number]
): [number, number, number] {
  return cameraTargetIntoFor(ending, LANDSCAPE_ASPECT, out)
}

/** The camera's position at a scroll position. Allocates — for tests and benches, not the frame loop. */
export function cameraPositionAt(progress: number): [number, number, number] {
  return cameraPositionInto(endingStateAt(progress), [0, 0, 0])
}

/** ...and its aim. Same terms. */
export function cameraTargetAt(progress: number): [number, number, number] {
  return cameraTargetInto(endingStateAt(progress), [0, 0, 0])
}

/** The same pair at an aspect, for the sweeps and the benches. */
export function cameraPositionAtFor(progress: number, aspect: number): [number, number, number] {
  return cameraPositionIntoFor(endingStateAt(progress), aspect, [0, 0, 0])
}

/** ...and its aim. Same terms. */
export function cameraTargetAtFor(progress: number, aspect: number): [number, number, number] {
  return cameraTargetIntoFor(endingStateAt(progress), aspect, [0, 0, 0])
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

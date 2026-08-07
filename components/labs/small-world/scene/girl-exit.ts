import {
  CAMERA_DISTANCE,
  CAMERA_PITCH_DEG,
  ZOOM_FACTOR,
  cameraZoomScale,
  endingAimDrop,
  ndcYAt,
} from './camera'
import { DESK_BACK_Z, DESK_TOP_Y } from './desk-stage'
import { PLANET_RADIUS } from './land-bake'
import { DESK_PAD } from './props/desk-glb-contract'
import { STANCE_ALPHA } from './renewal'
import { ENDING_SPAN, endingStateAt, type EndingState } from '../ending-timeline'

/**
 * ALWINA LEAVES THE WORLD (Task 76, restaged in Task 87) — the girl walks to the
 * world's far crest, turns back for a goodbye, and JUMPS off the planet.
 *
 * WHAT THIS MODULE SHIPS, AND WHAT IT STILL CONTAINS. The exit is live and gated.
 * The ARRIVAL is not: `GIRL_DESK_MOUNTED` is false, because Aram's ruling is that
 * she belongs BEHIND the desk at human scale rather than on it at figurine scale,
 * and two measurements say the GLB cannot yet be that person. The ink epilogue
 * that briefly carried her return was itself killed in the T82 rework (Aram: it
 * didn't fit), so for now she leaves and does not come back. Everything the desk
 * arrival needed is kept, gated and re-enabled by one flag — see
 * `GIRL_DESK_MOUNTED`.
 *
 * ============================================================================
 * WHY SHE CANNOT SIMPLY BE MOVED
 * ============================================================================
 * Aram's note: "I don't like that Alwi is also staying on the globe, she should
 * probably come out of the clay world during the final scene... if we can make so
 * Alwi walks to the desk that would be perfect."
 *
 * The two places she has to be are eleven world units and a factor of 1.4 in
 * apparent size apart, and there is no path between them that is both physical and
 * watchable — a girl climbing down a globe stand is a stunt, and a girl who grows
 * on screen is a bug. What IS available is the oldest cut in the book: she leaves
 * frame behind something, and the next time you see her she is somewhere else. The
 * planet is a sphere with a horizon, so it supplies the occluder for free.
 *
 * ============================================================================
 * THE EXIT IS OVER THE FAR CREST, AND THAT IS FORCED (Task 76's derivation)
 * ============================================================================
 * She stands at `STANCE_ALPHA` (19.93° from the pole, measured the way
 * `anchorTransform` measures it: dir = (0, cos θ, sin θ)). The journey camera sits
 * at θ = 90° − pitch = 70°, so the surface is visible over θ ∈ [−9.52°, 149.52°]
 * and she has two ways out.
 *
 *   TOWARD THE VIEWER (+θ, which is the way she already faces) she would have to
 *   reach θ = 149.52° to lose the surface — 130° of travel, on which she rotates
 *   with the surface normal until she is lying on her back pointing at the camera.
 *   Not a walk; a somersault. And there is nothing on that side to hide her: an
 *   exit toward the lens has no occluder at all.
 *
 *   AWAY OVER THE POLE (−θ) the surface's own crest is 29.5° away, and everything
 *   past it is hidden ground. The far side is the only place in the frame that
 *   something can disappear behind.
 *
 * ============================================================================
 * THE RESTAGING (Task 87) — she does not run off; she jumps
 * ============================================================================
 * Aram: "when the story is finished maybe it makes more sense that Alwi turns
 * back and jumps off the planet, not runs off of it."
 *
 * Task 76 walked her from her stance to −65.43° — far past the crest, because a
 * WALKING girl keeps her head 1.19 units above the surface and the angle that
 * hides a raised point is the sum of two horizon half-angles, 132.6° from the
 * camera. The new staging replaces most of that walk with a beat, and the beat
 * with a fall:
 *
 *   1. she turns her back on the world and walks — but only to `GIRL_STOP_THETA`,
 *      a step short of the crest, where she is still whole in the frame;
 *   2. she TURNS BACK toward the reader — the goodbye. The camera cannot move to
 *      meet her (the frozen-camera invariant owns every t below ZOOM_START), so
 *      the beat is staged to read at the shipped distance: she stands on the
 *      world's upper silhouette, the idle sway breathing under her;
 *   3. she JUMPS: a ballistic arc — up `GIRL_JUMP_RISE`, over the crest, and then
 *      DOWN `GIRL_JUMP_FALL` — off the edge of the world, facing the reader as
 *      she goes.
 *
 * THE FALL IS WHAT HIDES HER, and it is a strictly stronger hiding than Task
 * 76's. The walk needed the two-horizon solve because her head stayed raised; the
 * jump ends with her head at radius `PLANET_RADIUS + jumpLiftAt(1) +
 * GIRL_GLOBE_HEIGHT` — INSIDE the planet's own ball. A camera outside a convex
 * body cannot see a point inside it from ANY distance (every sightline to it
 * crosses the surface), so the parked end state needs no margin arithmetic
 * against the pull-back at all. `girl-exit.test.ts` gates the radius with real
 * slack and ALSO keeps the two-horizon predicate for the beats on the way down.
 *
 * The gate family is re-derived, not weakened: she is on the planet and drawn
 * for the whole performance; at the goodbye she is WHOLE (feet visible — the
 * beat cannot be delivered by a half-sunk figure); at the apex of the jump she
 * is still whole (the leap must read before the fall takes her); her feet drop
 * behind the crest BEFORE her head (the sinking that made the walk work is now
 * the plunge); that sinking is a real share of the flight; and she is hidden at
 * every camera stop from the end of the flight through the bottom of the track.
 *
 * ============================================================================
 * SCROLL PURITY — AND THE JUMP CLIP ON THE SAME TERMS
 * ============================================================================
 * Every number here is a pure function of `EndingState.t`. That includes the
 * jump: `GirlPose.jump` is the flight's own 0→1, `jumpLiftAt` is its authored
 * ballistics, and `jumpClipFracAt` maps it onto the Jump_B clip so `girl.tsx`
 * can write the action's TIME from scroll exactly as it writes the skip's from
 * `walked`. Scrubbing backwards un-jumps her, frame for frame. The
 * AnimationMixer stays off the frame delta for the whole ending (the Task 76
 * removal); the coffee steam stays the ending's one wall-clock exception.
 *
 * ============================================================================
 * THE TRANSFER, AND WHY NOTHING POPS
 * ============================================================================
 * Two occluders hand her over, and there is a window where BOTH hold:
 *   - from `GIRL_JUMP_END` she is inside the planet's occlusion ball (the solve
 *     above);
 *   - from `GIRL_DESK_REVEAL` backwards she is below the frame's bottom edge,
 *     because the desk is revealed BACK-TO-FRONT by the pull-back and her whole
 *     silhouette is under the bottom edge until then.
 * She is not drawn at all in between, which is free — there is nothing to draw
 * her over. `girl-exit.test.ts` gates the overlap rather than trusting this
 * paragraph: the instant she is put on the desk is inside the interval where she
 * is hidden on the globe, and the instant she is drawn again is at or after it.
 */

const PITCH = (CAMERA_PITCH_DEG * Math.PI) / 180

/** The camera's own bearing in the θ the exit is measured in. */
export const CAMERA_THETA = Math.PI / 2 - PITCH

/** The GLB's authored standing height (`canonicalize-girl.mjs` gates it at ~1.7u). */
export const GIRL_MESH_HEIGHT = 1.7

/**
 * Her scale ON THE PLANET. Moved here from `girl.tsx` because there are now two of
 * them and the second one is only meaningful next to the first.
 */
export const GIRL_GLOBE_SCALE = 0.7

/** ...and how tall that makes her, which is what the hiding solves need. */
export const GIRL_GLOBE_HEIGHT = GIRL_MESH_HEIGHT * GIRL_GLOBE_SCALE

/**
 * How tall she stands ON THE DESK — the one number in this module that is a look
 * decision, and it is authored against the two things the eye compares it with.
 *
 * At the money shot a 1.00-unit upright at the figurine row measures 124.1 px on a
 * 1440×900 frame, so the figurines (0.72) stand 89 px and she, on the planet,
 * measures 93 px. 0.85 lands her at 105 px: within 13% of the size she just left,
 * so the cut reads as a cut and not as a resize, and 18% over the souvenirs she is
 * standing among, so she reads as the person who made them rather than a third
 * one. `girl-exit.test.ts` pins both ratios.
 */
export const GIRL_DESK_HEIGHT = 0.85

export const GIRL_DESK_SCALE = GIRL_DESK_HEIGHT / GIRL_MESH_HEIGHT

/** Surface distance one skip cycle covers at planet scale (`girl.tsx`'s CLIP_STRIDE). */
export const CLIP_STRIDE = 1.0

/** ...and at any other scale. A smaller girl takes proportionally smaller steps. */
export const strideAt = (scale: number): number => (CLIP_STRIDE * scale) / GIRL_GLOBE_SCALE

/**
 * The surface's own crest as seen from the REST camera — the tangent bearing,
 * which is the line the whole performance is staged against. The camera cannot
 * leave its rest pose before ZOOM_START (0.38), and the flight is over by
 * GIRL_JUMP_END (0.35), so every airborne frame renders through this horizon
 * and no other.
 */
export const CREST_THETA = CAMERA_THETA - Math.acos(PLANET_RADIUS / CAMERA_DISTANCE)

/**
 * How far short of the crest she stops for the goodbye, in radians of surface.
 *
 * Far enough that her FEET are safely inside the visible cap (a goodbye delivered
 * by a half-sunk figure is not a goodbye — the test gates feet visible at the
 * stop), close enough that she reads as standing on the edge of the world, which
 * is the picture the jump needs to launch from.
 */
export const GIRL_STOP_MARGIN = 0.06

/** Where she stands for the goodbye: a step before the crest, whole in the frame. */
export const GIRL_STOP_THETA = CREST_THETA + GIRL_STOP_MARGIN

/** How far she walks on the planet, along the surface, in world units. */
export const GIRL_WALK_ARC = (STANCE_ALPHA - GIRL_STOP_THETA) * PLANET_RADIUS

// ---------------------------------------------------------------------------
// THE JUMP — authored as two look numbers, everything else solved
// ---------------------------------------------------------------------------

/** How high the leap carries her above the surface at its apex, in world units.
 *  About half her own height: a toy-world bound, not a launch. */
export const GIRL_JUMP_RISE = 0.35

/**
 * ...and how far BELOW the surface line the flight ends. This is the hiding
 * solve: her head rides `GIRL_GLOBE_HEIGHT` above her feet, so a fall of 1.8
 * parks her head at radius 2.2 − 1.8 + 1.19 = 1.59 — 0.61 units INSIDE the
 * planet's ball, from which no camera outside a convex body can retrieve her.
 * The test holds the slack at ≥ 0.4 so a retune cannot walk her back out.
 */
export const GIRL_JUMP_FALL = 1.8

/**
 * How far round the sphere the leap carries her, in radians. Enough that the
 * plunge happens BEHIND the crest (the fall crosses the silhouette going down,
 * which is the beat), small enough that the arc reads as a jump rather than a
 * flight — 0.14 rad is 0.31 u of surface, about a body-length-and-a-half.
 */
export const GIRL_JUMP_SWEEP = 0.14

/** Where the flight ends, in θ. Past the rest crest, behind the silhouette. */
export const GIRL_JUMP_END_THETA = GIRL_STOP_THETA - GIRL_JUMP_SWEEP

/**
 * When in the flight she crests — SOLVED from the two authored numbers by the
 * ballistics themselves. A parabola through lift(0) = 0 with apex `RISE` and
 * lift(1) = −FALL has its apex at the root of (FALL/RISE)·A² + 2A − 1 = 0:
 * gravity is constant, so the rise is short and the fall is long, exactly the
 * shape a jump off an edge has. 0.35/1.8 lands it at 0.288.
 */
export const GIRL_JUMP_APEX = (() => {
  const r = GIRL_JUMP_FALL / GIRL_JUMP_RISE
  return (Math.sqrt(1 + r) - 1) / r
})()

/** The parabola's gravity, in lift units per unit flight² — from apex height. */
const JUMP_G = (2 * GIRL_JUMP_RISE) / (GIRL_JUMP_APEX * GIRL_JUMP_APEX)

/**
 * Her radial offset from the surface at flight phase `p` — the authored
 * ballistics. Exactly +0 at p = 0 (`G·(A·0 − 0)`), so the takeoff frame is
 * bit-identical to the standing one, which is what lets the flight join the
 * goodbye without a seam a scrub could catch.
 */
export function jumpLiftAt(p: number): number {
  const x = clamp01(p)
  return JUMP_G * (GIRL_JUMP_APEX * x - (x * x) / 2)
}

/**
 * Where in the Jump_B CLIP a flight phase lands — the map `girl.tsx` writes the
 * action's time through.
 *
 * The clip is a full jump that lands and recovers; she never lands. So the map
 * uses only the clip's airborne stretch, measured from the GLB itself (t87 clip
 * inventory, hips channel): the clip's own apex sits at 0.243 of its length and
 * its landing absorb begins at ~0.36. The rise plays the clip up to its apex in
 * step with the arc's rise; the fall stretches the clip's airborne descent
 * [0.243, JUMP_CLIP_HOLD] over the rest of the flight, so she is still slowly
 * extending into the drop as the crest takes her, and the clip never reaches the
 * frames where it lands on ground she no longer has.
 */
export const JUMP_CLIP_APEX = 0.243
export const JUMP_CLIP_HOLD = 0.3

export function jumpClipFracAt(p: number): number {
  const x = clamp01(p)
  if (x <= GIRL_JUMP_APEX) return (x / GIRL_JUMP_APEX) * JUMP_CLIP_APEX
  return (
    JUMP_CLIP_APEX +
    ((x - GIRL_JUMP_APEX) / (1 - GIRL_JUMP_APEX)) * (JUMP_CLIP_HOLD - JUMP_CLIP_APEX)
  )
}

/**
 * The jump action's mixer weight at a flight phase — a short scroll-pure ramp
 * out of the idle sway, because Jump_B's first frames are near the rest pose but
 * the sway's are not (its hips wander 0.24 u laterally), and a snap between the
 * two is a visible pop on the takeoff frame. Exactly 0 at p ≤ 0 and exactly 1
 * from `JUMP_BLEND_IN` on, so the flight's body language is wholly the clip's
 * for everything past its first instants.
 */
export const JUMP_BLEND_IN = 0.12

export function jumpBlendAt(p: number): number {
  if (p <= 0) return 0
  return smootherstep(Math.min(1, p / JUMP_BLEND_IN))
}

/**
 * Is a point at bearing `theta` and radius `radius` hidden behind the planet,
 * from a camera at distance `cameraDistance`?
 *
 * Two regimes, one truth:
 *   - radius < PLANET_RADIUS: the point is inside the ball. The camera is
 *     outside a convex body, so EVERY sightline to the point crosses the
 *     surface first — hidden from any distance, no arithmetic.
 *   - radius ≥ PLANET_RADIUS: the Task 76 two-horizon condition — hidden when
 *     the angular separation from the camera exceeds acos(R/d) + acos(R/ρ).
 * This is the predicate the whole exit is gated through; the walk, the goodbye,
 * the apex and the plunge are all claims about it.
 */
export function pointHiddenAt(theta: number, radius: number, cameraDistance: number): boolean {
  if (radius < PLANET_RADIUS) return true
  const horizon =
    Math.acos(Math.min(1, PLANET_RADIUS / cameraDistance)) +
    Math.acos(Math.min(1, PLANET_RADIUS / radius))
  return Math.abs(theta - CAMERA_THETA) > horizon
}

/** Is the top of her head hidden, standing (or flying) at `theta` with radial offset `lift`? */
export function headHiddenAt(theta: number, lift: number, cameraDistance: number): boolean {
  return pointHiddenAt(theta, PLANET_RADIUS + lift + GIRL_GLOBE_HEIGHT, cameraDistance)
}

/** ...and her feet, which the crest takes first — the sinking that makes the beat. */
export function feetHiddenAt(theta: number, lift: number, cameraDistance: number): boolean {
  return pointHiddenAt(theta, PLANET_RADIUS + lift, cameraDistance)
}

/**
 * The fraction of the FLIGHT she spends sinking — feet behind the crest, head
 * still up. The walk's version of this beat was the whole picture of Task 76's
 * exit; the jump keeps it as the plunge: she drops behind the world going down
 * by the head, and this measures that stretch so a retune cannot collapse it.
 */
export function exitSinkShare(cameraDistance: number): number {
  const N = 2000
  let sinking = 0
  for (let i = 0; i <= N; i++) {
    const p = i / N
    const theta = mix(GIRL_STOP_THETA, GIRL_JUMP_END_THETA, p)
    const lift = jumpLiftAt(p)
    if (feetHiddenAt(theta, lift, cameraDistance) && !headHiddenAt(theta, lift, cameraDistance))
      sinking++
  }
  return sinking / (N + 1)
}

// ---------------------------------------------------------------------------
// THE BEATS, in the ending's own t
// ---------------------------------------------------------------------------

/** She turns her back on the world over this window. Starts after 0 so the first
 *  frames of the ending are bit-identically the journey's last one. */
export const GIRL_TURN_START = 0.03
export const GIRL_TURN_END = 0.1

/** ...and walks to `GIRL_STOP_THETA` by here — a short walk to the edge. */
export const GIRL_WALK_END = 0.19

/** She turns back toward the reader over this window — the goodbye. */
export const GIRL_LOOK_START = 0.21
export const GIRL_LOOK_END = 0.27

/**
 * The flight. It launches out of the goodbye's held beat and lands nowhere:
 * the window ends with her parked inside the planet's occlusion ball. It runs
 * PAST the stand's seating (STAND_END 0.3) on purpose — the still beat used to
 * hold nothing, and now it holds the one thing the whole ending is about — but
 * it ends before `GIRL_TRANSFER`, and the camera cannot move until ZOOM_START
 * (0.38), so every airborne frame renders through the rest camera.
 */
export const GIRL_JUMP_START = 0.29
export const GIRL_JUMP_END = 0.35

/**
 * When she stops being on the planet and starts being on the desk. Anywhere in
 * [GIRL_JUMP_END, GIRL_DESK_REVEAL] is equivalent — she is drawn in neither place
 * — so it sits in the still beat, where the camera has not started to move.
 */
export const GIRL_TRANSFER = 0.36

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Zero in the first and second derivative at both ends — the stand's easing, and
 *  for the same reason: a start or a stop you can catch is a start or a stop you
 *  notice. */
const smootherstep = (t: number): number => {
  const x = clamp01(t)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/** Linear ramp across a window, clamped — the raw parameter the easings take. */
const across = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a))

/**
 * Interpolate so BOTH ends are exact, which `a + (b − a) · s` is not.
 *
 * At s = 0 the usual form is exact (`x · 0` is +0, `a + 0` is a) and at s = 1 it is
 * not: `a + (b − a)` re-rounds twice and lands a few ulp off b. That is invisible in
 * a picture and very visible in a gate, and the gate is right to care — "she has
 * arrived" and "she is a hundred-millionth short of arriving" are different claims,
 * and only one of them can be asserted with `Object.is`. This form is exact at both
 * ends by construction: `1 · a + 0 · b` and `0 · a + 1 · b`.
 */
const mix = (a: number, b: number, s: number): number => (1 - s) * a + s * b

// ---------------------------------------------------------------------------
// THE DESK STAGING
// ---------------------------------------------------------------------------

export type DeskStaging = {
  readonly id: string
  /** Where her walk across the desk begins (world x, z on the desk plane). */
  readonly from: readonly [number, number]
  /** ...and where she settles. */
  readonly to: readonly [number, number]
  /** Her facing once settled, in radians about +y. 0 faces the camera (+z). */
  readonly restYaw: number
  /** false = she does not walk; she is simply standing there when the desk arrives. */
  readonly walks: boolean
}

/**
 * THE CANDIDATES (Task 76 look-dev). Three stagings of the same beat, so the
 * choice is made against captures rather than against this paragraph.
 *
 *  `approach` — she comes forward and to the right out of the desk's back left,
 *               the empty pad under the globe stand, and settles behind and
 *               between the two figurines. The most travel the stage allows: the
 *               figurine row is fenced by the trinket dish at x ≈ −2.0 and the
 *               plasticine box at x ≈ +1.7, so a LATERAL crossing has nowhere to
 *               come from — the depth axis is the only one with room.
 *  `axis`     — straight down the middle, out from under the stand's own column,
 *               settling dead centre in front of the figurine row: globe, stem,
 *               her, the note and the pills on one vertical.
 *  `present`  — no walk at all; she is standing there as the desk is revealed.
 *               The control, and the reduced-motion pose.
 */
export const DESK_STAGINGS: readonly DeskStaging[] = [
  { id: 'step', from: [0.42, 9.4], to: [-0.12, 9.4], restYaw: 0.3, walks: true },
  { id: 'graze', from: [-1.62, 9.14], to: [-0.14, 9.42], restYaw: 0.3, walks: true },
  { id: 'present', from: [-0.12, 9.42], to: [-0.12, 9.42], restYaw: 0.3, walks: false },
]

/** The staging in force. Look-dev swaps this; the shipped ending names one. */
export const GIRL_DESK_STAGING: DeskStaging = DESK_STAGINGS[0]

/**
 * WHETHER SHE IS DRAWN ON THE DESK AT ALL — false, and the reason is a ruling
 * rather than a defect.
 *
 * The desk-scale arrival below was built, captured and approved on craft, and
 * then rejected at the vision level: Aram's note is "Alwi is the one that should
 * be actually behind the desk, it is her office" — she is the HUMAN the desk
 * belongs to, not a third figurine among her own keepsakes. Two measurements then
 * showed the 3D girl cannot yet be that human (no face at the pixel density a
 * behind-desk head demands; and 0.36 m of frame headroom against the 0.90 m a
 * standing adult needs — `task-76-ending-report.md` carries both with captures).
 *
 * So phase 1 ships the half that is not in doubt: she LEAVES the world, exactly
 * as staged and gated. The ink epilogue that briefly carried her return is gone
 * too (T82 kill list) — she simply does not reappear, in any medium, until
 * phase 2.
 *
 * Everything the arrival needed is kept and still gated: the free-lane map, the
 * float solve, the scale ratios, the two candidate paths. Phase 2 re-enables this
 * with one flag when Aram's re-export lands and the reframe has been priced —
 * which is exactly why it is a flag and not a deletion.
 */
export const GIRL_DESK_MOUNTED = false

/**
 * WHERE SHE IS ALLOWED TO STAND, and why it is such a small place.
 *
 * The desk's free floor was MEASURED rather than assumed: `bench/clearance` walks
 * the desk plane at the money shot and classifies each mark by whether the pixels
 * it projects to are bare pad, using a per-SCANLINE median as the pad's model (the
 * bake carries a steep depth gradient, so one reference colour calls most of the
 * pad a prop). The answer is narrow. The figurine row is fenced by the trinket
 * dish at x ≈ −2.0 and the plasticine box at x ≈ +1.4, the note owns
 * z ∈ [9.7, 11.4] across the middle, and the two souvenirs stand at x = ±0.9. What
 * is left is one corridor: x ∈ [−0.30, +0.45] running from the desk's back edge
 * forward to z ≈ 9.65, about one of her body-lengths wide and two long.
 *
 * That corridor is also the only place a PHONE can see her — the frame is ±1.42
 * world units at the figurine row on a 390-wide screen against ±4.92 on a laptop,
 * so every staging that used the desk's roomy left flank was a staging only a
 * laptop would ever witness.
 *
 * So the walk is short by measurement, not by choice, and the three candidates
 * differ in what they spend it on rather than in how far it goes.
 */

/** She stands on the desk PAD, like the figurines — not on the slab (0.0355 lower). */
export const GIRL_DESK_SEAT_Y = DESK_PAD.top

/** She starts moving on the desk here. Before the reveal below in every staging,
 *  so her first visible frame is always a walking one. */
export const GIRL_DESK_WALK_START = 0.45

/** ...and she has arrived by here. Before STUDIO_LIGHTS_FULL (0.82 of the pull-back,
 *  i.e. t ≈ 0.89), so the frame Aram approved is one she has already landed in. */
export const GIRL_DESK_SETTLED = 0.88

/** How much of the approach she spends turning out of her direction of travel to
 *  face the reader. Long enough to read as a turn rather than a snap. */
export const GIRL_DESK_TURN = 0.12

/**
 * WHEN SHE IS FIRST DRAWN ON THE DESK — solved along her own path, and the solve is
 * the whole reason nothing pops.
 *
 * The first cut hid her until the top of her head crossed the frame's bottom edge,
 * on the reasoning that anything below the edge is cropped and therefore free. The
 * capture disagreed, and it was right: the pull-back reveals the desk BACK-TO-FRONT,
 * so at t ≈ 0.50 her head and shoulders stood above the bottom edge while the desk's
 * own back edge was still BELOW it — a girl floating in the studio's empty backdrop
 * with no desk anywhere in frame. Cropped is not the same as covered.
 *
 * The condition that actually means "she is inside the picture of the desk" is that
 * her head sits BELOW THE DESK'S BACK EDGE on screen. This is the first t at which
 * that is true of the mark she is on at that moment — which makes the reveal a
 * sliver by construction, because at the crossing the two lines coincide and
 * everything of her that is in frame at all lies between the back edge and the
 * bottom of the screen.
 *
 * It is NOT monotone — the pull-back eventually lifts her head back above the edge
 * (at the money shot her hair is silhouetted against the backdrop, which is where
 * the contrast comes from), so this is solved ONCE, at module load, and compared
 * against t. A per-frame test would hide her again at the end.
 *
 * The aspect ratio does not enter: three.js holds the VERTICAL fov fixed, so ndc y
 * is the same on a phone as on an ultrawide. That is `desk-stage.ts`'s aperture
 * argument, reused for the reveal.
 */
/** Her mark's depth at ending t, on the staging's own path. */
function deskZAt(staging: DeskStaging, t: number): number {
  const cross = staging.walks ? smootherstep(across(t, GIRL_DESK_WALK_START, GIRL_DESK_SETTLED)) : 1
  return staging.from[1] + (staging.to[1] - staging.from[1]) * cross
}

/** The frame's own screen lines at an ending t: her head, and the desk's back edge. */
function linesAt(staging: DeskStaging, t: number): { head: number; edge: number } {
  const e = endingStateAt(1 + t * ENDING_SPAN)
  const k = cameraZoomScale(e)
  const drop = endingAimDrop(e)
  return {
    head: ndcYAt([0, GIRL_DESK_SEAT_Y + GIRL_DESK_HEIGHT, deskZAt(staging, t)], k, drop),
    edge: ndcYAt([0, DESK_TOP_Y, DESK_BACK_Z], k, drop),
  }
}

export function deskRevealFor(staging: DeskStaging): number {
  const STEPS = 640
  for (let i = 0; i <= STEPS; i++) {
    const t = GIRL_TRANSFER + ((1 - GIRL_TRANSFER) * i) / STEPS
    if (linesAt(staging, t).head > -1) return t
  }
  return GIRL_DESK_SETTLED
}

export const GIRL_DESK_REVEAL = deskRevealFor(GIRL_DESK_STAGING)

/**
 * THE FLOAT TEST — how much of her stands above the desk's back edge, in ndc, on
 * the frame she is first drawn in. Positive is a defect.
 *
 * The first cut of this ending had no such test and shipped the failure it
 * describes: at t ≈ 0.50 her head and shoulders stood in the studio's empty
 * backdrop with the desk's back edge still BELOW the frame, because the pull-back
 * reveals the desk back-to-front and she was standing on the part that arrives
 * first. Cropped is not the same as covered.
 *
 * What makes it zero is depth: a mark at z ≳ 9.35 is low enough on screen that the
 * desk's edge has already climbed past her head by the time her head reaches the
 * frame at all, so her whole entrance happens inside the picture of the desk. That
 * single inequality is what pins every staging below to the figurine row — with the
 * measured free corridor (see DESK_STAGINGS) it is the second of the two walls the
 * desk puts around this walk.
 */
export function deskFloatFor(staging: DeskStaging): number {
  const { head, edge } = linesAt(staging, deskRevealFor(staging))
  return head - edge
}

export type GirlStage = 'journey' | 'globe' | 'desk'

export type GirlPose = {
  readonly stage: GirlStage
  /** Whether she is drawn at all. False only inside the transfer's hidden window. */
  readonly visible: boolean
  /** Surface bearing on the planet (rad). Meaningless off the globe. */
  readonly theta: number
  /** Radial offset from the surface (world u) — the flight's lift. 0 on the ground. */
  readonly lift: number
  /** The flight's own 0→1, 0 outside the jump window. Drives the Jump_B action. */
  readonly jump: number
  /** Desk-plane position. Meaningless on the globe. */
  readonly x: number
  readonly z: number
  /** Facing about her own up axis (rad). 0 is the authored facing, toward +z. */
  readonly yaw: number
  /** Uniform scale on the 1.7-unit mesh. */
  readonly scale: number
  /** Cumulative distance walked, in world units — drives the clip's time. */
  readonly walked: number
  /** 1 while travelling, 0 once settled. The blend between skip and idle. */
  readonly moving: number
}

const JOURNEY_POSE: GirlPose = Object.freeze({
  stage: 'journey' as const,
  visible: true,
  theta: STANCE_ALPHA,
  lift: 0,
  jump: 0,
  x: 0,
  z: 0,
  yaw: 0,
  scale: GIRL_GLOBE_SCALE,
  walked: 0,
  moving: 1,
})

/**
 * Her whole placement at an ending state. Total and pure in two inputs; returns a
 * SHARED FROZEN object for the entire journey, so the six chapters cost no
 * allocation (the `ENDING_IDLE` treatment, for the same reason).
 *
 * `reduced` collapses the whole performance: she is on the desk, at her mark, for
 * the entire ending. The cut then lands on the journey/ending boundary itself —
 * the one instant in the track where the timeline already changes character — and
 * there is no motion anywhere in it that a visitor did not scroll.
 */
export function girlPoseAt(ending: EndingState, reduced: boolean): GirlPose {
  if (!ending.active) return JOURNEY_POSE
  const t = ending.t
  const stg = GIRL_DESK_STAGING

  if (reduced) {
    return {
      stage: 'desk',
      visible: GIRL_DESK_MOUNTED,
      theta: STANCE_ALPHA,
      lift: 0,
      jump: 0,
      x: stg.to[0],
      z: stg.to[1],
      yaw: stg.restYaw,
      scale: GIRL_DESK_SCALE,
      walked: 0,
      moving: 0,
    }
  }

  if (t < GIRL_TRANSFER) {
    const walk = smootherstep(across(t, GIRL_TURN_END, GIRL_WALK_END))
    const walkTheta = mix(STANCE_ALPHA, GIRL_STOP_THETA, walk)
    // The flight's clock is LINEAR in scroll — ballistics happen in time, and the
    // scroll is the ending's time. Easing it would bend gravity.
    const jump = across(t, GIRL_JUMP_START, GIRL_JUMP_END)
    const theta = mix(walkTheta, GIRL_JUMP_END_THETA, jump)
    // She turns away to walk, and turns back for the goodbye. `mix(x, 0, 1)` is
    // exactly +0, so from GIRL_LOOK_END on she faces the reader without residue.
    const turnAway = Math.PI * smootherstep(across(t, GIRL_TURN_START, GIRL_TURN_END))
    const yaw = mix(turnAway, 0, smootherstep(across(t, GIRL_LOOK_START, GIRL_LOOK_END)))
    return {
      stage: 'globe',
      visible: true,
      theta,
      lift: jumpLiftAt(jump),
      jump,
      x: 0,
      z: 0,
      yaw,
      scale: GIRL_GLOBE_SCALE,
      walked: (STANCE_ALPHA - walkTheta) * PLANET_RADIUS,
      moving:
        across(t, GIRL_TURN_START, GIRL_TURN_END) *
        (1 - across(t, GIRL_WALK_END - 0.02, GIRL_WALK_END)),
    }
  }

  const cross = stg.walks ? smootherstep(across(t, GIRL_DESK_WALK_START, GIRL_DESK_SETTLED)) : 1
  const x = mix(stg.from[0], stg.to[0], cross)
  const z = mix(stg.from[1], stg.to[1], cross)
  const dx = stg.to[0] - stg.from[0]
  const dz = stg.to[1] - stg.from[1]
  const travelYaw = dx === 0 && dz === 0 ? stg.restYaw : Math.atan2(dx, dz)
  // She turns to face out of the frame over the last of her approach, so the money
  // shot has her facing the reader rather than her own back.
  const turn = smootherstep(across(t, GIRL_DESK_SETTLED - GIRL_DESK_TURN, GIRL_DESK_SETTLED))
  return {
    stage: 'desk',
    visible: GIRL_DESK_MOUNTED && t >= GIRL_DESK_REVEAL,
    theta: STANCE_ALPHA,
    lift: 0,
    jump: 0,
    x,
    z,
    yaw: mix(travelYaw, stg.restYaw, turn),
    scale: GIRL_DESK_SCALE,
    walked: Math.hypot(x - stg.from[0], z - stg.from[1]),
    moving: stg.walks ? 1 - turn : 0,
  }
}

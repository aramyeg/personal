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
 * ALWINA LEAVES THE WORLD (Task 76) — the girl walks off the clay planet and ends
 * up ON THE DESK, a third figure among her own figurines.
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
 * THE EXIT IS OVER THE FAR CREST, AND THAT IS FORCED
 * ============================================================================
 * She stands at `STANCE_ALPHA` (19.93° from the pole, measured the way
 * `anchorTransform` measures it: dir = (0, cos θ, sin θ)). The journey camera sits
 * at θ = 90° − pitch = 70°, so the surface is visible over
 * θ ∈ [−9.52°, 149.52°] and she has two ways out.
 *
 *   TOWARD THE VIEWER (+θ, which is the way she already faces) she would have to
 *   reach θ = 149.52° to lose the surface — 130° of travel, on which she rotates
 *   with the surface normal until she is lying on her back pointing at the camera.
 *   Her HEAD (see below) does not clear until θ = 199°. Not a walk; a somersault.
 *
 *   AWAY OVER THE POLE (−θ) she loses the surface after 29.5°, and everything
 *   after that is the oldest picture there is: someone walking over a hill, going
 *   down by the head. She has to turn round first, which is a beat rather than a
 *   cost — she turns her back on the world and goes.
 *
 * `GIRL_EXIT_THETA` is where she is GONE, and it is solved rather than eyeballed,
 * because the answer is much further than the horizon: the tangent at
 * θ = −9.52° hides a point ON the surface, and she is 1.19 units tall. A point at
 * radius ρ is hidden from a camera at distance d by a sphere of radius R exactly
 * when its angular separation from the camera exceeds
 * `acos(R/d) + acos(R/ρ)` — the two horizon half-angles — which for her head is
 * 132.6°, not 79.5°. Solved against the FULL PULL-BACK distance (the larger of the
 * two, since a camera further away sees further round) so the same angle hides her
 * at every stop the ending can reach, and against the bare `PLANET_RADIUS` rather
 * than the terrain that actually stands there, which can only hide her sooner.
 *
 * ============================================================================
 * SCROLL PURITY — AND ONE WALL CLOCK REMOVED
 * ============================================================================
 * Every number here is a pure function of `EndingState.t`. That includes her WALK
 * PHASE: `walked` is the cumulative surface distance she has covered, so
 * `girl.tsx` can set the skip clip's time from it instead of advancing the mixer
 * by a frame delta. Scrubbing backwards therefore un-walks her, foot for foot,
 * rather than playing a forward skip while she slides backwards.
 *
 * That is a wall clock REMOVED from the ending, not added: the AnimationMixer has
 * been running on `delta` since the girl was first mounted, and Task 71 recorded
 * that it is why the ending's forward/backward captures could not be compared bit
 * for bit. Inside the ending it now runs on scroll. The coffee steam (Task 72)
 * stays the ending's one wall-clock exception.
 *
 * ============================================================================
 * THE TRANSFER, AND WHY NOTHING POPS
 * ============================================================================
 * Two occluders hand her over, and there is a window where BOTH hold:
 *   - from `GIRL_EXIT_END` she is behind the planet (the solve above);
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

/** ...and how tall that makes her, which is what the exit solve needs. */
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

/** Half-angle of the horizon seen from distance `d` past a sphere of PLANET_RADIUS. */
const horizonAt = (d: number): number => Math.acos(Math.min(1, PLANET_RADIUS / d))

/**
 * Slack past the solved angle, in radians. The camera is not quite fixed: Task 72's
 * pointer parallax orbits it ±1.2° in pitch about the solved aim, which walks the
 * horizon by the same amount. 0.05 rad (2.86°) covers that twice over.
 */
export const GIRL_EXIT_MARGIN = 0.05

/**
 * Where she is GONE — see the header for the two-horizon derivation. Negative:
 * she walks against the way she faces, over the pole and down the far side.
 */
export const GIRL_EXIT_THETA =
  CAMERA_THETA -
  (horizonAt(CAMERA_DISTANCE * ZOOM_FACTOR) + horizonAt(PLANET_RADIUS + GIRL_GLOBE_HEIGHT)) -
  GIRL_EXIT_MARGIN

/** How far she walks on the planet, along the surface, in world units. */
export const GIRL_EXIT_ARC = (STANCE_ALPHA - GIRL_EXIT_THETA) * PLANET_RADIUS

// ---------------------------------------------------------------------------
// THE BEATS, in the ending's own t
// ---------------------------------------------------------------------------

/** She turns her back on the world over this window. Starts after 0 so the first
 *  frames of the ending are bit-identically the journey's last one. */
export const GIRL_TURN_START = 0.03
export const GIRL_TURN_END = 0.11

/** ...and walks to `GIRL_EXIT_THETA` by here, inside the stand's rise (STAND_END 0.3). */
export const GIRL_WALK_END = 0.32

/**
 * When she stops being on the planet and starts being on the desk. Anywhere in
 * [GIRL_WALK_END, GIRL_DESK_REVEAL] is equivalent — she is drawn in neither place
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
      visible: true,
      theta: STANCE_ALPHA,
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
    const theta = mix(STANCE_ALPHA, GIRL_EXIT_THETA, walk)
    return {
      stage: 'globe',
      visible: true,
      theta,
      x: 0,
      z: 0,
      yaw: Math.PI * smootherstep(across(t, GIRL_TURN_START, GIRL_TURN_END)),
      scale: GIRL_GLOBE_SCALE,
      walked: (STANCE_ALPHA - theta) * PLANET_RADIUS,
      moving: across(t, GIRL_TURN_START, GIRL_TURN_END) * (1 - across(t, GIRL_WALK_END - 0.02, GIRL_WALK_END)),
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
    visible: t >= GIRL_DESK_REVEAL,
    theta: STANCE_ALPHA,
    x,
    z,
    yaw: mix(travelYaw, stg.restYaw, turn),
    scale: GIRL_DESK_SCALE,
    walked: Math.hypot(x - stg.from[0], z - stg.from[1]),
    moving: stg.walks ? 1 - turn : 0,
  }
}

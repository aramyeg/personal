import { CHAPTER_COUNT } from './chapters'

/**
 * THE ENDING SPINE (Round 20, Task 63) — the scroll real estate AFTER the journey.
 *
 * ============================================================================
 * WHY THE ENDING LIVES PAST progress = 1
 * ============================================================================
 * Every existing consumer of journey progress CLAMPS its input to [0, 1]:
 * `rotationAt`, `journeyStateAt`, `moodBlendAt`/`gradeAt`, `dwellChapterAt`, the
 * progress rail. So if the scroll track grows an ending segment and the driver
 * hands the scene a progress that runs past 1, every one of those systems is
 * already saturated at its end state BY CONSTRUCTION — rotation parked at
 * ROTATION_TOTAL, the winter mood held, the epilogue paint standing, no dwell,
 * no reveal. Nothing needs a new "is the journey over" branch, because the
 * clamp IS that branch, and it has been there since Task 8.
 *
 * The ending alone reads the un-clamped value. This is the same argument class
 * as Task 54's absorption (which is safe because it only ever holds progress
 * still inside a dwell, where rotation is already clamped): extend the domain
 * exactly where everything else has stopped moving.
 *
 * ============================================================================
 * THE INVARIANT THIS BUYS (the reason the camera may move at all)
 * ============================================================================
 * The renewal proofs — the hidden flip window, Task 60's epilogue periodicity in
 * q = rotation − thetaC, the GatedProp margins — all hold because occlusion is
 * exactly periodic in q, and that is only true while the camera never moves.
 * So the camera may move ONLY where rotation can no longer change:
 *
 *   rotation can change   ⇐  progress <  1            (`rotationAt` clamps at 1;
 *                                                      in fact it freezes at the
 *                                                      chapter-6 stop, 0.925)
 *   camera can move       ⇐  progress >  ZOOM_FIRST_MOVE = 1 + ZOOM_START·ENDING_SPAN
 *
 * The two sets are disjoint with the whole CURTAIN window between them, and the
 * camera pose is a PURE FUNCTION of progress (scene/camera.ts), so scrubbing
 * backwards rewinds the zoom through the identical function before progress can
 * re-enter the journey domain. There is no reverse case to prove and no state
 * that could survive a scrub. `__tests__/labs/small-world/ending-camera.test.ts`
 * pins it: the pose is bit-identical to the static pose across the whole journey
 * domain, and the first progress at which it may differ is DERIVED from the
 * constants below rather than restated.
 *
 * A second fact makes the widening frustum safe on its own terms: at
 * rotation = ROTATION_TOTAL every renewal gate is exactly 0 or 1 (see
 * `ending-camera.test.ts`), so the extra sliver of planet a pulled-back camera
 * reveals cannot contain a mid-flip lerp. It is 79.5° of visible cap at rest and
 * 86.5° at full pull-back — 7° more surface, all of it in its final state.
 *
 * ============================================================================
 * THE TIMELINE — what T64 (curtain call) and T65 (desk reveal) build against
 * ============================================================================
 * Read it the way `RevealState` is read: windows, `t` semantics, phase names.
 * Everything here is a pure function of scroll with no wall clock anywhere, so
 * forward and backward scrubbing produce bit-identical values (the Task 54
 * arrival clock is the lab's ONE sanctioned wall-clock exception and it does not
 * extend to the ending — a checkpoint reveal cannot even exist past PANEL_END of
 * the last chapter, so the ending is outside every dwell and every absorption).
 *
 * `t`       — the ending's OWN 0→1, linear in scroll. 0 at progress = 1 (the last
 *             frame of the journey), 1 at progress = TRACK_END (the bottom of the
 *             track). Consumers ease it themselves — `t` stays linear so a
 *             consumer can pick its own curve, exactly as `RevealState.t` does.
 * `phase`   — 'journey' before the ending, then 'curtain', then 'zoom'. The name
 *             of the beat, for staging one-shots; the windows below are the truth.
 * `curtain` — 0→1 across t ∈ [0, CURTAIN_END], then PARKED at 1 for the rest of
 *             the ending. The mascots gather and BOW here, and they stay bowed
 *             through the pull-back — the curtain call does not pack up when the
 *             camera starts moving, it becomes the thing being pulled away from.
 *             T64 owns what gathers; this is only when.
 * `zoom`    — 0 through t ∈ [0, ZOOM_START], then 0→1 across [ZOOM_START, 1].
 *             The camera's pull-back parameter and nothing else's. The gap
 *             between CURTAIN_END and ZOOM_START is a deliberate STILL BEAT:
 *             the bow lands, the frame holds, and only then does the world start
 *             to recede. It is also the invariant's margin.
 * `active`  — false for progress <= 1 (the journey owns that domain, boundary
 *             included), true after. `JourneyState.ending.active` is the correct
 *             "the journey is over" test; `JourneyState.progress` CANNOT tell you
 *             (it is clamped, so it reads 1 for the whole ending).
 *
 * CONSUMER CONTRACT
 *  - Read it from `JourneyState.ending` (scene) or `endingStateAt` (DOM). Do NOT
 *    re-derive it from a progress ref you clamped yourself — the clamp is what
 *    hides the ending.
 *  - Anything you animate here must be a pure function of these values. No
 *    clocks: a visitor who scrubs back must see the ending run backwards exactly.
 *  - The idle state is a SHARED FROZEN OBJECT (`ENDING_IDLE`), so the whole
 *    journey costs zero allocation per frame. Never mutate an EndingState.
 *  - Camera-space rigs that follow the camera (the peeker rig copies its
 *    transform every frame) must run AFTER the camera rig or they lag a frame
 *    once the pull-back starts. scene/camera.ts owns that ordering — see
 *    CAMERA_RIG_PRIORITY.
 */

/**
 * How long the ending is, in CHAPTER-WIDTHS of scroll. 1.75 chapters ≈ 400vh: a
 * gather-and-bow beat you can read without hurrying (≈103vh), a still beat
 * (≈32vh), and a long smooth pull-back (≈262vh) that never feels like it is
 * being yanked. Raising this lengthens every phase proportionally, because the
 * windows below are fractions of the span rather than absolute progress.
 */
export const ENDING_CHAPTERS = 1.75

/** The ending's length in JOURNEY PROGRESS units — the journey is [0, 1], the ending (1, TRACK_END]. */
export const ENDING_SPAN = ENDING_CHAPTERS / CHAPTER_COUNT

/** The largest progress the scroll track can produce. The driver's domain is [0, TRACK_END]. */
export const TRACK_END = 1 + ENDING_SPAN

/** `curtain` reaches 1 here (fraction of the ending's own t). */
export const CURTAIN_END = 0.26

/** `zoom` leaves 0 here. The still beat is [CURTAIN_END, ZOOM_START]. */
export const ZOOM_START = 0.34

/**
 * The first progress at which the camera may differ from its static pose —
 * DERIVED, so a test can compare the invariant's boundary against the timeline
 * rather than against a number someone typed twice. Everything below it is the
 * journey's frozen-camera domain, which starts a whole curtain-call earlier than
 * the last progress at which rotation can move (1).
 */
export const ZOOM_FIRST_MOVE = 1 + ZOOM_START * ENDING_SPAN

/**
 * Document scroll → journey progress. The split between journey and ending is a pure RATIO of the
 * measured scrollable height, never a pixel subtraction: `vh` (what the track's height is written
 * in) and `window.innerHeight` (what `total` is measured against) disagree on mobile browsers with
 * a collapsing toolbar, and a subtraction would move the journey's end as the toolbar moved.
 */
export function trackProgressAt(scrollY: number, total: number): number {
  if (!(total > 0)) return 0
  const p = (scrollY / total) * TRACK_END
  return p < 0 ? 0 : p > TRACK_END ? TRACK_END : p
}

/** The inverse: where to scroll to land on a journey progress. Used by tap-to-advance. */
export function trackOffsetFor(progress: number, total: number): number {
  return (progress / TRACK_END) * total
}

export type EndingPhase = 'journey' | 'curtain' | 'zoom'

export type EndingState = {
  active: boolean
  t: number
  phase: EndingPhase
  curtain: number
  zoom: number
}

/**
 * The whole journey's ending state, shared and never rebuilt: `endingStateAt`
 * returns THIS object for every progress <= 1, so the six chapters cost no
 * allocation at all. Frozen because a consumer that wrote to it would corrupt
 * every other consumer's read in the same frame.
 */
export const ENDING_IDLE: EndingState = Object.freeze({
  active: false,
  t: 0,
  phase: 'journey',
  curtain: 0,
  zoom: 0,
})

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * The ending's state at a scroll position. Total and pure in one input; the
 * journey domain returns the shared idle state, so this is safe to call every
 * frame from anywhere.
 */
export function endingStateAt(progress: number): EndingState {
  if (!(progress > 1)) return ENDING_IDLE
  const t = clamp01((progress - 1) / ENDING_SPAN)
  return {
    active: true,
    t,
    phase: t < ZOOM_START ? 'curtain' : 'zoom',
    curtain: clamp01(t / CURTAIN_END),
    zoom: clamp01((t - ZOOM_START) / (1 - ZOOM_START)),
  }
}

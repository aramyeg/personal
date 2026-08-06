import {
  CHAPTER_SLICE,
  PARK_FRAC,
  approachRevealGrow,
  chapterStartRotation,
} from '../../journey-timeline'
import { LANE_CROSSINGS } from '../../overlay/grade-mood'

/**
 * WHEN THE ICE ARRIVES (Task 62) — the icebergs' reveal, as pure math.
 *
 * Aram: the icebergs are visible for the whole journey and should appear only once we reach the
 * snow biome. He is right, and T60's own note conceded the placement was "acceptable but not
 * resolved": the bergs sit at negative nx on the ALWAYS-VISIBLE left limb, so a reader standing in
 * the spring meadow is looking at polar ice.
 *
 * NO HIDDEN FLIP IS AVAILABLE, and that is why they were permanent in the first place. Every other
 * staged change in this world happens behind the horizon; `delights.tsx` records why a berg cannot
 * — renewal-scan models a wet cell's silhouette as exactly the waterline with no prop margin, so
 * tall things on the grazing limb are never occluded. The only honest answer left is the one the
 * desert's camels and oasis palms already use: GROW them, in plain view, on purpose. An approach
 * reveal is not a workaround for a failed hide — it is this lab's other established way of
 * introducing something, and it has the advantage of reading as an event rather than as an edit.
 *
 * THE WINDOW IS DERIVED, NOT PICKED, and both ends come from constants that already exist:
 *
 *  - it OPENS at `LANE_CROSSINGS[WINTER_CHAPTER]`, the rotation at which the girl's lane crosses
 *    the painted boundary onto the winter wedge. That is the exact moment Task 59 keys the sky and
 *    the lights to, so the sea freezes as the world's light turns — one event, not two.
 *  - it SPANS whatever is left of the APPROACH after that crossing. It used to borrow the mood
 *    crossfade's own span; Task 73 shortened the approach and the two purposes stopped agreeing.
 *    See BERG_REVEAL_SPAN_FRAC.
 *
 * Measured against the shipped constants that is progress 0.834 — the chapter-5 boundary is
 * 0.8333 — to 0.873, with the winter checkpoint now at 0.873 too (the stop is at PARK_FRAC of the
 * slice since Task 73, and Task 75 took PARK_FRAC from 0.21 to 0.40). `easeOutBack` is past 1 well
 * before the end of that, so what a reader sees is a beat rather than a slow inflate.
 *
 * BOTH SCRUB DIRECTIONS COME FREE. This is a pure function of the unwrapped rotation, so scrubbing
 * back shrinks the bergs along exactly the curve they grew on and no state can strand one at half
 * size. And because `rotationAt` FREEZES rotation for the whole of every dwell, the ice cannot move
 * while a panel is up.
 *
 * It lives in its own module rather than inside `delights.tsx` so it can be tested as arithmetic,
 * without mounting a canvas — the same split `journey-timeline.ts` exists for.
 */

/** Chapter 5 is the winter wedge (B2); see PEEKER_CAST's own chapter→wedge note. */
export const WINTER_CHAPTER = 5

/** Where in the winter chapter's rotation slice the growth starts — the lane crossing. */
export const BERG_REVEAL_START_FRAC =
  (LANE_CROSSINGS[WINTER_CHAPTER] - chapterStartRotation(WINTER_CHAPTER)) / CHAPTER_SLICE

/**
 * ...and how much of the slice it takes: ALL of the approach that is left after the crossing,
 * less a tenth for headroom.
 *
 * It used to borrow `MOOD_SPAN_FRAC`, which was a stylistic coupling ("one event, not two") that
 * cost nothing back when the approach was the whole slice. Task 73 moved the stop to `PARK_FRAC`
 * of the slice, and the two purposes stopped agreeing: the crossfade is deliberately given only
 * part of the approach (the burst window supplies its stillness margin), whereas the bergs grow ON
 * CAMERA on the always-visible limb and want every pixel of scroll they can get. So this is now
 * derived from the thing it actually cares about — the room between the crossing and the stop.
 *
 * This is still a faster beat than it was before the framing fix, but Task 75 bought most of it
 * back: the approach is 0.24 of a leg now (0.126 at Task 73's park, 0.55 before either), so the
 * visible part of the growth occupies about 0.013 of the scroll track against 0.019 originally and
 * 0.006 at the tightest. It stays on the eye-test list, and if it still reads as a pop the answer
 * is to let the ice start growing on the PREVIOUS chapter's walk-out rather than at the crossing —
 * a change to what the reveal is keyed to, not a number to tune.
 */
export const BERG_REVEAL_SPAN_FRAC = (PARK_FRAC - BERG_REVEAL_START_FRAC) * 0.9

/**
 * Below this a berg is not drawn at all, so the five chapters before winter pay nothing for it —
 * the four bergs are the only per-frame draw cost this reveal has, and it removes it rather than
 * scaling it to a speck.
 */
export const BERG_MIN_SCALE = 0.004

/** Uniform scale of every iceberg at an unwrapped journey rotation. 0 before the winter crossing. */
export function bergGrow(rotation: number): number {
  return approachRevealGrow(
    WINTER_CHAPTER,
    rotation,
    BERG_REVEAL_START_FRAC,
    BERG_REVEAL_SPAN_FRAC
  )
}

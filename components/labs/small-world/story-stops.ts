import { CHAPTER_COUNT } from './chapters'
import { trackOffsetFor } from './ending-timeline'
import { chapterDwellProgress } from './journey-timeline'

/**
 * STORY STOPS (Task 75) — on a touch device the journey settles at checkpoints instead of sailing.
 *
 * ============================================================================
 * THE DEFECT, MEASURED
 * ============================================================================
 * Aram, on his phone: "I hate the scroll on mobile — scrolling hard it just jumps a couple of
 * biomes; there should be scroll stop story points between the biomes."
 *
 * Reproduced with real touch flings (timestamped CDP touch dispatch, HEADED Chromium): a 400 px
 * flick over 60 ms carries 2942 px — 1.54 chapters — and lands in the bare approach of the chapter
 * after next, no card up, half a chapter past a checkpoint. A hard flick tops out at 1.73 chapters
 * because the platform caps fling velocity, so "a couple of biomes" is exactly right.
 *
 * TWO HARNESS FACTS, both of which invalidate the obvious test:
 *  - `window.scrollTo` cannot see this feature AT ALL. It has no momentum, so a scripted scroll
 *    lands where it is told and every case passes.
 *  - HEADLESS Chromium has no fling either: the same flick that carries 2942 px headed carries its
 *    finger travel and stops. A headless harness reports the defect as absent.
 *
 * ============================================================================
 * THE MECHANISM: `scroll-snap-stop: always`, ARMED BY GESTURE VELOCITY
 * ============================================================================
 * One snap area per checkpoint, and `scroll-snap-type: y mandatory` on the root scroller for
 * exactly as long as a FLING is being made. The browser's own fling is then forbidden to pass over
 * a checkpoint, so it stops at the first one it reaches: one story stop per fling, at any strength,
 * animated by the platform itself.
 *
 * WHY MANDATORY RATHER THAN PROXIMITY, which is what this was first built as. Measured, from a
 * checkpoint, landing distance from the next one:
 *
 *   flick travel        150     250     350     450     550     700     900   (px, 45-60 ms)
 *   proximity          -580px    ON    -921px  -815px  -709px  -549px  -337px
 *   mandatory            ON      ON      ON      ON      ON      ON      ON
 *
 * Under `proximity` the browser honours `scroll-snap-stop: always` for none of it — only the one
 * fling whose natural landing happened to fall inside the proximity radius (measured under 580 px)
 * snapped, and that is ordinary proximity snapping, not the stop. Under `mandatory` every fling
 * from the gentlest to the hardest advances exactly one stop. The spec says the stop must be
 * honoured either way; this engine only does it under mandatory, and the mechanism has to be built
 * against the browser that exists.
 *
 * WHY THE ARMING, then: mandatory snapping ALWAYS is not acceptable. It would pull a slow drag to
 * the nearest checkpoint (the brief: slow scrolling stays fully free) and, since the ending carries
 * no snap areas, it would drag a reader who scrolled into the ending back to the last checkpoint.
 * So the snap type is on the root scroller only while the gesture in progress is a fling.
 *
 * ARMED DURING `touchmove`, WHICH IS THE ONLY MOMENT THAT WORKS. Both alternatives were measured:
 *  - arming at `touchend` is TOO LATE — the hard fling is already underway and passes over
 *    (3260 px, 549 px past the stop) while a soft one is caught;
 *  - arming at `touchstart` and disarming at `touchend` for slow gestures is too late to disarm: a
 *    300 px/700 ms drag was yanked 615 px BACKWARDS and left 285 px off a stop, which is worse than
 *    either behaviour on its own.
 * A flick is already fast several moves before the finger leaves the glass, so reading velocity per
 * move arms it early enough for the platform to see, and never arms a drag at all.
 *
 * THE THRESHOLD IS DERIVED, not chosen: it is the velocity at which the PLATFORM starts adding
 * momentum, i.e. the velocity at which a gesture becomes a fling in the first place. Measured on a
 * 300 px gesture, release velocity against how far the page actually travelled:
 *
 *   release px/s    250    375    500    667    856   |  1152   1670   2500   5034
 *   travelled       285    285    285    285    285   |   537    809   1485   2836
 *
 * Nothing below 856 px/s produces a single pixel of momentum and everything from 1152 px/s does;
 * FLING_VELOCITY sits in the middle of that bracket. Below it the mechanism cannot engage, so a
 * slow reader never meets it; above it the platform is flinging anyway, and all this does is decide
 * where the fling is allowed to stop.
 *
 * ============================================================================
 * THE RAILS
 * ============================================================================
 *  1. IT MAY ONLY MOVE THE SCROLL POSITION. Every visual in the lab stays a pure function of
 *     scroll; a snapped landing is indistinguishable from a hand-placed one, and no consumer is
 *     told a snap happened. Nothing here calls `preventDefault` or drops an event.
 *  2. TOUCH ONLY. Everything is behind `(pointer: coarse)`. On a mouse or a keyboard the areas are
 *     not rendered and the root scroller never carries a snap type, so desktop is untouched.
 *  3. NOTHING PAST THE LAST CHECKPOINT. There is no snap area in the walk-out or the ending, and
 *     the arming refuses to engage at or past the last stop — so the pull-back stays continuous,
 *     and a fling from the last checkpoint runs into the ending as freely as it does today.
 *  4. NO AUTONOMOUS MOVEMENT UNDER REDUCED MOTION. A snap moves the page by itself, so the whole
 *     mechanism is off there. (The lab already declines to mount its 3D journey under reduced
 *     motion; this is the same promise stated where the mechanism lives.)
 *  5. ONE AUTHORITY OVER THE SCROLL. The platform animates; this code never writes `scrollTop`.
 *     That is what keeps it from fighting the damped camera or the page's smooth-scroll CSS — a JS
 *     magnet easing the scroll while the platform is still flinging would have been two.
 *
 * THE STOP IS THE DWELL'S MIDDLE — `chapterDwellProgress`, the beat the lab already names "cards
 * up, settled" and the one the e2e scroll targets aim at. It is the furthest a landing can be from
 * either edge of the dwell, so the cards are up and in no danger of retracting. Tap-to-advance aims
 * at the next chapter's BOUNDARY instead and is deliberately left alone: a tap has no velocity, so
 * it never arms the snap and behaves exactly as it did before.
 */

/** Journey progress of each story stop — one per checkpoint, in journey order. */
export const STORY_STOP_PROGRESS: readonly number[] = Array.from(
  { length: CHAPTER_COUNT },
  (_, c) => chapterDwellProgress(c)
)

/** Class the root scroller wears while a fling is allowed to be caught. */
export const SNAP_CLASS = 'sw-story-stops'

/**
 * Release velocity, px/s, at or above which a gesture is treated as a fling. See the bracket in the
 * header: the platform itself adds no momentum below 856 and flings from 1152.
 */
export const FLING_VELOCITY = 1000

/**
 * The stops' offsets from the TOP OF THE TRACK, in pixels.
 *
 * `total` is the track's own scrollable height (`scrollHeight − innerHeight`), which is what
 * `trackOffsetFor` is written against — the same call `advanceTo` makes for tap-to-advance. Sharing
 * the expression is the point: an area placed by any other derivation would sit off the position
 * the rest of the lab aims at by however much the two disagreed.
 */
export function stopOffsets(total: number): number[] {
  return STORY_STOP_PROGRESS.map((p) => trackOffsetFor(p, total))
}

/** Whether the mechanism may exist at all on this device. */
export function storyStopsAvailable(coarsePointer: boolean, reducedMotion: boolean): boolean {
  return coarsePointer && !reducedMotion
}

/**
 * Whether the gesture in progress should arm the snap: fast enough to be a fling, and still short
 * of the last checkpoint so the ending is never snapped. Pure, so the policy is testable without a
 * browser and without a gesture.
 */
export function flingArmed(velocity: number, scrollY: number, lastStopY: number): boolean {
  return Math.abs(velocity) >= FLING_VELOCITY && scrollY < lastStopY - 1
}

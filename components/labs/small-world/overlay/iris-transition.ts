import { RETRACT_SECONDS } from '../arrival'
import { TRACK_END } from '../ending-timeline'

/**
 * THE IRIS (Task 106, generalized in Task 108) — the transition that replaces the rewind, as data.
 *
 * It was `restart-transition.ts` and it aimed at one place. Task 108 added a second control that
 * needs the identical gesture pointed somewhere else ("skip to the desk"), so the file is named for
 * the MECHANISM rather than for its first caller: an iris is a jump-anywhere-under-cover, and the
 * destination is now a parameter (`IRIS_START`, `IRIS_DESK`) instead of a hard-coded `scrollTo(0)`.
 * Building a second veil would have meant a second set of timings, a second mask and a second
 * chance to get the "the document may not move while the frame is visible" law wrong.
 *
 * ============================================================================
 * WHAT WAS WRONG WITH THE REWIND, MEASURED
 * ============================================================================
 * Aram: "when clicking start the journey over I don't like that it rerolls to the first biome
 * with animation being sort of clanky, maybe we can have another approach."
 *
 * The old restart called the same `advanceTo` the chapter panels use — `window.scrollTo({ top: 0,
 * behavior: 'smooth' })` — on the assumption that the story running backwards would be a pleasure.
 * Instrumented at animation-frame resolution on the shipped build (1440×900, the harness and the
 * frame strip are in the report), what it actually does is:
 *
 *   the whole ENDING     22 frames   367 ms
 *   chapter 6             3 frames    50 ms
 *   chapter 5             3 frames    50 ms
 *   chapter 4             4 frames    67 ms
 *   chapter 3             7 frames   117 ms
 *   chapter 2            11 frames   184 ms
 *   chapter 1            the rest — the whole tail of the ease
 *
 * NOT ONE FRAME WAS DROPPED. The frame interval held at 16.7 ms for the entire 1483 ms, which is
 * the finding that matters: this was never a performance problem, so no amount of tuning the
 * easing could have fixed it. It is a CONTENT problem. Chrome's programmatic smooth scroll covers
 * 14 220 px in about a second and a half whatever the distance, so each of six authored worlds —
 * 240 vh of biome, palette, mascots and cards apiece — is on screen for three frames. The studio
 * set (desk, backdrop, grade, the neon) exists for 19 frames and then switches off inside a single
 * 251 px step. The velocity-driven overlays do exactly what they are told: the speed lines pin at
 * maximum because a programmatic scroll IS maximum velocity, and the discovery mascots pop for one
 * frame each on the way past. Six worlds at three frames each is not a rewind. It is a strobe, and
 * "clanky" is a generous word for it.
 *
 * ============================================================================
 * SO THE STORY DOES NOT RUN BACKWARDS AT ALL — IT IS COVERED
 * ============================================================================
 * The iris closes on the world, the page jumps to the top UNDER it, and it opens on the beginning.
 * The visitor sees two seconds of one deliberate gesture instead of a second and a half of six
 * worlds fighting for three frames each.
 *
 * Three consequences, all of them the point:
 *
 *  - THE SCENE STAYS SCROLL-PURE. Under the cover the transition does exactly one thing to the
 *    document: `pinScrollToTop()`, the SAME call the lab already makes on mount to defeat scroll
 *    restoration. So the scene does not get a special restart path — it gets a fresh load's scroll
 *    event, and everything keyed to scroll lands where a fresh load lands, by construction rather
 *    than by reset. (The arrival machine sees a jump far past its teleport allowance and honours
 *    it as `pass` at progress 0, which is the branch it has had since Task 54.)
 *  - THE VEIL IS UI CHROME AND MAY READ A CLOCK. It is DOM over the canvas; nothing in the scene
 *    can see it, and the scene underneath is still a pure function of scroll. This is the same
 *    line `ending-timeline.ts` draws, on the correct side of it.
 *  - REDUCED MOTION GETS THE CUT WITHOUT THE GESTURE. `pinScrollToTop()` and nothing else.
 *
 * ============================================================================
 * WHY AN IRIS, AND WHY IN THESE TWO COLOURS
 * ============================================================================
 * Look-dev over the real money shot (four candidates, sheets in the report). A paper sweep and a
 * dissolve both died on the same fact: the room IS paper-coloured, so a near-white veil crossing a
 * near-white cyc has nothing to read against and looks like a frame that failed to render. What
 * the lab does have is a comic vocabulary — panels, speed lines, manga pages — and the iris is that
 * vocabulary's own full stop. Closing one on the world and opening it on the beginning says
 * "chapter over, back to page one" in a language the page has been speaking for six chapters.
 *
 * The field is `blossom` (the neon's gas, the softest pink in the room) and the RIM is
 * `studioRoseDeep` — which is the connect pill's border, the CV's underline, and the dashed rule
 * under the very button that was clicked. The rim is what makes the shape read as drawn rather
 * than as fog; without it the same animation is a pink vignette, which is what the first three
 * look-dev rows are.
 */

/** Iris radius as a percentage of the gradient line — 0 is fully covered, this is fully open. */
export const VEIL_OPEN = 104

/** The iris shuts. Quick: the visitor has asked to leave, and this is the leaving. */
export const COVER_MS = 320
/**
 * Covered, and the only phase that does anything to the document. Long enough for the jump plus
 * the frames that follow it — the scene's driver reads scroll on the next frame and the renderer
 * draws on the one after, so a hold shorter than about three frames can reveal the last frame of
 * the ending instead of the first frame of the journey.
 */
export const HOLD_MS = 110
/**
 * ...AND THE DESK NEEDS LONGER, because of what a skip leaves running behind the cover.
 *
 * The restart's 110 ms is enough because the top of the track has no wall clock on it: everything
 * the scene draws there is a pure function of a scroll position the jump has already set. The skip
 * lands somewhere the visitor may have been READING — the natural place to press it is parked at a
 * checkpoint with a spread up — and a checkpoint's spread does not vanish when its dwell does. The
 * arrival machine walks the reveal back out over `RETRACT_SECONDS` of WALL CLOCK, and that
 * retraction starts on the frame the jump lands, so with a 110 ms hold the iris would open on a
 * chapter spread whipping itself off the desk.
 *
 * So the hold is DERIVED from the beat it has to outlast rather than typed: the retraction, plus a
 * margin. Retuning the walk-out in `arrival.ts` moves this with it.
 *
 * THE MARGIN IS SIX FRAMES AND THAT IS A MEASUREMENT (skip pressed at chapter 4's stop, shipped
 * build, 1440×900 — the traces are in the report). The spread does not start walking out on the
 * frame the jump lands: the arrival driver is idle until something makes it busy, so the retraction
 * clock begins a tick or two late and the spread's real lifetime after the jump came out at 450 ms
 * against `RETRACT_SECONDS`'s 420. A three-frame margin left ONE frame of cover to spare and lost
 * that race in one run of two — the iris cracked open to 6.6% with the spread still mounted. Six
 * frames leaves four, which is the same margin the restart's own hold keeps over the renderer.
 */
export const DESK_HOLD_MS = RETRACT_SECONDS * 1000 + 6 * (1000 / 60)
/** The iris opens. Slower than it shut: arriving somewhere is worth more time than leaving. */
export const REVEAL_MS = 470

/** The whole gesture, for a given covered hold. */
export function veilMs(hold: number): number {
  return COVER_MS + hold + REVEAL_MS
}

/** The restart's total — the shape of the gesture before it had a second destination. */
export const VEIL_MS = veilMs(HOLD_MS)

/**
 * ============================================================================
 * THE DESTINATIONS
 * ============================================================================
 * Both are JOURNEY PROGRESS, the same units `advanceTo` and the story stops speak, so a caller
 * cannot mix up "a scroll position" with "a place in the story" — and so the desk stays defined as
 * the END OF THE TRACK rather than as a pixel count that would need re-measuring per viewport.
 */
/** Page one. The restart. */
export const IRIS_START = 0
/** The desk: the last frame of the ending, where the note is settled and the connect block is up. */
export const IRIS_DESK = TRACK_END

/**
 * How long the cover has to hold for a given destination — the top needs only the renderer's
 * frames, the ending needs the checkpoint walk-out as well. Solved here rather than at the call
 * site so the two controls cannot disagree about it.
 */
export function holdMsFor(target: number): number {
  return target > 1 ? DESK_HOLD_MS : HOLD_MS
}

/** How wide the inked rim is, in the same percentage units as the radius. */
export const VEIL_RIM = 1.1
/** The mask's ramp — tight, so the edge reads as a line rather than as a blur. */
export const VEIL_EDGE = 1.6

const easeIn = (u: number): number => u * u * u
const easeOut = (u: number): number => 1 - (1 - u) * (1 - u) * (1 - u)

export type VeilState = {
  /** Iris radius, 0 (covered) to VEIL_OPEN (gone). */
  radius: number
  /** True from the first frame of the covered hold onward — the caller jumps once on the edge. */
  jump: boolean
  /** True once the whole gesture is over and the veil may unmount. */
  done: boolean
}

/**
 * The gesture at a point on its own clock, in ms since it started. Pure, so the law that matters —
 * the document may not move until the iris is SHUT — is a property of this function rather than a
 * hope about the frame loop. `hold` is the covered phase's length; it defaults to the restart's, so
 * the law holds for whatever a destination asks for and the sweep that proves it does not have to
 * be re-derived per caller.
 */
export function veilStateAt(ms: number, hold: number = HOLD_MS): VeilState {
  const total = veilMs(hold)
  if (ms <= 0) return { radius: VEIL_OPEN, jump: false, done: false }
  if (ms < COVER_MS) {
    return { radius: VEIL_OPEN * (1 - easeIn(ms / COVER_MS)), jump: false, done: false }
  }
  if (ms < COVER_MS + hold) return { radius: 0, jump: true, done: false }
  if (ms < total) {
    const u = (ms - COVER_MS - hold) / REVEAL_MS
    return { radius: VEIL_OPEN * easeOut(u), jump: true, done: false }
  }
  return { radius: VEIL_OPEN, jump: true, done: true }
}

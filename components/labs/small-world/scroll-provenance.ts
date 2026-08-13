/**
 * ============================================================================
 * WHERE DID THE DOCUMENT'S MOTION COME FROM? (Task 126)
 * ============================================================================
 * The pace governor has to let some jumps through instantly and pace everything
 * else. Task 109 decided which was which by DISTANCE — a frame that moved further
 * than any hand could was taken for a scrollbar drag. Measured on this lab's own
 * track, at a phone viewport, with real timestamped CDP touch flings: the threshold
 * is 952 px in a frame and the hardest fling Chromium will produce delivers 932 px.
 * A 2% margin between "the reader chose a destination" and "the reader flicked hard"
 * is not a distinction, it is a coincidence waiting to break on a taller screen.
 *
 * So the question is asked properly instead. Not "how far", but "who moved it".
 *
 * ---------------------------------------------------------------------------
 * THE POLICY: TRAVEL IS GOVERNED, PLACEMENT IS INSTANT
 * ---------------------------------------------------------------------------
 * Every way a document can move sorts into one of two kinds, and the split is not
 * about magnitude at all — it is about whether the reader named a DESTINATION or
 * applied a FORCE.
 *
 *  TRAVEL — a wheel notch, a finger drag, the momentum a flick leaves behind, a
 *    stepping key. The reader pushed, and the browser decided where that push
 *    lands. They asked to move, not to arrive. Every frame of it is governed, at
 *    any speed, for any duration: this is the whole of Aram's demand, and it is
 *    why momentum has to inherit its gesture's class rather than be judged fresh
 *    (momentum has no events of its own — judged fresh, every fling in the lab
 *    would read as a scrollbar drag, which is the loophole in its purest form).
 *
 *  PLACEMENT — a scrollbar thumb dragged to a spot, Home/End, an in-page anchor,
 *    browser-back's scroll restoration, find-in-page. The reader named a position.
 *    Pacing these would be answering "take me there" with "let me show you the way",
 *    which is the one thing that turns a scroll into a ride.
 *
 *    IT IS NOT ACTED ON DIRECTLY, and that is the one place the policy and the
 *    mechanism part company on purpose. A placement is an INFERENCE — "nothing I can
 *    see caused this" — and `motionKindOf` hands it to the distance rule rather than
 *    to an unconditional bypass, because the inference was measured at two wrong
 *    frames in 466 during real flings and two were enough to undo the ceiling. The
 *    distance rule still lets a grab-and-release to a far point through, which is the
 *    placement anyone actually makes; a slow thumb drag is paced, which is the cost.
 *
 *  ...and OURS — the skip-to-desk button, the restart, the iris's jumps, the mount
 *    pin. These are not inferred at all, they are TOLD (`scroll-reset`'s beacon), so
 *    they are the ones honoured unconditionally.
 *
 *    THE RAIL'S TAP-TO-ADVANCE GLIDE IS DELIBERATELY NOT ONE OF THEM. It lands on the
 *    NEXT checkpoint, so the only beat it crosses is the destination's own, and a
 *    reader who asked for the next chapter should be shown that chapter's page rather
 *    than dropped past it. Announcing it was tried, and measured: r3f fires
 *    tap-to-advance from `onPointerMissed` at the end of a FLING over a spread, so the
 *    announcement would have handed a free teleport to every fling that ended on a
 *    checkpoint.
 *
 * WHY THIS SPLIT AND NOT "TELEPORTS ONLY VIA UI AFFORDANCES", which was the other
 * candidate and is simpler to state. It would have governed the scrollbar too, and
 * the scrollbar is not a lab affordance we can offer an alternative to — it is the
 * platform's own address bar for a document. A reader who has read the story and
 * drags the thumb to the desk is doing the same thing the skip button does, with
 * the control the OS gave them; answering it with eight seconds of paced beats
 * would be the lab overruling the platform. The demand was that no INPUT PATTERN
 * traverse the story faster than authored — a pattern is a shape made of force,
 * and a named position has no pattern to it.
 *
 * WHAT IT COSTS, stated plainly: on a desktop, a reader who wants to skim can drag
 * the scrollbar and the governor will not stop them. That is intended. On the
 * device the complaint came from there is no scrollbar to drag, and there is no
 * touch gesture that produces placement — which is why this policy answers the
 * demand where the demand was made.
 *
 * ---------------------------------------------------------------------------
 * THE MECHANISM: EPISODES, NOT FRAMES
 * ---------------------------------------------------------------------------
 * A frame cannot be classified on its own, because the frames that matter most —
 * momentum — carry no evidence. So motion is classified in EPISODES: a run of
 * document movement with no real rest in it. The episode is judged once, on the
 * frame it starts, by whether a travel input arrived recently enough to have caused
 * it; every later frame inherits that verdict until the document rests.
 *
 * The two thresholds are the whole tuning surface, and both are bounded by
 * measurement rather than taste:
 *  - INPUT_GRACE has to be longer than the lag between a wheel event and the scroll
 *    it produces, and shorter than the gap between two deliberate gestures.
 *  - REST_SECONDS has to be longer than a stalled frame inside a decaying fling
 *    (momentum rounds to zero pixels for a frame or two near its tail, and an
 *    episode that ended there would hand the rest of the fling to `placement` —
 *    the loophole, re-opened by an epsilon), and shorter than the pause between
 *    letting go of a scrollbar and grabbing it again.
 */

import type { MotionKind } from './arrival'

/**
 * How a run of document motion is being read. `null` means the document is at rest.
 * `'lab'` is the lab's own navigation, which is not an inference at all — it is told.
 */
export type ScrollProvenance = 'travel' | 'placement' | 'lab'

export type ProvenanceState = {
  /** The verdict on the motion episode in progress, or null between episodes. */
  episode: ScrollProvenance | null
  /** Seconds since the last travel input (wheel, finger drag, stepping key). */
  sinceInput: number
  /** Seconds the document has been still. An episode survives short stalls. */
  restFor: number
}

export const PROVENANCE_IDLE: ProvenanceState = Object.freeze({
  episode: null,
  sinceInput: Number.POSITIVE_INFINITY,
  restFor: Number.POSITIVE_INFINITY,
})

/**
 * How recently a travel input must have arrived to own a starting episode, in
 * seconds. A wheel event and the scroll it causes are at most a frame or two apart;
 * two deliberate gestures are never this close on either side of a full stop.
 */
export const INPUT_GRACE = 0.25

/**
 * How long the document must be still before its episode is over, in seconds.
 * About seven frames — past any stalled frame in a decaying fling, well under the
 * pause between two separate reaches for a scrollbar.
 */
export const REST_SECONDS = 0.12

/**
 * One frame of the classifier. Pure: same inputs, same output, no clock and no DOM.
 *
 * @param moved       Did the READER's own motion move the document this frame? The
 *                    driver subtracts its own writes before asking, which is what
 *                    keeps the carry and the leash from looking like a scrollbar.
 * @param travelInput Did a wheel / touchmove / stepping key arrive this frame?
 * @param labJump     Did the lab itself send the reader somewhere — skip-to-desk,
 *                    restart, the iris, the mount pin? It opens a 'lab' EPISODE and
 *                    forgets any pending input, so the whole of the motion that
 *                    follows is honoured rather than just the frame the button was
 *                    pressed on. Those jumps are single-frame today, so the episode
 *                    is belt and braces for them — but it is the shape a future
 *                    animated affordance would need, and an episode that outlives
 *                    its cause is exactly the trap `use-arrival-journey` keeps its
 *                    loop awake to avoid.
 */
export function stepProvenance(
  prev: ProvenanceState,
  moved: boolean,
  travelInput: boolean,
  dt: number,
  labJump = false
): ProvenanceState {
  const step = Math.max(dt, 0)
  if (labJump) return { episode: 'lab', sinceInput: Number.POSITIVE_INFINITY, restFor: 0 }
  const sinceInput = travelInput ? 0 : prev.sinceInput + step
  if (!moved) {
    const restFor = prev.restFor + step
    // The stall clause. An episode is not over because one frame reported nothing;
    // it is over when the document has actually come to rest.
    return { episode: restFor >= REST_SECONDS ? null : prev.episode, sinceInput, restFor }
  }
  const episode = prev.episode ?? (sinceInput <= INPUT_GRACE ? 'travel' : 'placement')
  return { episode, sinceInput, restFor: 0 }
}

/**
 * The classification `stepArrival` consumes — and the place the policy above meets
 * the measurement that tempered it.
 *
 * `'travel'` and `'lab'` pass through, because both are KNOWN: one is a gesture with
 * events behind it, the other is this lab moving the reader on purpose. Everything
 * else — an inferred placement, and the frames between episodes where there is
 * nothing to decide at all — becomes `'unknown'`, which is the distance rule and
 * therefore exactly the behaviour that predates this module.
 *
 * An inferred placement deliberately does NOT get an unconditional kind of its own.
 * `arrival.ts` carries the count that settled it: two stray placement frames in 466,
 * during real flings, were enough to undo the whole ceiling when placement teleported
 * on its own authority. The inference is good enough to inform a rule and not good
 * enough to be one.
 */
export function motionKindOf(state: ProvenanceState): MotionKind {
  if (state.episode === 'travel') return 'travel'
  if (state.episode === 'lab') return 'lab'
  return 'unknown'
}

/**
 * The keys that STEP the document rather than place the reader in it.
 *
 * Home and End are the deliberate omission: they name a position — the top, the
 * bottom — the way a scrollbar thumb does, and this lab's own restart and
 * skip-to-desk go to the same two places. Governing them would be governing the
 * keyboard's version of the affordance while leaving the button instant.
 */
const TRAVEL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  ' ',
  'Spacebar',
  'Space',
])

export function isTravelKey(key: string): boolean {
  return TRAVEL_KEYS.has(key)
}

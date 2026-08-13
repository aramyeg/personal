import { describe, expect, it } from 'vitest'
import {
  INPUT_GRACE,
  PROVENANCE_IDLE,
  REST_SECONDS,
  isTravelKey,
  motionKindOf,
  stepProvenance,
  type ProvenanceState,
} from '@/components/labs/small-world/scroll-provenance'

const FRAME = 1 / 60

/** Runs frames, each `[moved, travelInput]`, and returns every state. */
function run(
  frames: Array<[boolean, boolean]>,
  start: ProvenanceState = PROVENANCE_IDLE,
  dt = FRAME
): ProvenanceState[] {
  const out: ProvenanceState[] = []
  let state = start
  for (const [moved, input] of frames) {
    state = stepProvenance(state, moved, input, dt)
    out.push(state)
  }
  return out
}

const frames = (n: number, moved: boolean, input: boolean): Array<[boolean, boolean]> =>
  Array.from({ length: n }, () => [moved, input] as [boolean, boolean])

describe('scroll provenance', () => {
  it('reads motion that follows an input as travel, and governs it', () => {
    const states = run([[false, true], ...frames(5, true, true)])
    expect(states[states.length - 1].episode).toBe('travel')
    expect(motionKindOf(states[states.length - 1])).toBe('travel')
  })

  it('reads motion with no input behind it as placement — and hands it to the distance rule', () => {
    // A scrollbar thumb dragged from rest: the document moves and nothing else did.
    const states = run(frames(5, true, false))
    expect(states[states.length - 1].episode).toBe('placement')
    // NOT a kind of its own. The inference informs the rule and is not the rule:
    // measured at two wrong frames in 466 during real flings, and two were enough to
    // undo the ceiling when placement bypassed the distance test on its own.
    expect(motionKindOf(states[states.length - 1])).toBe('unknown')
  })

  it('leaves a frame with nothing happening to the distance rule', () => {
    // Not 'placement': there is nothing moving, so there is nothing to decide, and
    // the driver's behaviour on those frames stays what it always was.
    expect(motionKindOf(PROVENANCE_IDLE)).toBe('unknown')
  })

  /**
   * THE LOOPHOLE, AS A LAW. Momentum carries no events of its own — a fling's
   * longest and fastest stretch arrives with no touchmove behind it. Judged frame by
   * frame it would read as a scrollbar drag, and every fling in the lab would be
   * waved through as a teleport. That is the entire defect Task 126 exists to close,
   * so it is the test that matters most in this file.
   */
  it('keeps a fling classified as travel through the whole of its momentum', () => {
    const states = run([
      // the finger, moving
      ...frames(4, true, true),
      // …lifts, and the platform flings for two full seconds with no events at all
      ...frames(120, true, false),
    ])
    expect(states.every((s) => s.episode === 'travel')).toBe(true)
    expect(states.some((s) => motionKindOf(s) !== 'travel')).toBe(false)
  })

  it('survives a stalled frame in a decaying fling — an episode ends at rest, not at a gap', () => {
    // Momentum rounds to zero pixels for a frame or two near its tail. An episode
    // that ended there would hand the rest of the fling to `placement`, which is the
    // loophole re-opened by an epsilon.
    const stall = Math.floor((REST_SECONDS / FRAME) * 0.5)
    const states = run([
      ...frames(4, true, true),
      ...frames(30, true, false),
      ...frames(stall, false, false),
      ...frames(30, true, false),
    ])
    expect(states[states.length - 1].episode).toBe('travel')
  })

  it('ends the episode once the document has actually rested', () => {
    const rest = Math.ceil(REST_SECONDS / FRAME) + 1
    const states = run([...frames(4, true, true), ...frames(rest, false, false)])
    expect(states[states.length - 1].episode).toBeNull()
  })

  it('lets a reader who flings, stops, and then grabs the scrollbar jump', () => {
    // The pause has to outlast the INPUT grace, not merely the rest: a document
    // that starts moving again while the last touch is still within grace is far
    // more likely to be that gesture resuming than a hand arriving at a thumb.
    const pause = Math.ceil(INPUT_GRACE / FRAME) + 1
    const settled = run([...frames(4, true, true), ...frames(pause, false, false)])
    const after = run(frames(3, true, false), settled[settled.length - 1])
    expect(after[after.length - 1].episode).toBe('placement')
    expect(motionKindOf(after[after.length - 1])).toBe('unknown')
  })

  it('resolves the overlap conservatively: inside the grace, a resumed episode is travel', () => {
    // REST_SECONDS is shorter than INPUT_GRACE, so an episode can end while the last
    // input is still live. Which way that resolves is a real choice, and it is made
    // toward governing: over-governing costs a deliberate jump a moment of pace,
    // under-governing costs the whole story — the defect this module was written for.
    const gap = Math.ceil(REST_SECONDS / FRAME) + 1
    expect(gap * FRAME).toBeLessThan(INPUT_GRACE)
    const settled = run([...frames(4, true, true), ...frames(gap, false, false)])
    expect(settled[settled.length - 1].episode).toBeNull()
    const after = run(frames(3, true, false), settled[settled.length - 1])
    expect(after[after.length - 1].episode).toBe('travel')
  })

  it('gives an input its grace: motion that lands a few frames late is still travel', () => {
    const late = Math.floor((INPUT_GRACE / FRAME) * 0.5)
    const states = run([[false, true], ...frames(late, false, false), ...frames(3, true, false)])
    expect(states[states.length - 1].episode).toBe('travel')
  })

  it('lets the grace expire: an input long past cannot claim a fresh episode', () => {
    const stale = Math.ceil(INPUT_GRACE / FRAME) + Math.ceil(REST_SECONDS / FRAME) + 2
    const states = run([[false, true], ...frames(stale, false, false), ...frames(3, true, false)])
    expect(states[states.length - 1].episode).toBe('placement')
  })

  it('clamps a hidden tab’s giant frame rather than trusting it', () => {
    // A backgrounded tab resumes with one enormous dt. It must not be able to turn a
    // fling in progress into a placement just by having been away.
    const flung = run([...frames(4, true, true), ...frames(4, true, false)])
    const resumed = stepProvenance(flung[flung.length - 1], true, false, 30)
    expect(resumed.episode).toBe('travel')
  })

  it('lets the lab overrule everything — a glide is a placement for its whole length', () => {
    // A reader taps a rail dot while a fling of theirs is still rolling. Without the
    // override the glide would inherit the fling's travel episode and be paced
    // through every beat between here and the chapter they asked for.
    const flung = run([...frames(4, true, true), ...frames(4, true, false)])
    let state = stepProvenance(flung[flung.length - 1], true, false, FRAME, true)
    expect(state.episode).toBe('lab')
    // …and it stays the lab's for the whole of the smooth animation that follows,
    // which is what a glide needs and what an inferred placement does not get.
    for (const [moved, input] of frames(60, true, false)) {
      state = stepProvenance(state, moved, input, FRAME)
    }
    expect(motionKindOf(state)).toBe('lab')
  })

  /**
   * THE TRAP THIS MODULE SET, WRITTEN DOWN SO IT CANNOT BE RESET.
   *
   * An episode is not self-limiting: it ends only by being TOLD, frame after frame,
   * that the document is still. So a driver that stops calling this while an episode
   * is live freezes the verdict — and a frozen verdict is one gesture's classification
   * applied to every gesture after it.
   *
   * It is not hypothetical. The driver sleeps its loop on a still page, by design and
   * for good reasons; the mount's own `pinScrollToTop` opens a 'lab' episode; the loop
   * slept holding it, and every fling for the rest of the session inherited "the lab
   * sent you here" and was waved through as a jump. Whole-story traversal measured
   * 4.3 s with the rest of the governor complete and correct. `use-arrival-journey`
   * keeps ticking while `episode !== null` because of this, and this is the reason.
   */
  it('never expires on its own — only frames end an episode', () => {
    const live = run([...frames(4, true, true), ...frames(4, true, false)])
    const frozen = live[live.length - 1]
    expect(frozen.episode).toBe('travel')
    // Ten seconds of wall clock pass with no frames at all. The verdict is unchanged,
    // because nothing observed the rest.
    expect(frozen.episode).toBe('travel')
    // One frame that reports stillness for longer than the rest window ends it — but
    // only because a frame was run.
    expect(stepProvenance(frozen, false, false, REST_SECONDS * 2).episode).toBeNull()
  })

  describe('the keyboard', () => {
    it('treats stepping keys as travel', () => {
      for (const key of ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ']) {
        expect(isTravelKey(key)).toBe(true)
      }
    })

    it('leaves Home and End as placements — they name a position, like the thumb does', () => {
      expect(isTravelKey('Home')).toBe(false)
      expect(isTravelKey('End')).toBe(false)
    })

    it('ignores keys that do not scroll at all', () => {
      expect(isTravelKey('a')).toBe(false)
      expect(isTravelKey('Escape')).toBe(false)
    })
  })
})

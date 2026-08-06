import { describe, expect, it } from 'vitest'
import {
  ABSORB_MAX_LAG,
  ABSORB_MAX_SECONDS,
  ARM_FROM_RELEASE_LAG,
  CATCHUP_MAX_SPEED,
  HOLD_UNTIL_T,
  REVEAL_SECONDS,
  RETRACT_SECONDS,
  burstFromLatch,
  dwellChapterAt,
  initialArrival,
  stepArrival,
  stepBurstLatch,
  type ArrivalState,
  type BurstLatch,
} from '@/components/labs/small-world/arrival'
import {
  BURST_END,
  PANEL_END,
  TRAVEL_END,
  journeyStateAt,
  type RevealState,
} from '@/components/labs/small-world/journey-timeline'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'

const FRAME = 1 / 60
const SEG = 1 / CHAPTER_COUNT
/** progress at a local position inside chapter i's segment */
const at = (i: number, local: number) => (i + local) * SEG

/** Runs frames while `keepGoing`, feeding raw scroll from `scroll`. Returns every state. */
function drive(
  start: ArrivalState,
  {
    frames,
    scroll,
    reducedMotion = false,
    dt = FRAME,
  }: {
    frames: number
    scroll: (frame: number, prev: ArrivalState) => number
    reducedMotion?: boolean
    dt?: number
  }
): ArrivalState[] {
  const out: ArrivalState[] = []
  let state = start
  for (let f = 0; f < frames; f++) {
    state = stepArrival(state, scroll(f, state), dt, reducedMotion)
    out.push(state)
  }
  return out
}

/** Parks the journey one frame inside chapter `ch`'s dwell, arriving forward. */
function arriveAt(ch: number): { state: ArrivalState; raw: number } {
  const before = at(ch, TRAVEL_END - 0.03)
  const inside = at(ch, TRAVEL_END + 0.01)
  let state = initialArrival(before)
  state = stepArrival(state, before, FRAME)
  state = stepArrival(state, inside, FRAME)
  return { state, raw: inside }
}

describe('dwellChapterAt', () => {
  it('is null while travelling and names the chapter across its whole dwell', () => {
    expect(dwellChapterAt(at(2, TRAVEL_END / 2))).toBeNull()
    expect(dwellChapterAt(at(2, TRAVEL_END - 1e-6))).toBeNull()
    // (a hair past the boundary: `at` rounds the segment arithmetic, so the exact
    // edge lands either side of TRAVEL_END by ~1e-16 — the window is not a beat)
    expect(dwellChapterAt(at(2, TRAVEL_END + 1e-9))).toBe(2)
    expect(dwellChapterAt(at(2, (TRAVEL_END + PANEL_END) / 2))).toBe(2)
    // (same 1e-9 nudge, same reason, at the other edge: `at` rounds the segment arithmetic, so
    // the exact PANEL_END lands a float below it and reads as still inside the dwell)
    expect(dwellChapterAt(at(2, PANEL_END + 1e-9))).toBeNull()
  })

  it('opens exactly where rotation freezes, so absorption can never move the world', () => {
    // The renewal/tide proofs are functions of ROTATION. Absorption only ever runs
    // inside this window — and rotation is constant across all of it.
    const start = journeyStateAt(at(3, TRAVEL_END)).rotation
    for (const local of [
      TRAVEL_END,
      TRAVEL_END + (PANEL_END - TRAVEL_END) * 0.4,
      TRAVEL_END + (PANEL_END - TRAVEL_END) * 0.8,
      PANEL_END - 1e-6,
    ]) {
      expect(journeyStateAt(at(3, local)).rotation).toBeCloseTo(start, 12)
    }
  })
})

describe('the reveal clock', () => {
  it('rolls out to 1 with the wheel untouched, then parks there', () => {
    const { state, raw } = arriveAt(1)
    expect(state.reveal).not.toBeNull()
    expect(state.reveal!.chapter).toBe(1)

    // Not one further scroll event from here on.
    const frames = drive(state, { frames: 240, scroll: () => raw })
    const landed = frames.findIndex((s) => s.reveal?.t === 1)
    expect(landed).toBeGreaterThanOrEqual(0)
    expect((landed + 1) * FRAME).toBeCloseTo(REVEAL_SECONDS, 1)
    // …and it stays parked for as long as the visitor lingers.
    expect(frames[frames.length - 1].reveal!.t).toBe(1)
    expect(frames[frames.length - 1].reveal!.phase).toBe('in')
  })

  it('walks back out and ends when the visitor leaves, in either direction', () => {
    for (const exit of [at(1, PANEL_END + 0.02), at(1, TRAVEL_END - 0.02)]) {
      const { state, raw } = arriveAt(1)
      const parked = drive(state, { frames: 120, scroll: () => raw })
      const from = parked[parked.length - 1]
      expect(from.reveal!.t).toBe(1)

      const out = drive(from, { frames: 120, scroll: () => exit })
      const retracting = out.find((s) => s.reveal !== null && s.reveal.t < 1)!
      expect(retracting.reveal!.phase).toBe('out')
      expect(retracting.reveal!.chapter).toBe(1)
      const gone = out.findIndex((s) => s.reveal === null)
      expect(gone).toBeGreaterThanOrEqual(0)
      expect((gone + 1) * FRAME).toBeLessThanOrEqual(RETRACT_SECONDS + FRAME * 2)
    }
  })

  it('resumes rather than replays when scrubbing across the window edge', () => {
    const { state, raw } = arriveAt(1)
    const parked = drive(state, { frames: 120, scroll: () => raw }).pop()!
    const outside = at(1, TRAVEL_END - 0.02)
    let s = parked
    let prevT = 1
    // Thrash the boundary: 10 crossings, 4 frames each.
    for (let cross = 0; cross < 10; cross++) {
      const target = cross % 2 === 1 ? outside : raw
      for (const step of drive(s, { frames: 4, scroll: () => target })) {
        // The clock is CONTINUOUS across every crossing — a replaying one would
        // snap back to 0 on entry, which is exactly the flicker this rules out.
        expect(step.reveal).not.toBeNull()
        expect(Math.abs(step.reveal!.t - prevT)).toBeLessThanOrEqual(FRAME / RETRACT_SECONDS + 1e-9)
        prevT = step.reveal!.t
        s = step
      }
    }
    expect(s.absorbed).toBeLessThanOrEqual(ABSORB_MAX_SECONDS)
  })

  it('hands over cleanly when the next checkpoint arrives', () => {
    const { state, raw } = arriveAt(1)
    const parked = drive(state, { frames: 120, scroll: () => raw }).pop()!
    const next = drive(parked, { frames: 4, scroll: () => at(2, TRAVEL_END + 0.01) }).pop()!
    expect(next.reveal!.chapter).toBe(2)
    expect(next.reveal!.t).toBeLessThan(0.2)
  })
})

describe('scroll absorption', () => {
  it('holds the world still while the roll-out plays', () => {
    const { state, raw } = arriveAt(0)
    expect(state.mode).toBe('hold')
    // A steady, ordinary scroll right through the arrival.
    const held = drive(state, { frames: 40, scroll: (f) => raw + f * 0.0008 })
    for (const s of held) {
      if (s.mode !== 'hold') continue
      expect(s.progress).toBeCloseTo(state.progress, 10)
    }
  })

  it('never absorbs longer than the rail allows', () => {
    const { state, raw } = arriveAt(0)
    const run = drive(state, { frames: 400, scroll: (f) => raw + f * 0.0008 })
    const absorbing = run.filter((s) => s.mode === 'hold')
    expect(absorbing.length * FRAME).toBeLessThan(1.5)
    expect(Math.max(...run.map((s) => s.absorbed))).toBeLessThanOrEqual(ABSORB_MAX_SECONDS)
  })

  it('keeps the rail in wall-clock seconds when frames are slow', () => {
    // 8fps: the clock's own step is clamped so nothing jumps, but the hold must
    // still let go on time rather than riding the clamped frames past the rail.
    const slow = 1 / 8
    const { state, raw } = arriveAt(0)
    const run = drive(state, { frames: 40, scroll: () => raw, dt: slow })
    const holdSeconds = run.filter((s) => s.mode === 'hold').length * slow
    expect(holdSeconds).toBeLessThan(1.5)
    // …and the entrance still finishes, it is only unabsorbed for the tail.
    expect(run[run.length - 1].reveal!.t).toBe(1)
  })

  it('lets go immediately when a backgrounded tab comes back', () => {
    const { state, raw } = arriveAt(0)
    const resumed = stepArrival(state, raw, 45)
    // Straight back onto the finger — with the scroll unmoved there is nothing to unwind.
    expect(resumed.mode).toBe('pass')
    expect(resumed.reveal!.t).toBeLessThan(0.1) // the clock did not jump
  })

  it('bottoms out: a determined push always breaks through and keeps moving', () => {
    const { state, raw } = arriveAt(0)
    // A hard fling — 0.3 progress/second, several viewport-heights a second.
    const run = drive(state, { frames: 60, scroll: (f) => raw + f * 0.005 })
    const last = run[run.length - 1]
    const lastRaw = raw + 59 * 0.005
    expect(lastRaw - last.progress).toBeLessThanOrEqual(ABSORB_MAX_LAG + 1e-9)
    // It kept travelling: the band stretched, it did not lock.
    expect(last.progress).toBeGreaterThan(state.progress + 0.1)
  })

  it('lets backward scroll through 1:1 from the first frame and cancels the hold', () => {
    const { state, raw } = arriveAt(2)
    expect(state.mode).toBe('hold')
    const back = drive(state, { frames: 12, scroll: (f) => raw - (f + 1) * 0.002 })
    for (let f = 0; f < back.length; f++) {
      expect(back[f].progress).toBeCloseTo(raw - (f + 1) * 0.002, 10)
    }
    expect(back[back.length - 1].mode).toBe('pass')
  })

  it('unwinds onto the finger, and hands back exactly', () => {
    const { state, raw } = arriveAt(0)
    // Scroll during the reveal, then stop and let it land.
    const scrolled = drive(state, { frames: 40, scroll: (f) => raw + f * 0.0006 })
    const stopped = raw + 39 * 0.0006
    const after = drive(scrolled[scrolled.length - 1], { frames: 200, scroll: () => stopped })
    const back = after.find((s) => s.mode === 'pass')!
    expect(back.progress).toBe(stopped)
  })

  it('lets go at HOLD_UNTIL_T, not at a fully finished clock', () => {
    // The spread is visually seated well before t = 1; holding to 1 was ~0.4s of dead
    // stick per checkpoint. The clock still runs on to 1 — only absorption ends early.
    const { state, raw } = arriveAt(0)
    const run = drive(state, { frames: 240, scroll: () => raw })
    const lastHold = run.filter((s) => s.mode === 'hold').pop()!
    expect(lastHold.reveal!.t).toBeLessThan(HOLD_UNTIL_T + 2 / 60 / REVEAL_SECONDS)
    expect(run.filter((s) => s.mode === 'hold').length * FRAME).toBeLessThan(
      HOLD_UNTIL_T * REVEAL_SECONDS + 0.1
    )
    expect(run[run.length - 1].reveal!.t).toBe(1) // the entrance still completes
  })

  it('can still arm out of a nearly-converged release, so later checkpoints keep theirs', () => {
    // `unwind` uses max(track, closing), so a finger that keeps out-running the closing
    // rate parks the stretch on a fixed point that never reaches CATCHUP_SNAP. Without
    // this the machine would sit in `release` and silently spend no absorption again.
    const approaching = at(2, TRAVEL_END - 0.002)
    const stuck: ArrivalState = {
      ...initialArrival(approaching),
      mode: 'release',
      raw: approaching + ARM_FROM_RELEASE_LAG / 2,
    }
    const arrived = stepArrival(stuck, at(2, TRAVEL_END + 0.02), FRAME)
    expect(dwellChapterAt(arrived.progress)).toBe(2) // it did reach the stop this frame
    expect(arrived.mode).toBe('hold')
  })

  it('does not arm mid-catch-up, when the stretch is still real', () => {
    const busy: ArrivalState = {
      ...initialArrival(at(2, TRAVEL_END - 0.02)),
      mode: 'release',
      raw: at(2, TRAVEL_END - 0.02) + ABSORB_MAX_LAG,
    }
    expect(stepArrival(busy, at(2, TRAVEL_END + 0.01), FRAME).mode).toBe('release')
  })

  it('absorbs once per visit — edge thrash inside the drain time re-arms nothing', () => {
    const { state, raw } = arriveAt(1)
    const parked = drive(state, { frames: 120, scroll: () => raw }).pop()!
    const outside = at(1, TRAVEL_END - 0.02)
    let s = parked
    let holdFrames = 0
    let netOutside = 0
    for (let cross = 0; cross < 10; cross++) {
      const target = cross % 2 === 1 ? outside : raw
      for (const step of drive(s, { frames: 4, scroll: () => target })) {
        if (target === outside) netOutside += FRAME
        if (step.mode === 'hold') holdFrames++
        s = step
      }
    }
    expect(holdFrames).toBe(0)
    // Deliberately inside the drain window — that is the scope of this guarantee.
    expect(netOutside).toBeLessThan(RETRACT_SECONDS)
  })

  it('the real guarantee: no replay within ~RETRACT_SECONDS of NET time outside', () => {
    // Retract (0.42s) is 2.5x faster than reveal (1.05s), so ANY thrash symmetric in
    // frames drains `t` monotonically. Past the drain the reveal genuinely ends and the
    // next entry is a fresh arrival WITH a fresh absorption — which is correct, not a
    // bug: the visitor has spent that long away from the checkpoint.
    const { state, raw } = arriveAt(1)
    let s = drive(state, { frames: 120, scroll: () => raw }).pop()!
    const outside = at(1, TRAVEL_END - 0.02)
    let netOutside = 0
    let drainedAt: number | null = null
    for (let cross = 0; cross < 60 && drainedAt === null; cross++) {
      const target = cross % 2 === 1 ? outside : raw
      for (const step of drive(s, { frames: 3, scroll: () => target })) {
        if (target === outside) netOutside += FRAME
        if (step.reveal === null && drainedAt === null) drainedAt = netOutside
        s = step
      }
    }
    expect(drainedAt).not.toBeNull()
    expect(drainedAt!).toBeGreaterThanOrEqual(RETRACT_SECONDS - FRAME * 2)
  })

  it('re-arms only after a genuine exit — coming back later absorbs again', () => {
    const { state, raw } = arriveAt(1)
    const parked = drive(state, { frames: 120, scroll: () => raw }).pop()!
    // Leave for long enough that the reveal fully retracts: the visit is over.
    const away = drive(parked, { frames: 90, scroll: () => at(1, TRAVEL_END / 2) }).pop()!
    expect(away.reveal).toBeNull()
    expect(away.held).toBe(false)
    const again = drive(away, {
      frames: 2,
      scroll: (f) => (f === 0 ? at(1, TRAVEL_END - 0.01) : at(1, TRAVEL_END + 0.01)),
    }).pop()!
    expect(again.mode).toBe('hold')
    expect(again.reveal!.t).toBeLessThan(0.1)
  })

  it('passes a teleport straight through (scrollbar drag, End key)', () => {
    let s = initialArrival(0)
    s = stepArrival(s, 0.9, FRAME)
    expect(s.mode).toBe('pass')
    expect(s.progress).toBe(0.9)
  })

  it('treats one chunky wheel notch as a scroll, not a jump', () => {
    // Measured in the browser: a 320px notch on a 12,060px track can land inside a
    // single 16ms frame — 19,000px/s instantaneous. Read as a teleport it skipped
    // absorption entirely and the checkpoint blew past, which is the exact bug the
    // visitor reported. One notch is 0.0265 progress here.
    const notch = 320 / 12060
    const before = at(3, TRAVEL_END) - notch / 2
    let s = initialArrival(before - notch)
    s = stepArrival(s, before, FRAME)
    s = stepArrival(s, before + notch, FRAME)
    expect(s.mode).toBe('hold')
    expect(s.reveal!.chapter).toBe(3)
  })

  it('reveals instantly and absorbs nothing under reduced motion', () => {
    const before = at(4, TRAVEL_END - 0.03)
    const inside = at(4, TRAVEL_END + 0.01)
    let s = initialArrival(before)
    s = stepArrival(s, before, FRAME, true)
    s = stepArrival(s, inside, FRAME, true)
    expect(s.reveal).toEqual({ chapter: 4, t: 1, phase: 'in' })
    expect(s.mode).toBe('pass')
    const on = drive(s, { frames: 20, scroll: (f) => inside + f * 0.001, reducedMotion: true })
    for (let f = 0; f < on.length; f++) {
      expect(on[f].progress).toBeCloseTo(inside + f * 0.001, 10)
    }
  })
})

// R1/R2 — the "!" fires the girl's celebrate one-shot on its rising edge, and T52 hands
// the mixer straight back if she still reads as travelling. Her locomotion comes off the
// DAMPED rotation, so the edge has to land on the damped timeline, not the undamped clock
// that starts up to v/lambda of a segment earlier.
describe('the burst latch (the girl\'s discovery beat)', () => {
  const rising = (chapter: number, t: number): RevealState => ({ chapter, t, phase: 'in' })

  it('holds the "!" while the clock runs but the damped girl is still walking', () => {
    // Clock already a third of the way in; damped timeline has not reached the stop.
    const stillWalking = at(2, TRAVEL_END - 0.08)
    const latch = stepBurstLatch(null, rising(2, 0.33), stillWalking, FRAME)
    expect(latch).toBeNull()
    expect(burstFromLatch(latch)).toBeNull()
  })

  it('fires on the frame the damped rotation clamps — so the next frame is exactly idle', () => {
    const planted = at(2, TRAVEL_END + 1e-9)
    const latch = stepBurstLatch(null, rising(2, 0.33), planted, FRAME)
    expect(burstFromLatch(latch)).toBe(0)
    // The reason this frame is the right one: rotation is already at the chapter's stop,
    // so the NEXT frame's rotation delta is exactly 0 and she settles to idle before
    // T52's yield is evaluated again. Anything earlier fires while she is still moving.
    const deeper = at(2, (TRAVEL_END + PANEL_END) / 2)
    expect(journeyStateAt(deeper).rotation).toBe(journeyStateAt(planted).rotation)
  })

  it('runs on the wall clock from there — the pop plays with no scrolling at all', () => {
    const planted = at(2, TRAVEL_END + 0.01)
    let latch = stepBurstLatch(null, rising(2, 0.2), planted, FRAME)
    const seen: number[] = []
    for (let f = 0; f < 40; f++) {
      // progress frozen, clock frozen — only wall time moves
      latch = stepBurstLatch(latch, rising(2, 0.2), planted, FRAME)
      const b = burstFromLatch(latch)
      if (b !== null) seen.push(b)
    }
    expect(seen.length).toBeGreaterThan(20)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1])
    expect(burstFromLatch(latch)).toBeNull() // one pop, then done
  })

  it('gives exactly ONE rising edge per arrival, even while two timelines disagree', () => {
    // A teleport: the undamped clock is already running while the damped value is still
    // sliding in. Previously this produced two edges and two celebrate calls.
    const planted = at(3, TRAVEL_END + 0.01)
    let latch: BurstLatch = null
    let prev: number | null = null
    let edges = 0
    const damped = [
      at(3, TRAVEL_END * 0.3),
      at(3, TRAVEL_END * 0.6),
      at(3, TRAVEL_END - 0.01),
      planted,
      at(3, (TRAVEL_END + PANEL_END) / 2),
      at(3, PANEL_END - 0.01),
    ]
    for (const d of damped) {
      for (let f = 0; f < 6; f++) {
        latch = stepBurstLatch(latch, rising(3, 0.5), d, FRAME)
        const b = burstFromLatch(latch)
        if (prev === null && b !== null) edges++
        prev = b
      }
    }
    expect(edges).toBe(1)
  })

  it('never re-fires on the way out', () => {
    const planted = at(2, TRAVEL_END + 0.01)
    const latch = stepBurstLatch(null, { chapter: 2, t: 0.3, phase: 'out' }, planted, FRAME)
    expect(latch).toBeNull()
  })

  it('gives the next checkpoint its own edge when one preempts another', () => {
    const first = stepBurstLatch(null, rising(1, 0.4), at(1, (TRAVEL_END + PANEL_END) / 2), FRAME)
    expect(first?.chapter).toBe(1)
    const preempted = stepBurstLatch(first, rising(4, 0), at(4, TRAVEL_END + 0.01), FRAME)
    expect(preempted?.chapter).toBe(4)
    expect(burstFromLatch(preempted)).toBe(0) // a fresh pop for a genuinely new discovery
  })

  it('falls back to the original scroll window when no clock is driving', () => {
    // journeyStateAt without an override keeps the pre-Task-54 behaviour intact.
    const b = journeyStateAt(at(1, (TRAVEL_END + BURST_END) / 2)).burst
    expect(b).toBeGreaterThan(0)
    expect(b).toBeLessThan(1)
  })

  it('uses a supplied override verbatim, null included', () => {
    const dwell = at(2, 0.75)
    expect(journeyStateAt(dwell, undefined, rising(2, 0.1), null).burst).toBeNull()
    expect(journeyStateAt(dwell, undefined, rising(2, 0.1), 0.5).burst).toBe(0.5)
  })
})

describe('renewal safety — the journey never outruns the finger', () => {
  const scenarios: Record<string, (f: number) => number> = {
    'steady scroll': (f) => f * 0.0006,
    'hard fling': (f) => f * 0.005,
    'stop dead at the checkpoint': (f) => Math.min(f * 0.0012, at(0, TRAVEL_END + 0.02)),
    'scrub back and forth': (f) => at(0, 0.5) + 0.02 * Math.sin(f / 9),
  }

  for (const [name, scroll] of Object.entries(scenarios)) {
    it(`${name}: rotation stays monotone in journey order and never steps faster than the input`, () => {
      const run = drive(initialArrival(0), { frames: 600, scroll })
      let prev = initialArrival(0)
      for (let f = 0; f < run.length; f++) {
        const raw = scroll(f)
        const step = Math.abs(run[f].progress - prev.progress)
        const input = Math.abs(raw - prev.raw)
        // Every frame moves either no further than the finger did, or no further
        // than the capped unwind — never faster than a real hand scroll.
        expect(step).toBeLessThanOrEqual(Math.max(input, CATCHUP_MAX_SPEED * FRAME) + 1e-9)
        // …and it never runs ahead of where the visitor actually scrolled.
        expect(run[f].progress).toBeLessThanOrEqual(Math.max(raw, prev.progress) + 1e-9)
        prev = run[f]
      }
    })
  }

  it('reaches the same rotation as an unabsorbed scrub of the same scroll', () => {
    const scroll = (f: number) => Math.min(1, f * 0.0012)
    const run = drive(initialArrival(0), { frames: 1200, scroll })
    const settled = run[run.length - 1]
    expect(settled.mode).toBe('pass')
    expect(journeyStateAt(settled.progress).rotation).toBeCloseTo(
      journeyStateAt(scroll(1199)).rotation,
      10
    )
  })
})

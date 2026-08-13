import { describe, expect, it } from 'vitest'
import {
  GOVERNED_MAX_SPEED,
  STEP_MAX_SECONDS,
  initialArrival,
  paceCapAt,
  stepArrival,
  type ArrivalState,
} from '@/components/labs/small-world/arrival'
import {
  CARRY_IDLE,
  CARRY_IDLE_SECONDS,
  carryBusy,
  stepCarry,
  type CarryState,
} from '@/components/labs/small-world/beat-carry'
import {
  BEAT_WINDOWS,
  EXIT_JUMP_WINDOW,
  beatPaceOf,
  beatWindowAt,
} from '@/components/labs/small-world/beat-windows'
import { TRACK_END } from '@/components/labs/small-world/ending-timeline'
import {
  GIRL_JUMP_END,
  GIRL_JUMP_START,
  GIRL_TRANSFER,
} from '@/components/labs/small-world/scene/girl-exit'

const FRAME = 1 / 60

type Frame = { carry: CarryState; arrival: ArrivalState; raw: number }

/**
 * The driver, reproduced: the reader moves the document, the carry writes to the
 * same document, the anchor is what the document ended the frame at, and the
 * arrival machine reads it. `user(f)` is the progress the READER moved on frame f.
 */
function run({
  start,
  frames,
  user = () => 0,
  reduced = false,
  dt = FRAME,
}: {
  start: number
  frames: number
  user?: (frame: number) => number
  reduced?: boolean
  dt?: number
}): Frame[] {
  let carry = CARRY_IDLE
  let arrival = initialArrival(start)
  let raw = start
  let anchor: number | null = null
  const log: Frame[] = []
  for (let f = 0; f < frames; f++) {
    raw = Math.min(TRACK_END, Math.max(0, raw + user(f)))
    const input = anchor === null ? 0 : raw - anchor
    carry = stepCarry(carry, arrival.progress, raw, input, dt, reduced)
    if (carry.target !== null) raw = carry.target
    anchor = raw
    arrival = stepArrival(arrival, raw, dt, reduced)
    log.push({ carry, arrival, raw })
  }
  return log
}

/** A reader who scrolls into the window and stops dead — the reported defect. */
const strandedMidLeap = (extra = 0) =>
  run({ start: EXIT_JUMP_WINDOW.start - 1e-4, frames: 240, user: (f) => (f === 0 ? 1e-4 + extra : 0) })

describe('beat windows are authored data about the exit', () => {
  it('places the exit window on the flight the exit module stages', () => {
    // Derived from girl-exit, never restated: the window is the leap itself.
    expect(EXIT_JUMP_WINDOW.start).toBeLessThan(EXIT_JUMP_WINDOW.end)
    expect(EXIT_JUMP_WINDOW.start).toBeGreaterThan(1)
    expect(EXIT_JUMP_WINDOW.end).toBeLessThan(TRACK_END)
    // The ending's t maps linearly onto progress, so ordering in one is ordering in
    // the other: takeoff, the last airborne frame, then the transfer that closes it.
    expect(GIRL_JUMP_START).toBeLessThan(GIRL_JUMP_END)
    expect(GIRL_JUMP_END).toBeLessThanOrEqual(GIRL_TRANSFER)
    // T121b's shipped-page sweep found her airborne across ~1.04–1.06; the window
    // has to contain that or it is pacing something else.
    expect(EXIT_JUMP_WINDOW.start).toBeLessThan(1.046)
    expect(EXIT_JUMP_WINDOW.end).toBeGreaterThan(1.059)
  })

  it('keeps every window half-open, ordered and disjoint', () => {
    for (const w of BEAT_WINDOWS) {
      expect(w.end).toBeGreaterThan(w.start)
      expect(w.seconds).toBeGreaterThan(0)
      expect(beatWindowAt(w.start)).toBe(w)
      // The carry's own destination must fall OUTSIDE the window, or it would run twice.
      expect(beatWindowAt(w.end)).not.toBe(w)
    }
    for (let i = 1; i < BEAT_WINDOWS.length; i++) {
      expect(BEAT_WINDOWS[i].start).toBeGreaterThanOrEqual(BEAT_WINDOWS[i - 1].end)
    }
  })

  it('never authors a pace faster than a served reader scrolls, or than the governor allows', () => {
    for (const w of BEAT_WINDOWS) {
      const pace = beatPaceOf(w)
      expect(pace).toBeGreaterThan(0)
      // The floor may not outrun the reading speed the ceiling is tuned to serve —
      // above that it stops being a floor and becomes a ride.
      expect(pace).toBeLessThanOrEqual(GOVERNED_MAX_SPEED)
      // ...and it may not outrun the ceiling itself anywhere it applies, or the
      // carry would build governor debt the reader never asked for. Sampled across
      // the window because the cap is a function of position.
      for (let i = 0; i <= 20; i++) {
        const p = w.start + ((w.end - w.start) * i) / 20
        expect(pace).toBeLessThanOrEqual(paceCapAt(p))
      }
    }
  })
})

describe('the floor carries a stranded beat to its end', () => {
  it('finishes the leap when the reader stops dead inside it', () => {
    const log = strandedMidLeap()
    expect(log[log.length - 1].arrival.progress).toBeCloseTo(EXIT_JUMP_WINDOW.end, 6)
    expect(beatWindowAt(log[log.length - 1].arrival.progress)).toBeNull()
  })

  it('takes about the authored seconds, and the grace before it starts', () => {
    const log = strandedMidLeap()
    const done = log.findIndex((f) => f.arrival.progress >= EXIT_JUMP_WINDOW.end - 1e-9)
    expect(done).toBeGreaterThanOrEqual(0)
    const seconds = (done + 1) * FRAME
    const expected = EXIT_JUMP_WINDOW.seconds + CARRY_IDLE_SECONDS
    // Frame-quantised on both ends; the claim is the authored duration, not a frame count.
    expect(seconds).toBeGreaterThan(expected - 3 * FRAME)
    expect(seconds).toBeLessThan(expected + 3 * FRAME)
  })

  it('stays still until the grace has elapsed — bursty input is not a pause', () => {
    const graceFrames = Math.ceil(CARRY_IDLE_SECONDS / FRAME)
    const log = strandedMidLeap()
    for (let f = 0; f < graceFrames - 1; f++) expect(log[f].carry.target).toBeNull()
    expect(log[graceFrames].carry.target).not.toBeNull()
  })

  it('never advances faster than the authored pace, on any frame', () => {
    const log = strandedMidLeap()
    const pace = beatPaceOf(EXIT_JUMP_WINDOW)
    for (let f = 1; f < log.length; f++) {
      const step = log[f].arrival.progress - log[f - 1].arrival.progress
      expect(step).toBeGreaterThanOrEqual(0)
      expect(step).toBeLessThanOrEqual(pace * FRAME + 1e-9)
    }
  })

  it('never carries past the window, however long the reader waits', () => {
    const log = run({ start: EXIT_JUMP_WINDOW.start, frames: 600 })
    for (const f of log) expect(f.raw).toBeLessThanOrEqual(EXIT_JUMP_WINDOW.end + 1e-12)
    expect(carryBusy(log[log.length - 1].carry)).toBe(false)
  })

  it('lets the driver loop sleep outside a window and once the beat is done', () => {
    expect(carryBusy(CARRY_IDLE)).toBe(false)
    const outside = run({ start: EXIT_JUMP_WINDOW.end + 0.01, frames: 30 })
    for (const f of outside) expect(carryBusy(f.carry)).toBe(false)
    const finished = strandedMidLeap()
    expect(carryBusy(finished[finished.length - 1].carry)).toBe(false)
  })
})

describe('the reader always wins', () => {
  it('hands the frame back to forward input, and re-seeds from where they left it', () => {
    // Carry for a while, then the reader pushes forward on one frame.
    const push = 0.004
    const log = run({
      start: EXIT_JUMP_WINDOW.start,
      frames: 150,
      user: (f) => (f === 30 ? push : 0),
    })
    expect(log[30].carry.target).toBeNull()
    // The frame the reader owns moves by exactly their own input and nothing else —
    // the carry is never ADDED to a scroll.
    expect(log[30].raw - log[29].raw).toBeCloseTo(push, 9)
    // ...and the grace starts over, so the floor does not answer a scroll instantly.
    expect(log[31].carry.target).toBeNull()
    // NO POP on the way back in. A carry that resumed from its stale pre-push target
    // would write a position BEHIND the reader's; every frame after the push moves
    // forward, and by no more than the authored pace.
    const pace = beatPaceOf(EXIT_JUMP_WINDOW)
    for (let f = 31; f < log.length; f++) {
      const step = log[f].raw - log[f - 1].raw
      expect(step).toBeGreaterThanOrEqual(0)
      expect(step).toBeLessThanOrEqual(pace * FRAME + 1e-9)
    }
    // ...and it does resume: the beat still finishes.
    expect(log[log.length - 1].arrival.progress).toBeCloseTo(EXIT_JUMP_WINDOW.end, 6)
  })

  it('cancels on reverse and stays cancelled while the reader rests', () => {
    const log = run({
      start: EXIT_JUMP_WINDOW.start + 0.005,
      frames: 180,
      user: (f) => (f === 30 ? -0.002 : 0),
    })
    expect(log[30].carry.armed).toBe(false)
    const parked = log[40].raw
    for (let f = 40; f < log.length; f++) expect(log[f].raw).toBeCloseTo(parked, 9)
  })

  it('re-arms on the reader’s own forward push after a reverse', () => {
    const log = run({
      start: EXIT_JUMP_WINDOW.start + 0.005,
      frames: 180,
      user: (f) => (f === 30 ? -0.002 : f === 90 ? 0.0005 : 0),
    })
    expect(log[89].carry.armed).toBe(false)
    expect(log[90].carry.armed).toBe(true)
    expect(log[log.length - 1].raw).toBeCloseTo(EXIT_JUMP_WINDOW.end, 6)
  })

  it('never arms for a reader scrubbing backward into the beat', () => {
    const log = run({
      start: EXIT_JUMP_WINDOW.end + 0.002,
      frames: 120,
      user: (f) => (f < 10 ? -0.0005 : 0),
    })
    expect(beatWindowAt(log[log.length - 1].arrival.progress)).not.toBeNull()
    for (const f of log) expect(f.carry.target).toBeNull()
  })

  it('never moves the document backward', () => {
    const log = run({ start: EXIT_JUMP_WINDOW.start, frames: 120 })
    for (let f = 1; f < log.length; f++) expect(log[f].raw).toBeGreaterThanOrEqual(log[f - 1].raw)
  })
})

describe('the contracts the governor already had', () => {
  it('gives reduced motion a cut, not a ride', () => {
    const log = run({ start: EXIT_JUMP_WINDOW.start, frames: 120, reduced: true })
    const driving = log.filter((f) => f.carry.target !== null)
    // One frame of it: a boundary, arrived at instantly. Never a per-frame animation.
    expect(driving).toHaveLength(1)
    expect(driving[0].carry.target).toBe(EXIT_JUMP_WINDOW.end)
    expect(log[log.length - 1].arrival.progress).toBeCloseTo(EXIT_JUMP_WINDOW.end, 9)
    // ...and a reduced-motion reader is never left mid-beat.
    expect(beatWindowAt(log[log.length - 1].arrival.progress)).toBeNull()
  })

  it('clamps the step so a backgrounded tab cannot fast-forward the beat on return', () => {
    const pace = beatPaceOf(EXIT_JUMP_WINDOW)
    // The frame a tab returns on carries the whole hidden interval in its dt.
    const carried = stepCarry(
      { beat: EXIT_JUMP_WINDOW.id, armed: true, idle: 10, target: EXIT_JUMP_WINDOW.start },
      EXIT_JUMP_WINDOW.start,
      EXIT_JUMP_WINDOW.start,
      0,
      30,
    )
    expect(carried.target).not.toBeNull()
    expect((carried.target as number) - EXIT_JUMP_WINDOW.start).toBeLessThanOrEqual(
      pace * STEP_MAX_SECONDS + 1e-12
    )
  })

  it('leaves everything outside a window exactly as scroll-pure as it was', () => {
    const log = run({
      start: 0.5,
      frames: 120,
      user: (f) => (f < 20 ? 0.001 : 0),
    })
    for (const f of log) {
      expect(f.carry).toBe(CARRY_IDLE)
      expect(f.carry.target).toBeNull()
    }
    // The reader stopped at 0.52 and the world stayed there.
    expect(log[log.length - 1].raw).toBeCloseTo(0.52, 9)
  })
})

'use client'
import { useEffect, useRef } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import { initialArrival, isGoverned, stepArrival, type ArrivalState } from './arrival'
import { CARRY_IDLE, carryBusy, carryInputEps, stepCarry, type CarryState } from './beat-carry'
import { TRACK_END, trackOffsetFor, trackProgressAt } from './ending-timeline'
import { pinScrollTo } from './scroll-reset'

/**
 * The journey's input pipeline: document scroll in, journey progress + the arrival
 * reveal clock out (Round 15, Task 54).
 *
 * Everything downstream reads `progressRef` exactly as it always did — the only
 * change is that this ref is now the ABSORBED progress rather than raw scroll, so a
 * checkpoint entrance can hold the world still for a beat while it rolls out. The
 * numbers, the state machine and the reasoning all live in arrival.ts; this hook is
 * only the wiring: measure the track, run a frame loop while the clock or the
 * rubber band is busy, and let DOM consumers subscribe to those frames (they cannot
 * key off scroll events any more — an arrival animates with no scroll at all).
 *
 * The loop is idle whenever the journey is simply on the finger, so a still page
 * costs nothing.
 */
export type ArrivalJourney = {
  /** Journey progress every consumer renders from (absorbed). Domain [0, TRACK_END]. */
  progressRef: MutableRefObject<number>
  /** Unfiltered scroll progress — for affordances that must track the finger even while absorbing. */
  rawProgressRef: MutableRefObject<number>
  arrivalRef: MutableRefObject<ArrivalState>
  /** Called once per driver frame. Returns an unsubscribe. */
  subscribe: (listener: () => void) => () => void
}

export function useArrivalJourney(
  trackRef: RefObject<HTMLElement | null>,
  active: boolean
): ArrivalJourney {
  const progressRef = useRef(0)
  const rawProgressRef = useRef(0)
  const arrivalRef = useRef<ArrivalState>(initialArrival(0))
  const listeners = useRef(new Set<() => void>())
  const apiRef = useRef<ArrivalJourney | null>(null)

  if (apiRef.current === null) {
    apiRef.current = {
      progressRef,
      rawProgressRef,
      arrivalRef,
      subscribe: (listener) => {
        listeners.current.add(listener)
        return () => {
          listeners.current.delete(listener)
        }
      },
    }
  }

  useEffect(() => {
    if (!active) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let raf = 0
    let last = 0
    let carry: CarryState = CARRY_IDLE
    /**
     * The scroll position as of the end of the last driver frame, the carry's own
     * write included. Any difference the next frame measures against it is THE
     * READER, which is the one thing `stepCarry` cannot work out for itself — a
     * carry that mistook its own writes for input would cancel itself every frame,
     * and one that mistook the reader's for its own would fight them.
     *
     * Null means "no reference yet", not "no motion": the first frame of a session
     * (and the first after the loop has slept) reports no input, and the frames
     * either side of a sleep report the whole gap, which is exactly the reader's
     * own motion over it.
     */
    let carryAnchor: number | null = null

    // The track's domain is [0, TRACK_END]: the journey occupies [0, 1] and the ending
    // the rest (Task 63 — `trackProgressAt` owns the mapping and why it is a ratio).
    // Everything downstream of `journeyStateAt` clamps at 1 and is therefore frozen for
    // the whole ending, by construction.
    const readRaw = () => {
      const el = trackRef.current
      if (!el) return rawProgressRef.current
      return trackProgressAt(window.scrollY, el.scrollHeight - window.innerHeight)
    }

    /** The scrollable height `readRaw` measures against — the carry writes through its inverse. */
    const readTotal = () => {
      const el = trackRef.current
      return el ? el.scrollHeight - window.innerHeight : 0
    }

    // A driver frame is owed whenever anything is still moving on its own: the
    // reveal clock, the rubber band — and now the pace governor's debt, which can
    // outlive both (Task 109). `mode !== 'pass'` covers it, because a governed
    // frame hands its lag to the release, but the equality is asserted rather than
    // assumed: a debt with a sleeping loop is a world frozen mid-beat.
    // ...and now the baseline carry too (Task 125), which is the one source of
    // motion that runs with the scroll perfectly still — a floor whose loop has
    // gone to sleep is a beat that never finishes, which is the defect it exists
    // to remove. `carryBusy` goes false the moment a reverse disarms the beat, so
    // resting inside a window the reader has taken charge of costs nothing.
    const busy = () =>
      carryBusy(carry) ||
      arrivalRef.current.mode !== 'pass' ||
      arrivalRef.current.reveal !== null ||
      arrivalRef.current.progress !== arrivalRef.current.raw

    const tick = (now: number) => {
      raf = 0
      // A restarted loop assumes one nominal frame rather than 0, so the first step
      // after an idle stretch still measures input speed against a real interval.
      const dt = last === 0 ? 1 / 60 : (now - last) / 1000
      last = now

      // THE BASELINE CARRY (Task 125) runs FIRST, because what it produces is
      // scroll. It moves the document — through `pinScrollTo`, the lab's one
      // authority for a jump that must not animate — and `stepArrival` below then
      // reads that document exactly as it reads a finger's. Nothing downstream can
      // tell the two apart, which is the whole point: there is no second timeline
      // for a reader to disagree with, and no lead for the scrollbar to hide.
      //
      // `trackOffsetFor` is the algebraic inverse of `readRaw` above, and is used
      // WITHOUT the track's own offset for that reason: `readRaw` measures against
      // the document origin, so the carry must write against it too, or every frame
      // would land somewhere the next read disagreed with.
      const total = readTotal()
      const carryRaw = readRaw()
      carry = stepCarry(
        carry,
        arrivalRef.current.progress,
        carryRaw,
        carryAnchor === null ? 0 : carryRaw - carryAnchor,
        dt,
        reduced.matches,
        carryInputEps(TRACK_END, total)
      )
      if (carry.target !== null && total > 0) pinScrollTo(trackOffsetFor(carry.target, total))
      // Re-MEASURED rather than assumed: the anchor has to be the position the
      // document actually took, or the browser's own rounding would read as the
      // reader on the next frame and cancel the carry it caused.
      rawProgressRef.current = readRaw()
      carryAnchor = rawProgressRef.current

      const next = stepArrival(arrivalRef.current, rawProgressRef.current, dt, reduced.matches)
      arrivalRef.current = next
      progressRef.current = next.progress
      for (const listener of listeners.current) listener()
      if (busy()) schedule()
      else last = 0
    }

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }

    const onScroll = () => {
      rawProgressRef.current = readRaw()
      // While the journey is on the finger, keep the ref exactly as immediate as it
      // was before this hook existed — panels must not lag a frame behind a scroll.
      //
      // NOT INSIDE A CHECKPOINT (Task 109). This shortcut is a copy of the 'pass'
      // branch of `stepArrival`, and 'pass' stopped meaning "progress is raw" the
      // moment the pace governor could shape it. Left ungated it wrote the raw
      // scroll straight past the cap on every scroll event, which is every frame of
      // a fling: the governor would have been a no-op for exactly the input it
      // exists for.
      if (
        arrivalRef.current.mode === 'pass' &&
        !isGoverned(arrivalRef.current.progress, reduced.matches)
      ) {
        progressRef.current = rawProgressRef.current
      }
      schedule()
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [active, trackRef])

  return apiRef.current
}

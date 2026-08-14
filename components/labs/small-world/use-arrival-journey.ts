'use client'
import { useEffect, useRef } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import {
  governedEntryBetween,
  initialArrival,
  isGoverned,
  leashTargetFor,
  paceCapAt,
  stepArrival,
  type ArrivalState,
} from './arrival'
import { CARRY_IDLE, carryBusy, carryInputEps, stepCarry, type CarryState } from './beat-carry'
import { TRACK_END, trackOffsetFor, trackProgressAt } from './ending-timeline'
import {
  FAST_FORWARD_IDLE,
  fastForwardBusy,
  stepFastForward,
  type FastForwardState,
} from './fast-forward'
import {
  PROVENANCE_IDLE,
  isTravelKey,
  motionKindOf,
  stepProvenance,
  type ProvenanceState,
} from './scroll-provenance'
import { pinScrollTo, takePendingJump } from './scroll-reset'

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
     * THE FAST-FORWARD's arming clock (Task 129, R2). It sits alongside the carry
     * rather than inside `stepArrival` for the same reason the carry does: what it
     * watches is the READER — how far they have pushed the document past the world,
     * and for how long — and that is a property of the driver's own measurements, not
     * of the pure step function. `stepArrival` is told the verdict and nothing else.
     */
    let ff: FastForwardState = FAST_FORWARD_IDLE
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
    /**
     * WHO IS MOVING THE DOCUMENT (Task 126). The same `carryAnchor` that tells the
     * carry what the reader did tells this what KIND of thing the reader did — the
     * anchor is re-read after every write of ours, so what it measures is always
     * the reader's own motion and never the lab's. See `scroll-provenance.ts` for
     * the policy; this is only the wiring.
     */
    let provenance: ProvenanceState = PROVENANCE_IDLE
    /** Set by the listeners below, consumed and cleared by the next driver frame. */
    let travelInput = false

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
    // ...and now a live motion EPISODE too (Task 126), which is the same lesson a
    // third time. `stepProvenance` only advances its clocks on a driver frame, so a
    // classifier with a sleeping loop is an episode that never ends — and an episode
    // that never ends is a verdict about one gesture applied to every gesture after
    // it. Measured, and it is not a corner: the mount's own `pinScrollToTop` opens a
    // 'lab' episode, the loop then sleeps on a still page, and every fling for the
    // rest of the session inherited that verdict and was waved through as a jump.
    // Whole-story traversal read 4.3 s with the governor otherwise complete.
    //
    // The cost is seven frames of tail after the document stops, which is what
    // REST_SECONDS is; during the motion itself the scroll events were scheduling
    // these frames anyway.
    // ...and now a live FAST-FORWARD too (Task 129), which is the same lesson a
    // fourth time. Its glide runs at a multiple of the row's rate and finishes on the
    // span's end; with the loop asleep it would stop wherever the last scroll event
    // left it, and the reader who asked to be taken to the end of the note would be
    // parked in the middle of it instead. `fastForwardBusy` goes false the moment the
    // arming condition lapses, so nothing here spins on a reader who has stopped.
    const busy = () =>
      carryBusy(carry) ||
      fastForwardBusy(ff) ||
      provenance.episode !== null ||
      arrivalRef.current.mode !== 'pass' ||
      arrivalRef.current.reveal !== null ||
      arrivalRef.current.progress !== arrivalRef.current.raw

    const tick = (now: number) => {
      raf = 0
      // A restarted loop assumes one nominal frame rather than 0, so the first step
      // after an idle stretch still measures input speed against a real interval.
      const waking = last === 0
      const dt = waking ? 1 / 60 : (now - last) / 1000
      last = now
      // BELT AND BRACES for the one way the loop can sleep with an episode still
      // live: a hidden tab gets no frames at all, so `busy()` above cannot be
      // consulted. A tab that went away has rested by any definition, and the
      // episode it left behind must not survive the reader's return.
      if (waking) provenance = PROVENANCE_IDLE

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
      const eps = carryInputEps(TRACK_END, total)
      const readerMoved = carryAnchor === null ? 0 : carryRaw - carryAnchor

      // Classified BEFORE anything of ours moves the document this frame, on the
      // reader's own delta, so the verdict describes the reader and nothing else.
      // A lab jump outranks it: the skip, the restart and the iris are not the
      // reader at all, and `pinScrollTo` is the one place that knows they happened.
      provenance = stepProvenance(
        provenance,
        Math.abs(readerMoved) > eps,
        travelInput,
        dt,
        takePendingJump()
      )
      travelInput = false
      const motion = motionKindOf(provenance)

      carry = stepCarry(
        carry,
        arrivalRef.current.progress,
        carryRaw,
        readerMoved,
        dt,
        reduced.matches,
        eps
      )
      if (carry.target !== null && total > 0)
        pinScrollTo(trackOffsetFor(carry.target, total), 'pace')
      // Re-MEASURED rather than assumed: the anchor has to be the position the
      // document actually took, or the browser's own rounding would read as the
      // reader on the next frame and cancel the carry it caused.
      rawProgressRef.current = readRaw()
      carryAnchor = rawProgressRef.current

      // THE FAST-FORWARD's arming clock, stepped on the SETTLED document — after the
      // carry's write and its re-measure — so the lead it reads is the real gap
      // between where the reader has pushed and where the world stands. It is asked
      // BEFORE `stepArrival` because its verdict is an argument to it, and it is asked
      // about `arrivalRef.current.progress` (this frame's starting position) for the
      // same reason the cap is read at PREV progress: the row you are governed by is
      // the one you are standing in, not the one an uncapped step would have reached.
      //
      // "STILL PUSHING" IS THE EPISODE, NOT THIS FRAME'S DELTA, and that correction was
      // forced by measurement: `readerMoved > eps` never armed the fast-forward once in
      // 1,500 frames of real flings, because the only state that produces a large lead
      // is the reader pinned against the leash — and the leash's own `pinScrollTo`
      // consumes their motion, so the very next frame reads zero. The classifier
      // already tracks the thing actually being asked about (a run of travel with no
      // rest in it), it survives both a pinned frame and the eventless momentum after a
      // flick, and it ends when the document really stops. A retreat still disarms on
      // the frame it happens, because a retreat must never wait for an episode to close.
      const lead = rawProgressRef.current - arrivalRef.current.progress
      const pushing = provenance.episode === 'travel' && readerMoved >= -eps
      ff = stepFastForward(ff, arrivalRef.current.progress, lead, pushing, dt, reduced.matches)

      // ── T129 DIAGNOSTIC TELEMETRY (throwaway; reverted before any shipped run) ──
      const __w = window as unknown as { __swPace?: unknown[] }
      if (!__w.__swPace) __w.__swPace = []
      const __prev = arrivalRef.current
      const __cap = paceCapAt(__prev.progress, reduced.matches)
      if (__w.__swPace.length < 60000) {
        __w.__swPace.push({
          t: Math.round(performance.now()),
          dt: Number(dt.toFixed(5)),
          p: __prev.progress,
          raw: rawProgressRef.current,
          lead: Number(lead.toFixed(6)),
          cap: __cap === Infinity ? -1 : Number(__cap.toFixed(6)),
          mode: __prev.mode,
          motion,
          push: pushing ? 1 : 0,
          ffA: ff.active ? 1 : 0,
          ffH: Number(ff.held.toFixed(3)),
          ep: provenance.episode ?? 'none',
        })
      }
      // ── end T129 diagnostic ──

      const next = stepArrival(
        arrivalRef.current,
        rawProgressRef.current,
        dt,
        reduced.matches,
        motion,
        ff.active
      )

      // THE LEASH (Task 126). The governor has just decided where the world is; the
      // document is not allowed to be more than `GOVERNOR_MAX_LAG` past it, so it
      // is written back to the ceiling — through the same authority the carry moves
      // it with, flagged 'pace' so the classifier and the jump gate both know it was
      // not a reader and not a destination.
      //
      // It runs AFTER `stepArrival` and BEFORE the state is stored, and both halves
      // of that matter. After, because the ceiling is a function of the progress
      // this frame produced. Before, because the stored `raw` has to be where the
      // document ACTUALLY ended the frame — that value is what the next frame
      // measures a teleport and an unwind's tracking against, and a stale one would
      // report the leash's own correction as the reader pulling back.
      let leashed = next
      if (total > 0) {
        const target = leashTargetFor(next.progress, rawProgressRef.current, reduced.matches)
        if (target !== null) {
          pinScrollTo(trackOffsetFor(target, total), 'pace')
          rawProgressRef.current = readRaw()
          carryAnchor = rawProgressRef.current
          leashed = { ...next, raw: rawProgressRef.current }
        }
      }

      arrivalRef.current = leashed
      progressRef.current = leashed.progress
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
      //
      // ...AND NOT OVER ONE EITHER (Task 126). `isGoverned` asks where the world
      // IS; the boundary stop exists because a single fling frame can also land
      // past a beat it never stood in, and this shortcut would write exactly that
      // landing straight into the ref. Same defect as the one Task 109 found here,
      // one span further along: the gate would hold in `stepArrival` and the scroll
      // event would step around it.
      //
      // ...AND NOT WHILE A FAST-FORWARD IS GLIDING (Task 129). The third time this
      // shortcut has been found writing raw past a mechanism that was shaping it, and
      // the same class of hole every time: `!isGoverned` asks whether a CEILING
      // applies, and a fast-forward is a governed frame at a different rate — the one
      // frame where the two disagree is the one where the glide has just landed on the
      // span's end, whose cap has lifted while the reader's own finger is still a
      // leash-width past it. Left ungated that frame would hand the whole lead over at
      // once, which is exactly "the glide stops at the note's end" failing.
      if (
        !ff.active &&
        arrivalRef.current.mode === 'pass' &&
        !isGoverned(arrivalRef.current.progress, reduced.matches) &&
        governedEntryBetween(
          arrivalRef.current.progress,
          rawProgressRef.current,
          reduced.matches
        ) === null
      ) {
        progressRef.current = rawProgressRef.current
      }
      schedule()
    }

    // THE TRAVEL INPUTS, and the list is the policy (`scroll-provenance.ts`).
    // `touchmove` rather than `touchstart`: a TAP is not travel, and it must not be
    // — the skip-to-desk button is tapped, and a tap that armed the classifier
    // would hand the lab's own instant jump to the governor.
    const onTravelInput = () => {
      travelInput = true
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTravelKey(e.key)) travelInput = true
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('wheel', onTravelInput, { passive: true })
    window.addEventListener('touchmove', onTravelInput, { passive: true })
    window.addEventListener('keydown', onKeyDown, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('wheel', onTravelInput)
      window.removeEventListener('touchmove', onTravelInput)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [active, trackRef])

  return apiRef.current
}

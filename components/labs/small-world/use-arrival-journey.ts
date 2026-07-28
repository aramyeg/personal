'use client'
import { useEffect, useRef } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import { initialArrival, stepArrival, type ArrivalState } from './arrival'

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
  /** Journey progress every consumer renders from (absorbed). */
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

    const readRaw = () => {
      const el = trackRef.current
      if (!el) return rawProgressRef.current
      const total = el.scrollHeight - window.innerHeight
      return total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0
    }

    const busy = () =>
      arrivalRef.current.mode !== 'pass' || arrivalRef.current.reveal !== null

    const tick = (now: number) => {
      raf = 0
      // A restarted loop assumes one nominal frame rather than 0, so the first step
      // after an idle stretch still measures input speed against a real interval.
      const dt = last === 0 ? 1 / 60 : (now - last) / 1000
      last = now
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
      if (arrivalRef.current.mode === 'pass') progressRef.current = rawProgressRef.current
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

'use client'
import { useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import { CARD_PHASE_START, journeyStateAt, revealPhase } from '../journey-timeline'
import type { ArrivalJourney } from '../use-arrival-journey'

export type JourneyUi = {
  chapter: number
  burst: boolean
  /** `enter` is the cards' entrance progress 0→1, NOT a dwell fraction — see below. */
  panel: { chapter: number; enter: number } | null
  ended: boolean
}

const T_STEPS = 60
const END_AT = 0.985

/**
 * Cards mount and roll out on the ARRIVAL CLOCK when one is driving (Task 54): the
 * spread arrives by itself a beat behind the "!", parks for the whole dwell however
 * long the visitor lingers, and walks back out when they leave — in either
 * direction. Without a clock (unit tests, any scroll-pure caller) the entrance falls
 * back to the original dwell-fraction ramp, which is why `enter` is a mapped
 * entrance value rather than the raw t of either source.
 *
 * Quantizing `enter` caps re-renders at T_STEPS per entrance; parked at 1 it is a
 * constant, so lingering at a checkpoint costs no re-RENDERS. It is not free, though:
 * the driver stays busy for the whole dwell (a parked reveal is still a reveal), so
 * this recompute — including a fresh JourneyState and morph array — runs every frame
 * while you read. Marginal against the canvas's own frame, but not nothing.
 */
function uiAt(progress: number, journey?: ArrivalJourney): JourneyUi {
  const reveal = journey?.arrivalRef.current.reveal ?? null
  const s = journeyStateAt(progress, undefined, reveal)
  const enter = reveal
    ? revealPhase(reveal.t, CARD_PHASE_START, 1)
    : s.panel
      ? Math.min(1, s.panel.t * 2.2)
      : 0
  const chapter = reveal ? reveal.chapter : s.panel?.chapter
  return {
    chapter: s.chapter,
    burst: s.burst !== null,
    panel:
      chapter === undefined
        ? null
        : { chapter, enter: Math.round(enter * T_STEPS) / T_STEPS },
    ended: s.progress >= END_AT,
  }
}

function same(a: JourneyUi, b: JourneyUi): boolean {
  return (
    a.chapter === b.chapter &&
    a.burst === b.burst &&
    a.ended === b.ended &&
    (a.panel === b.panel ||
      (a.panel !== null &&
        b.panel !== null &&
        a.panel.chapter === b.panel.chapter &&
        a.panel.enter === b.panel.enter))
  )
}

/**
 * DOM-side journey state: derives panel/burst UI from the progress ref on scroll —
 * and, while an arrival is playing, on the driver's own frames. A checkpoint
 * entrance animates with NO scroll input at all, so a scroll-only listener would
 * freeze the cards mid-roll-out.
 */
export function useJourneyUi(
  progressRef: MutableRefObject<number>,
  journey?: ArrivalJourney
): JourneyUi {
  const [ui, setUi] = useState<JourneyUi>(() => uiAt(progressRef.current, journey))

  useEffect(() => {
    let raf = 0
    const compute = () => {
      raf = 0
      const next = uiAt(progressRef.current, journey)
      setUi((prev) => (same(prev, next) ? prev : next))
    }
    // Defer to rAF so this always reads progressRef AFTER every scroll
    // listener for the event has run (child effects mount before parent
    // effects, so reading synchronously here can see a stale ref).
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute)
    }
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    // The driver ticks only while the reveal clock or the scroll rubber band is
    // busy, so this costs nothing on a still page.
    const unsubscribe = journey?.subscribe(compute)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      unsubscribe?.()
    }
  }, [progressRef, journey])

  return ui
}

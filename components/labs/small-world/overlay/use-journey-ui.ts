'use client'
import { useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { EndingPhase } from '../ending-timeline'
import { CARD_PHASE_START, journeyStateAt, revealPhase } from '../journey-timeline'
import type { ArrivalJourney } from '../use-arrival-journey'
import { pageProgressAt } from './info-beats'

export type JourneyUi = {
  chapter: number
  burst: boolean
  /**
   * Has the visitor moved at all?
   *
   * The one thing this answers that `chapter` cannot: chapter is 0 both before
   * the journey starts and during its first leg, and the manga preloader needs
   * to tell those apart — page 0 is ~250KB and must not be on the first-paint
   * route. A tiny threshold rather than `> 0` so a browser restoring a scroll
   * position of a few pixels does not count as a start.
   */
  started: boolean
  /**
   * `enter` is the cards' entrance progress 0→1, NOT a dwell fraction — see below.
   *
   * `page` is the RIGHT LEAF's own ink progress, and it is a different kind of
   * number from `enter` on purpose: `enter` is the screen-space entrance and is
   * allowed to ride the arrival wall clock, `page` is a pure function of scroll
   * (`pageProgressAt`) and may never ride anything else. The info leaf's four
   * beats are drawn from it, so a settled card cannot be caught mid-draw and a
   * scrub backwards re-derives rather than replays. See `info-beats.ts`.
   */
  panel: { chapter: number; enter: number; page: number } | null
  /**
   * The ending's DOM-side view (Task 63) — null for the whole journey, then the ending's
   * own timeline. `t` is quantized like `panel.enter`, so scrubbing the ending costs at
   * most T_STEPS re-renders rather than one per frame; a consumer that needs the exact
   * value (or the stand/zoom sub-windows) should read `endingStateAt` itself.
   *
   * This replaces the old `ended` flag, which was a boolean because the only thing past
   * the journey was one full-viewport panel. `EndPanel` is retired: the ending is now
   * scroll real estate, and T64/T65 fill it.
   */
  ending: { t: number; phase: EndingPhase } | null
}

const T_STEPS = 60

/** Below this the journey counts as not yet begun. ~0.3% of the track. */
const START_EPSILON = 0.003

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
    started: s.progress > START_EPSILON,
    panel:
      chapter === undefined
        ? null
        : {
            chapter,
            enter: Math.round(enter * T_STEPS) / T_STEPS,
            // Quantized on the same ladder as `enter`, and for the same reason:
            // parked at 1 it is a constant, so lingering on a finished page costs
            // no re-renders at all. T_STEPS steps is finer than the eye across a
            // 400px span, and the beats ease within a step anyway.
            page: Math.round(pageProgressAt(progress) * T_STEPS) / T_STEPS,
          },
    // `s.progress` is clamped and reads 1 for the whole ending, so it cannot answer this —
    // `s.ending` is the field built from the un-clamped value. See ending-timeline.ts.
    ending: s.ending.active
      ? { t: Math.round(s.ending.t * T_STEPS) / T_STEPS, phase: s.ending.phase }
      : null,
  }
}

function same(a: JourneyUi, b: JourneyUi): boolean {
  return (
    a.chapter === b.chapter &&
    a.burst === b.burst &&
    a.started === b.started &&
    (a.ending === b.ending ||
      (a.ending !== null &&
        b.ending !== null &&
        a.ending.t === b.ending.t &&
        a.ending.phase === b.ending.phase)) &&
    (a.panel === b.panel ||
      (a.panel !== null &&
        b.panel !== null &&
        a.panel.chapter === b.panel.chapter &&
        a.panel.enter === b.panel.enter &&
        a.panel.page === b.panel.page))
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

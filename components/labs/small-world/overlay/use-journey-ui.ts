'use client'
import { useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import { journeyStateAt } from '../journey-timeline'

export type JourneyUi = {
  chapter: number
  burst: boolean
  panel: { chapter: number; t: number } | null
  ended: boolean
}

const T_STEPS = 40
const END_AT = 0.985

function uiAt(progress: number): JourneyUi {
  const s = journeyStateAt(progress)
  return {
    chapter: s.chapter,
    burst: s.burst !== null,
    panel: s.panel
      ? { chapter: s.panel.chapter, t: Math.round(s.panel.t * T_STEPS) / T_STEPS }
      : null,
    ended: s.progress >= END_AT,
  }
}

function same(a: JourneyUi, b: JourneyUi): boolean {
  return (
    a.chapter === b.chapter &&
    a.burst === b.burst &&
    a.ended === b.ended &&
    (a.panel === b.panel ||
      (a.panel !== null && b.panel !== null && a.panel.chapter === b.panel.chapter && a.panel.t === b.panel.t))
  )
}

/**
 * DOM-side journey state: derives panel/burst UI from the RAW progress ref on
 * scroll (never the damped canvas value — panels must not lag the finger).
 * Quantizing panel.t caps re-renders at T_STEPS per panel window.
 */
export function useJourneyUi(progressRef: MutableRefObject<number>): JourneyUi {
  const [ui, setUi] = useState<JourneyUi>(() => uiAt(progressRef.current))

  useEffect(() => {
    let raf = 0
    const compute = () => {
      const next = uiAt(progressRef.current)
      setUi((prev) => (same(prev, next) ? prev : next))
    }
    // Defer to rAF so this always reads progressRef AFTER every scroll
    // listener for the event has run (child effects mount before parent
    // effects, so reading synchronously here can see a stale ref).
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(compute)
    }
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [progressRef])

  return ui
}

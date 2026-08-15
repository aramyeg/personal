'use client'

import { useEffect, useRef, useState } from 'react'
import { useCuratorStore } from './store'
import { useEscCapture } from './use-esc-capture'
import { TOUR_STEPS } from './tour-steps'
import { computeTourCardPosition, type TourRect } from './tour-position'
import styles from './curator.module.css'

const OPEN_DELAY_MS = 600
const CARD_WIDTH = 320
const CARD_ESTIMATED_HEIGHT = 160
const RING_PADDING = 4

function rectFromElement(el: Element): TourRect {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

/** Walks forward from `fromIndex` through TOUR_STEPS, resolving the first step
 *  whose anchor exists in the DOM. A step whose anchor is missing (e.g. a
 *  hidden SPEC chip) is skipped so a user preference can never strand the tour. */
function resolveFrom(fromIndex: number): { index: number; el: Element } | null {
  for (let i = fromIndex; i < TOUR_STEPS.length; i++) {
    const el = document.querySelector(TOUR_STEPS[i].target)
    if (el) return { index: i, el }
  }
  return null
}

/** Mirrors resolveFrom, walking backward. Back() uses this instead of
 *  resolveFrom so a skipped step's missing anchor doesn't re-resolve forward
 *  onto the step Back was just called from (a visible no-op). */
function resolveBackwardFrom(fromIndex: number): { index: number; el: Element } | null {
  for (let i = fromIndex; i >= 0; i--) {
    const el = document.querySelector(TOUR_STEPS[i].target)
    if (el) return { index: i, el }
  }
  return null
}

export function CuratorTour() {
  const tourDone = useCuratorStore((s) => s.tourDone)
  const tourOpen = useCuratorStore((s) => s.tourOpen)
  const reduceMotionPref = useCuratorStore((s) => s.preferences.reduceMotion)
  const setTourOpen = useCuratorStore((s) => s.setTourOpen)
  const markTourDone = useCuratorStore((s) => s.markTourDone)

  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<TourRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  function finish(): void {
    setTourOpen(false)
    markTourDone()
  }

  // Reactive on tourDone (not mount-only): if rehydration flips tourDone to
  // true while the open delay is still pending, the cleanup below cancels it.
  useEffect(() => {
    if (tourDone) return
    if (!window.matchMedia('(min-width: 1024px)').matches) return
    const timer = setTimeout(() => {
      const resolved = resolveFrom(0)
      if (!resolved) return
      setStepIndex(resolved.index)
      setTargetRect(rectFromElement(resolved.el))
      setTourOpen(true)
    }, OPEN_DELAY_MS)
    return () => clearTimeout(timer)
  }, [tourDone, setTourOpen])

  useEffect(() => {
    if (!tourOpen) return
    cardRef.current?.focus()
  }, [tourOpen, stepIndex])

  useEffect(() => {
    if (!tourOpen) return
    const onResize = () => {
      const el = document.querySelector(TOUR_STEPS[stepIndex].target)
      if (el) setTargetRect(rectFromElement(el))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [tourOpen, stepIndex])

  useEscCapture(tourOpen, finish)

  function goTo(index: number): void {
    const resolved = resolveFrom(index)
    if (!resolved) {
      finish()
      return
    }
    setStepIndex(resolved.index)
    setTargetRect(rectFromElement(resolved.el))
  }

  function next(): void {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      finish()
      return
    }
    goTo(stepIndex + 1)
  }

  function back(): void {
    if (stepIndex <= 0) return
    const resolved = resolveBackwardFrom(stepIndex - 1)
    if (!resolved) return
    setStepIndex(resolved.index)
    setTargetRect(rectFromElement(resolved.el))
  }

  if (tourDone || !tourOpen || !targetRect) return null

  const step = TOUR_STEPS[stepIndex]
  const reduceMotion = reduceMotionPref || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const transition = reduceMotion
    ? 'none'
    : 'top 200ms ease-out, left 200ms ease-out, width 200ms ease-out, height 200ms ease-out'

  const cardPos = computeTourCardPosition(
    targetRect,
    { width: CARD_WIDTH, height: cardRef.current?.offsetHeight ?? CARD_ESTIMATED_HEIGHT },
    { width: window.innerWidth, height: window.innerHeight },
  )

  return (
    <div className="fixed inset-0 z-50">
      {/* The 9999px box-shadow spread here is a scrim cutout around the
          spotlighted anchor, matching the drawer/NPS backdrop color — not an
          elevation shadow — so it does not violate the lab's no-shadows signature. */}
      <div
        aria-hidden
        className="absolute rounded-[6px] border-2 border-[var(--c-blue)]"
        style={{
          top: targetRect.top - RING_PADDING,
          left: targetRect.left - RING_PADDING,
          width: targetRect.width + RING_PADDING * 2,
          height: targetRect.height + RING_PADDING * 2,
          boxShadow: '0 0 0 9999px rgba(12,35,64,0.4)',
          transition,
        }}
      >
        <span className={styles.tourPulse} />
      </div>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Product tour"
        tabIndex={-1}
        className="absolute w-[320px] rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4 outline-none"
        style={{ top: cardPos.top, left: cardPos.left, transition }}
      >
        <p className="font-[family-name:var(--font-data)] text-[10px] text-[var(--c-text-soft)]">
          Step {stepIndex + 1} of {TOUR_STEPS.length}
        </p>
        <p className="mt-1.5 text-[13px] font-semibold text-[var(--c-text)]">{step.title}</p>
        <p className="mt-1 text-[12px] text-[var(--c-text-soft)]">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={finish}
            className="touch-manipulation text-[12px] text-[var(--c-text-soft)] transition-colors duration-150 hover:text-[var(--c-text)]"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={back}
                className="touch-manipulation rounded-[4px] px-2.5 py-1.5 text-[12px] text-[var(--c-text-soft)] transition-colors duration-150 hover:bg-[var(--c-hover)]"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="touch-manipulation rounded-[4px] bg-[var(--c-navy)] px-2.5 py-1.5 text-[12px] font-medium text-white transition-colors duration-150 hover:bg-[var(--c-blue)]"
            >
              {stepIndex === TOUR_STEPS.length - 1 ? 'Get started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

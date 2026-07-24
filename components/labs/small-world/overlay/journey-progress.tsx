'use client'
import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { CHAPTER_COUNT } from '../chapters'
import { chapters } from '../chapters'
import { PALETTE } from '../palette'

/**
 * A slim journey progress rail: six clay dots + a filling ink line at the bottom
 * of the frame, telling the traveller "chapter N of 6" and how far around the
 * little world they are. It answers the journey's biggest missing affordance —
 * during the frozen discovery + panel dwells the planet stops turning, and with
 * nothing else moving the scroll reads as "stuck"; the fill keeps creeping as
 * you scroll, so the input still visibly registers.
 *
 * DELIBERATELY NON-INTERACTIVE (Phase B): the dots do not jump chapters — that
 * is a feel-changing navigation decision left for Aram's pick (Phase C). Only
 * the small dismiss control takes pointer events, so this element cannot
 * intercept a scroll, tap, or the panel's tap-to-advance. It reads the RAW
 * progress ref (never the damped canvas value) so it tracks the finger exactly,
 * like the panels do. Reversible whole-cloth via SHOW_PROGRESS_RAIL in
 * journey-overlay.tsx.
 *
 * Cheap by construction: the fill width is written straight to the DOM every
 * scroll frame (no React churn); state updates only when the integer chapter
 * changes — at most CHAPTER_COUNT times across the whole journey.
 */

const DOT = 9
const DOT_ACTIVE = 14

function chapterAt(progress: number): number {
  const p = Math.min(1, Math.max(0, progress))
  return Math.min(CHAPTER_COUNT - 1, Math.floor(p * CHAPTER_COUNT))
}

export function JourneyProgress({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const [chapter, setChapter] = useState(() => chapterAt(progressRef.current))
  const [dismissed, setDismissed] = useState(false)
  const fillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (dismissed) return
    let raf = 0
    const compute = () => {
      const p = Math.min(1, Math.max(0, progressRef.current))
      if (fillRef.current) fillRef.current.style.width = `${p * 100}%`
      const c = chapterAt(p)
      setChapter((prev) => (prev === c ? prev : c))
    }
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
  }, [progressRef, dismissed])

  if (dismissed) return null

  return (
    <div
      role="group"
      aria-label={`Journey progress: chapter ${chapter + 1} of ${CHAPTER_COUNT}`}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 'max(22px, env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7,
        pointerEvents: 'none',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontFamily: 'var(--sw-font-panel)',
          fontSize: 13,
          letterSpacing: 2,
          color: PALETTE.ink,
          opacity: 0.72,
          lineHeight: 1,
        }}
      >
        {chapter + 1} / {CHAPTER_COUNT}
      </span>

      <div aria-hidden="true" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {/* track + fill sit behind the dots, threading their centres */}
        <div
          style={{
            position: 'absolute',
            left: DOT_ACTIVE / 2,
            right: DOT_ACTIVE / 2,
            height: 3,
            borderRadius: 3,
            background: `${PALETTE.ink}24`,
          }}
        >
          <div
            ref={fillRef}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '0%',
              borderRadius: 3,
              background: PALETTE.blossomDeep,
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative' }}>
          {chapters.map((ch, i) => {
            const isActive = i === chapter
            const isPassed = i < chapter
            const size = isActive ? DOT_ACTIVE : DOT
            return (
              <span
                key={ch.id}
                style={{
                  width: DOT_ACTIVE,
                  height: DOT_ACTIVE,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    border: `2px solid ${PALETTE.ink}`,
                    background: isActive ? ch.accent : isPassed ? PALETTE.ink : PALETTE.sky,
                    boxShadow: isActive ? `2px 2px 0 ${PALETTE.ink}` : 'none',
                    transition: 'width 180ms ease, height 180ms ease, background 180ms ease',
                  }}
                />
              </span>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Hide journey progress"
        style={{
          position: 'absolute',
          right: 'max(12px, env(safe-area-inset-right))',
          bottom: 2,
          pointerEvents: 'auto',
          appearance: 'none',
          border: 'none',
          background: 'transparent',
          color: PALETTE.ink,
          opacity: 0.4,
          fontFamily: 'var(--sw-font-body)',
          fontSize: 16,
          lineHeight: 1,
          cursor: 'pointer',
          padding: 6,
        }}
      >
        ×
      </button>
    </div>
  )
}

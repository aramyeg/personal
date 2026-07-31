'use client'
import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { CHAPTER_COUNT } from '../chapters'
import { chapters } from '../chapters'
import { endingStateAt } from '../ending-timeline'
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
 *
 * TASK 65 — IT LEAVES WHEN THE WORLD DOES.
 * Task 63 left the rail flagged rather than decided: it clamps, so through the
 * whole ending it reads a truthful "6 / 6" with a full bar — floating over a
 * desk, a hand-written note and three contact links. Truthful and wrong. The
 * decision here is to FADE it rather than to kill it (`SHOW_PROGRESS_RAIL` is
 * still the whole-cloth revert): through the curtain call the rail is still
 * doing its original job, which is to answer "did my scroll register" while the
 * world stands still — and the curtain call is the stillest the lab ever gets.
 * It is only once the camera starts moving that the frame answers that question
 * by itself, and the counter becomes chrome over the portfolio's contact page.
 *
 * So the fade is keyed to `zoom`, not to the ending, and it is gone by the time
 * there is a composition to sit on top of. When it is gone the whole rail is
 * `visibility: hidden` as well as transparent.
 *
 * THE DISMISS CONTROL LEAVES FIRST, and on a LEGIBILITY threshold rather than on
 * a non-zero one. Hiding the rail only at exactly `opacity === 0` answered the
 * trap at its endpoint and not on its approach: review swept real frames and
 * found the button still topmost at its own centre, and still focusable, with
 * the wrapper at 0.0247 — an effective alpha of 0.0099 once its own 0.4 is
 * applied. A ~43 px window on a 15840 px track, and bounded in consequence, but
 * it is the same defect `ending-connect.tsx` refuses three files over. It now
 * uses that file's standard: a control is live only while it is legible.
 */

const DOT = 9
const DOT_ACTIVE = 14

/** The rail is fully gone by this much of the pull-back — well before the desk is readable. */
const RAIL_GONE_AT = 0.28

/**
 * How much of the rail has to be up for its dismiss control to be honest about being clickable.
 * The same number `ending-connect.tsx` uses, applied to the same question.
 */
const DISMISS_LIVE_AT = 0.85

/** Whether the dismiss control may take a pointer or the keyboard at a scroll position. */
export function railDismissLive(progress: number): boolean {
  return railOpacity(progress) >= DISMISS_LIVE_AT
}

/** Its opacity at a scroll position, from the ending's own zoom parameter. */
export function railOpacity(progress: number): number {
  const { zoom } = endingStateAt(progress)
  const v = 1 - zoom / RAIL_GONE_AT
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function chapterAt(progress: number): number {
  const p = Math.min(1, Math.max(0, progress))
  return Math.min(CHAPTER_COUNT - 1, Math.floor(p * CHAPTER_COUNT))
}

export function JourneyProgress({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const [chapter, setChapter] = useState(() => chapterAt(progressRef.current))
  const [dismissed, setDismissed] = useState(false)
  const fillRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dismissRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (dismissed) return
    let raf = 0
    const compute = () => {
      // the RAW value, unclamped: `railOpacity` reads the ending, and the clamp is what hides it
      const raw = progressRef.current
      const p = Math.min(1, Math.max(0, raw))
      if (fillRef.current) fillRef.current.style.width = `${p * 100}%`
      if (wrapRef.current) {
        const o = railOpacity(raw)
        wrapRef.current.style.opacity = `${o}`
        wrapRef.current.style.visibility = o === 0 ? 'hidden' : 'visible'
      }
      if (dismissRef.current) {
        // `visibility` and not just `pointerEvents`: the second stops a click, the first is what
        // takes the control out of sequential focus as well
        const live = railDismissLive(raw)
        dismissRef.current.style.pointerEvents = live ? 'auto' : 'none'
        dismissRef.current.style.visibility = live ? 'visible' : 'hidden'
      }
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
      ref={wrapRef}
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
        ref={dismissRef}
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Hide journey progress"
        style={{
          position: 'absolute',
          right: 'max(12px, env(safe-area-inset-right))',
          bottom: 2,
          // inert until the first compute says otherwise — the safe direction to be wrong in
          pointerEvents: 'none',
          visibility: 'hidden',
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

'use client'

/**
 * Custom pointer: a 24×24 quill that trails the real pointer, growing and
 * catching gold light over anything tagged `data-sb-hover` (nav arrows, the
 * wax-seal button, sigil links, the cover CTA). Fine-pointer only — coarse
 * (touch) pointers never see it, and `.sb-root` keeps its native cursor
 * there (see the `(pointer: fine)` guard in storybook-responsive.css).
 * Also stays off in the portrait/narrow layout (same breakpoint as
 * storybook-responsive.css's `.sb-quill-cursor { display: none }`) — the
 * element is hidden there but the rAF loop doesn't know that on its own, so
 * it's gated on the same query and torn down rather than spinning forever
 * writing a transform nobody sees. Both queries are watched for `change` so
 * resizing/rotating across the breakpoint starts or stops the loop live.
 * Position is written on every `pointermove`; the rAF loop reads the latest
 * values and writes the transform once per frame, so a burst of pointer
 * events never forces more than one style write per frame.
 *
 * Task 18 polish: still a single rAF loop writing one `transform` per
 * frame (translate + rotate + scale only) —
 *  - Rotation lags the pointer's horizontal velocity (eased toward a
 *    target tilt, not applied instantly), so the nib trails a beat behind
 *    fast swipes instead of feeling rigidly glued to the cursor.
 *  - A brief "ink-dip" squish plays on `pointerdown`, decaying back to
 *    rest over PRESS_DURATION_MS — pure JS easing, not a CSS transition
 *    (one would fight the per-frame transform writes).
 */

import { useEffect, useRef } from 'react'

const NARROW_QUERY = '(max-width: 820px), (orientation: portrait)'
const ROT_MAX_DEG = 9
const ROT_SENSITIVITY = 0.7
const ROT_LAG = 0.18
const PRESS_DURATION_MS = 220
const PRESS_DIP = 0.22

export function QuillCursor() {
  const elRef = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: -100, y: -100 })
  const prevPos = useRef({ x: -100, y: -100 })
  const rotation = useRef(0)
  const hovering = useRef(false)
  const pressedAt = useRef<number | null>(null)
  const rafId = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const el = elRef.current
    if (!el) return

    const fineMql = window.matchMedia('(pointer: fine)')
    const narrowMql = window.matchMedia(NARROW_QUERY)

    let running = false

    const onMove = (e: PointerEvent) => {
      pos.current = { x: e.clientX, y: e.clientY }
      const target = e.target
      hovering.current = target instanceof Element && target.closest('[data-sb-hover]') !== null
    }

    const onDown = () => {
      pressedAt.current = performance.now()
    }

    const tick = () => {
      const { x, y } = pos.current

      // Horizontal velocity since the last frame drives a small trailing
      // tilt — a real held pen lags a beat behind a fast sideways stroke
      // instead of snapping to point along it.
      const dx = x - prevPos.current.x
      prevPos.current = { x, y }
      const targetRot = Math.max(-ROT_MAX_DEG, Math.min(ROT_MAX_DEG, dx * ROT_SENSITIVITY))
      rotation.current += (targetRot - rotation.current) * ROT_LAG

      let pressDip = 0
      if (pressedAt.current !== null) {
        const pressT = Math.min(1, (performance.now() - pressedAt.current) / PRESS_DURATION_MS)
        const settle = 1 - pressT
        pressDip = PRESS_DIP * settle * settle
        if (pressT >= 1) pressedAt.current = null
      }

      const hoverScale = hovering.current ? 1.15 : 1
      const scale = hoverScale * (1 - pressDip)

      el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotation.current.toFixed(2)}deg) scale(${scale.toFixed(3)})`
      el.classList.toggle('sb-quill-cursor--hover', hovering.current)
      rafId.current = requestAnimationFrame(tick)
    }

    const start = () => {
      if (running) return
      running = true
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerdown', onDown)
      rafId.current = requestAnimationFrame(tick)
    }

    const stop = () => {
      if (!running) return
      running = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }
    }

    const sync = () => {
      if (fineMql.matches && !narrowMql.matches) start()
      else stop()
    }

    sync()
    fineMql.addEventListener('change', sync)
    narrowMql.addEventListener('change', sync)

    return () => {
      fineMql.removeEventListener('change', sync)
      narrowMql.removeEventListener('change', sync)
      stop()
    }
  }, [])

  return (
    <div ref={elRef} className="sb-quill-cursor" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        {/* shaft: a gentle S-curve from plume to nib, rather than a near-straight line */}
        <path
          d="M20.8 2.4C15.6 4.1 10.6 7.6 7.6 12.4 6 14.9 5 17 4.4 18.6"
          stroke="var(--sb-ink)"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        {/* feather plume/vane */}
        <path
          d="M20.8 2.4c-3.9 1-7.1 2.8-9.6 5.4 1.9-.3 3.7-.2 5.4.4-1.6 1.1-2.9 2.5-3.8 4.3 2.1-.6 3.9-1.8 5.3-3.7 1.2-1.6 2-3.6 2.7-6.4z"
          fill="var(--sb-gold-bright)"
          stroke="var(--sb-gold-deep)"
          strokeWidth="0.45"
        />
        {/* barb texture strokes along the shaft, suggesting feather grain */}
        <path
          d="M15.7 6.6 13.4 8.4M13.1 9.9 10.8 11.5M10.6 13.1 8.5 14.6"
          stroke="var(--sb-gold-deep)"
          strokeWidth="0.55"
          strokeLinecap="round"
          opacity="0.75"
        />
        {/* nib tip + ink highlight */}
        <path d="M6.2 16.2 4.2 19 7 17.3z" fill="var(--sb-ink)" />
        <circle cx="4.6" cy="18.7" r="1" fill="var(--sb-ink)" />
      </svg>
    </div>
  )
}

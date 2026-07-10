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
 */

import { useEffect, useRef } from 'react'

const NARROW_QUERY = '(max-width: 820px), (orientation: portrait)'

export function QuillCursor() {
  const elRef = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: -100, y: -100 })
  const hovering = useRef(false)
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

    const tick = () => {
      const { x, y } = pos.current
      const scale = hovering.current ? 1.15 : 1
      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`
      el.classList.toggle('sb-quill-cursor--hover', hovering.current)
      rafId.current = requestAnimationFrame(tick)
    }

    const start = () => {
      if (running) return
      running = true
      window.addEventListener('pointermove', onMove)
      rafId.current = requestAnimationFrame(tick)
    }

    const stop = () => {
      if (!running) return
      running = false
      window.removeEventListener('pointermove', onMove)
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
        <path
          d="M20.5 2c-6.5 1-11.5 4.5-15 15.5"
          stroke="var(--sb-ink)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M20.5 2c-4.6.9-8 3-10.4 6.3 2-.7 4-1.1 5.9-1 -1.4 1.8-2.6 3.9-2.9 6.6 2.3-1.3 4-3.1 5-5.6.9-2.1 1.7-4.1 2.4-6.3z"
          fill="var(--sb-gold-bright)"
          stroke="var(--sb-gold-deep)"
          strokeWidth="0.5"
        />
        <circle cx="5.3" cy="17.8" r="1.15" fill="var(--sb-ink)" />
      </svg>
    </div>
  )
}

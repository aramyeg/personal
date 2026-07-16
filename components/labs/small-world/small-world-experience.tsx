'use client'
import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { CHAPTER_COUNT } from './chapters'
import { FALLBACK_CLASS } from './fallback-class'
import { SpeedLines } from './overlay/speed-lines'
import { useJourneyUi } from './overlay/use-journey-ui'
import { SmallWorldScene } from './scene/scene'

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

const TRACK_VH_PER_CHAPTER = 150

/**
 * Owns the tall scroll track and turns document scroll into a 0..1 progress
 * ref for the scene. Falls back to the server timeline when WebGL is missing
 * or the visitor prefers reduced motion.
 */
export function SmallWorldExperience() {
  const [active, setActive] = useState(false)
  const progressRef = useRef(0)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setActive(!mq.matches && detectWebGL())
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!active) return
    const onScroll = () => {
      const el = trackRef.current
      if (!el) return
      const total = el.scrollHeight - window.innerHeight
      progressRef.current = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [active])

  if (!active) return null

  return (
    <div ref={trackRef} style={{ height: `${CHAPTER_COUNT * TRACK_VH_PER_CHAPTER}vh` }}>
      <div style={{ position: 'sticky', top: 0, height: '100dvh' }}>
        <SmallWorldScene progressRef={progressRef} />
        <OverlayLayer progressRef={progressRef} />
      </div>
      <style>{`.${FALLBACK_CLASS}{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}`}</style>
    </div>
  )
}

// Temporary scaffolding — Task 9 replaces this with a JourneyOverlay component.
function OverlayLayer({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const ui = useJourneyUi(progressRef)
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <SpeedLines active={ui.burst} />
    </div>
  )
}

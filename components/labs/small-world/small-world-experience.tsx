'use client'
import dynamic from 'next/dynamic'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CHAPTER_COUNT } from './chapters'
import { FALLBACK_CLASS } from './fallback-class'
import { JourneyOverlay } from './overlay/journey-overlay'
import { SmallWorldScene } from './scene/scene'
import { beginManualScrollRestoration, pinScrollToTop } from './scroll-reset'
import { isTuneEnabled } from './scene/tunables'

/** The ?tune=1 roughness panel is code-split behind the flag: absent → this chunk is
 *  never requested, so normal visitors (and LinkedIn unfurls) pay zero bundle/runtime. */
const TunePanel = dynamic(() => import('./overlay/tune-panel').then((m) => m.TunePanel), {
  ssr: false,
})

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

const TRACK_VH_PER_CHAPTER = 240

/**
 * Owns the tall scroll track and turns document scroll into a 0..1 progress
 * ref for the scene. Falls back to the server timeline when WebGL is missing
 * or the visitor prefers reduced motion.
 */
export function SmallWorldExperience() {
  const [active, setActive] = useState(false)
  const [tune, setTune] = useState(false)
  const progressRef = useRef(0)
  const trackRef = useRef<HTMLDivElement>(null)

  // BUG-fix: own scroll restoration for the lab's lifetime so a reload-while-deep
  // never lets the browser re-apply a stale scroll during load (which made the
  // journey sample a near-end progress — the "loads at the end then resets" flash).
  // Layout effect + manual mode from first mount; the prior mode is restored on
  // unmount so every other route keeps normal restoration.
  useLayoutEffect(() => {
    const restore = beginManualScrollRestoration()
    pinScrollToTop()
    return restore
  }, [])

  // The tall track only exists once `active` flips true; pin to top again in the
  // same commit (before paint) so the just-grown page can't show a restored depth.
  useLayoutEffect(() => {
    if (active) pinScrollToTop()
  }, [active])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setActive(!mq.matches && detectWebGL())
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Client-only read of ?tune=1 (this whole component is dynamic ssr:false, so
  // window.location is safe and needs no Suspense boundary). Absent → TunePanel is
  // never rendered, so its dynamic import never fires.
  useEffect(() => {
    setTune(isTuneEnabled(window.location.search))
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

  const advanceTo = (p: number) => {
    const el = trackRef.current
    if (!el) return
    const total = el.scrollHeight - window.innerHeight
    const top = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + p * total, behavior: 'smooth' })
  }

  if (!active) return null

  return (
    <div ref={trackRef} style={{ height: `${CHAPTER_COUNT * TRACK_VH_PER_CHAPTER}vh` }}>
      <div style={{ position: 'sticky', top: 0, height: '100dvh' }}>
        <SmallWorldScene progressRef={progressRef} />
        <JourneyOverlay progressRef={progressRef} onAdvance={advanceTo} />
        {tune && <TunePanel />}
      </div>
      {/* Collapse the now-pastel-styled fallback once the scene is live. Neutralises
          the fallback's own min-height/padding/background so it fully visually hides
          (this rule renders after the fallback's style block, so it wins on tie). */}
      <style>{`.${FALLBACK_CLASS}{position:absolute!important;width:1px;height:1px;min-height:0;padding:0;margin:0;overflow:hidden;clip-path:inset(50%)}`}</style>
    </div>
  )
}

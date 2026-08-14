'use client'
import dynamic from 'next/dynamic'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CHAPTER_COUNT } from './chapters'
import { TRACK_END, trackOffsetFor } from './ending-timeline'
import { FALLBACK_CLASS } from './fallback-class'
import { JourneyOverlay } from './overlay/journey-overlay'
import { SmallWorldScene } from './scene/scene'
import { beginManualScrollRestoration, pinScrollTo, pinScrollToTop } from './scroll-reset'
import { StoryStopSnap } from './story-stop-snap'
import { useArrivalJourney } from './use-arrival-journey'
import { initPersistence, isTuneEnabled } from './scene/tunables'

/**
 * ?tune-gated dial persistence is armed HERE rather than inside `tunables.ts` itself,
 * and the reason is a production failure rather than a preference: `tunables.ts` is
 * also in the land-bake Web Worker's module graph, a self-invoking `typeof window`
 * guard there is constant-folded away by the bundler, and the resulting
 * `ReferenceError` silently killed the worker offload while leaving the scene looking
 * correct. This module is a client component the worker cannot reach, so being the
 * caller IS the environment check. See `initPersistence` for the full account.
 *
 * At module scope, so a stored dial set is restored before this component ever
 * renders and therefore before the scene reads a value off `DIALS`. The store no-ops
 * unless `?tune` is present, so a normal visitor touches no storage at all.
 */
initPersistence(window.location.search)

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
 * The track carries the six chapters AND the ending segment after them, in one
 * continuous scroll (Task 63). The split is a RATIO of the measured scrollable
 * height rather than a pixel subtraction — see `readRaw` in use-arrival-journey —
 * so the sticky viewport's own height never has to be reconciled against `vh`
 * units, which differ from `window.innerHeight` on mobile browsers with a
 * collapsing toolbar. The journey's own scroll therefore stretches by
 * ENDING_SPAN/TRACK_END ≈ 1.7% per chapter; at 223vh per chapter that is 4vh, and
 * every progress-keyed number in the lab is unchanged.
 */
const TRACK_VH = CHAPTER_COUNT * TRACK_VH_PER_CHAPTER * TRACK_END

/**
 * Owns the tall scroll track and turns document scroll into a progress ref for
 * the scene: [0, 1] is the journey, (1, TRACK_END] is the ending. Falls back to
 * the server timeline when WebGL is missing or the visitor prefers reduced motion.
 */
export function SmallWorldExperience({
  onLoadChange,
}: {
  onLoadChange?: (progress: number, ready: boolean) => void
} = {}) {
  const [active, setActive] = useState(false)
  const [tune, setTune] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  // Owns scroll→progress AND the checkpoint arrival clock: progressRef is the
  // absorbed journey progress, so a checkpoint entrance can hold the world still
  // for a beat while its cards and mascots roll out (Task 54).
  const journey = useArrivalJourney(trackRef, active)
  const progressRef = journey.progressRef

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

  // `p` is JOURNEY progress (a chapter boundary), so it has to be mapped back through the
  // track's full domain — the track runs to TRACK_END now, not to 1.
  const advanceTo = (p: number) => {
    const el = trackRef.current
    if (!el) return
    const total = el.scrollHeight - window.innerHeight
    const top = el.getBoundingClientRect().top + window.scrollY
    // DELIBERATELY NOT ANNOUNCED to the governor (Task 126). The glide lands on the
    // NEXT checkpoint, so the only beat it crosses is the destination's own — and a
    // reader who asked for the next chapter should be shown that chapter's page, at
    // its pace, rather than dropped past it. Announcing it was tried and measured:
    // `onPointerMissed` fires tap-to-advance at the end of a FLING over a spread, so
    // the announcement handed a lab teleport to every fling that ended on a
    // checkpoint and put whole-story traversal straight back to 4.5 s.
    window.scrollTo({ top: top + trackOffsetFor(p, total), behavior: 'smooth' })
  }

  /**
   * The same destination, arrived at in ONE FRAME (Task 108) — what the iris calls while the frame
   * is covered.
   *
   * It is `advanceTo`'s body with the animation removed, and it lives here for the reason
   * `advanceTo` does: the progress → pixels mapping needs the track element, and this component is
   * the one that owns it. `pinScrollTo` rather than a plain `scrollTo` because the lab's global
   * `scroll-behavior: smooth` would otherwise animate the jump — the exact defect Task 106 measured
   * at 90 frames and 1.5 s, hidden for three rounds behind a caller that only ever jumped to 0.
   */
  const seekTo = (p: number) => {
    const el = trackRef.current
    if (!el) return
    const total = el.scrollHeight - window.innerHeight
    const top = el.getBoundingClientRect().top + window.scrollY
    pinScrollTo(top + trackOffsetFor(p, total))
  }

  if (!active) return null

  return (
    <div ref={trackRef} style={{ height: `${TRACK_VH}vh`, position: 'relative' }}>
      {/* On a touch device the track carries one snap area per checkpoint, so a FLING settles at
          the next story stop instead of sailing past two biomes (Task 75). Desktop mounts nothing
          at all and slow scrolling never arms it — see story-stops.ts for the mechanism and its
          rails. `position: relative` above is what the areas are placed against; it changes no
          layout on its own. */}
      <StoryStopSnap trackRef={trackRef} progressRef={progressRef} />
      <div style={{ position: 'sticky', top: 0, height: '100dvh' }}>
        <SmallWorldScene progressRef={progressRef} journey={journey} onLoadChange={onLoadChange} />
        <JourneyOverlay
          progressRef={progressRef}
          journey={journey}
          onAdvance={advanceTo}
          onSeek={seekTo}
        />
        {tune && <TunePanel />}
      </div>
      {/* Collapse the now-pastel-styled fallback once the scene is live. Neutralises
          the fallback's own min-height/padding/background so it fully visually hides
          (this rule renders after the fallback's style block, so it wins on tie).

          `visibility:hidden` is load-bearing, not belt-and-braces (Task 65). The clip
          alone hides the fallback from the EYE and leaves it in the tab order, which
          cost nothing while the fallback was only prose — and became a trap the moment
          it grew contact links: three invisible tab stops at document offset 0, each of
          which scrolls the visitor to the top of a 1600 vh track to "reveal" a 1 px box.
          A keyboard visitor reading the ending was thrown back to chapter one, and the
          ending unmounted under them. Hidden visibility takes the whole subtree out of
          sequential focus and out of the accessibility tree, which is the right
          semantics anyway: once the canvas is live, the static page is not a second
          interface running alongside it — the ending's own connect block is the way
          through, and it is real DOM. */}
      <style>{`.${FALLBACK_CLASS}{position:absolute!important;width:1px;height:1px;min-height:0;padding:0;margin:0;overflow:hidden;clip-path:inset(50%);visibility:hidden}`}</style>
    </div>
  )
}

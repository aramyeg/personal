'use client'
import { useEffect, useState, type CSSProperties } from 'react'
import { EPILOGUE } from '../manga'
import { MangaPageArt } from './manga-page'
import { INK_PLACEMENT, INK_PRELOAD_T, inkArrivalAt } from './ink-arrival'

/**
 * THE EPILOGUE PAGE, IN THE ENDING (Task 76, phase 1).
 *
 * `ink-arrival.ts` carries the argument for why she arrives as a drawing and the
 * whole of the staging maths; this is only the DOM.
 *
 * THREE THINGS THIS FILE IS CAREFUL ABOUT
 *
 * 1. IT IMPORTS THE MANGA, IT DOES NOT TOUCH IT. `EPILOGUE` was prepared by the
 *    manga lane and left deliberately unmounted ("exported so the ending lane can
 *    pick it up without re-deriving its geometry"). `MangaPageArt` is that lane's
 *    renderer. Nothing here forks either.
 *
 * 2. IT STAYS UNCLICKABLE. The overlay root is `pointerEvents: none` and the
 *    click model is canvas-first (`onPointerMissed` advances panels). A
 *    full-viewport page that swallowed taps would be exactly the blanket Task 61
 *    removed, so nothing here sets `pointerEvents` at all.
 *
 * 3. IT PRINTS COMPLETE. `instant` is passed so `MangaPageArt` skips its wall
 *    clock — see `ink-arrival.ts` for why that costs this page nothing and keeps
 *    the ending on one clock.
 *
 * The image is mounted from `INK_PRELOAD_T`, an ending-t beat before it is wanted,
 * at zero opacity: a ~250 kB webp fetched at the instant it is needed would pop in
 * half-drawn on a slow connection, and fetching it any earlier would put it on a
 * route the manga pipeline spent a round keeping it off.
 */
/**
 * The viewport's aspect, watched rather than read once.
 *
 * `usePrefersReducedMotion` reads its query a single time and argues that a
 * visitor who flips the OS setting mid-scroll is not worth a listener. Aspect is
 * different in kind, and after the audit fix it is different again: it does not
 * only choose between two beats, it SIZES the page, because the gap beside the
 * globe scales with 1/aspect. A page laid out for a ratio the window no longer has
 * is the very defect this listener exists to prevent.
 */
function useViewportAspect(): number {
  const [aspect, setAspect] = useState(16 / 9)
  useEffect(() => {
    const read = () => setAspect(window.innerWidth / Math.max(1, window.innerHeight))
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])
  return aspect
}

export function EndingInk({ t, reduced }: { t: number; reduced: boolean }) {
  const aspect = useViewportAspect()
  const lastT =
    aspect < 1 && INK_PLACEMENT.portraitOut ? INK_PLACEMENT.portraitOut.to : INK_PLACEMENT.outTo
  const mounted = t >= INK_PRELOAD_T && t < lastT
  if (!mounted) return null
  const ink = inkArrivalAt(t, reduced, aspect)

  const wrap: CSSProperties = {
    position: 'absolute',
    left: `${ink.x * 100}%`,
    top: `${ink.y * 100}%`,
    // Sized off the SHORTER axis so one number frames the page on a laptop and on
    // a phone: `min(vh, vw)` keeps a 2:3 sheet inside a 390-wide frame without a
    // second breakpoint.
    width: `calc(min(100vh, 100vw) * ${ink.height} * ${EPILOGUE.size.w / EPILOGUE.size.h})`,
    transform: `translate(-50%, -50%) translateY(${ink.lift * 100}vh) rotate(${ink.tilt}deg) scale(${ink.scale})`,
    opacity: ink.present,
    // Hidden rather than transparent when it is not in its window: an invisible
    // element still costs compositing, and this one is the size of the frame.
    visibility: ink.shown ? 'visible' : 'hidden',
    willChange: ink.present > 0 && ink.present < 1 ? 'transform, opacity' : undefined,
    // A printed page has an edge and a shadow; without them it reads as a texture
    // laid over the render rather than as a sheet in the room.
    boxShadow: '0 1.2vh 3.4vh rgba(60, 40, 48, 0.28)',
  }

  return (
    <div data-testid="sw-ending-ink" data-ink-present={ink.present.toFixed(3)} style={wrap}>
      <MangaPageArt page={EPILOGUE} running instant priority />
    </div>
  )
}

'use client'
import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import { isGoverned } from './arrival'
import {
  SNAP_CLASS,
  flingArmed,
  stopOffsets,
  storyStopsAvailable,
} from './story-stops'

/**
 * The story stops' browser half — story-stops.ts owns what they are, why the snap type is
 * mandatory, and where the two thresholds come from. This file is the wiring:
 *
 *  - one snap area per checkpoint inside the track,
 *  - the snap type on the root scroller, for exactly as long as a fling is in progress,
 *  - and the withdrawal of both on unmount, so no other route inherits a snapping document.
 *
 * THE AREAS' OFFSETS ARE MEASURED rather than written in `vh`. The track's height is in viewport
 * units while `trackOffsetFor` is against `scrollHeight − innerHeight`; on a mobile browser with a
 * collapsing toolbar those disagree by the toolbar's height, and an area placed with `calc` would
 * sit that far from where tap-to-advance and the e2e targets aim. Re-measured on every track
 * resize, which is also when the toolbar settles.
 *
 * THE ARMING RUNS OUTSIDE REACT. Velocity is read per `touchmove` and the class is written straight
 * onto the root element: a re-render per touch move would cost the whole journey a React pass at
 * exactly the moment the visitor is flinging it. The listeners are passive — nothing here can delay
 * or cancel a scroll, only decide where the platform's own animation is allowed to stop.
 */
/**
 * IT STANDS DOWN INSIDE A GOVERNED BEAT (Task 126).
 *
 * The snap's whole job is to stop a fling at the next checkpoint. Once the pace
 * governor has hold of the reader that job is already done — and the two would
 * otherwise pull against each other, because a stop sits at the dwell's middle
 * (local 0.49) while the governed span ends at local 0.43. `scroll-snap-type:
 * mandatory` re-snaps after a programmatic scroll, so the leash writing the
 * document back to its ceiling would be answered by the platform dragging it
 * forward to the stop, every frame, for the length of the beat.
 *
 * The stand-down is one-directional and cheap: the class is never ARMED while the
 * world is governed, and is dropped if the world becomes governed while it is on.
 * A fling that has not reached a checkpoint yet is untouched, which is every fling
 * the feature was built for.
 */
export function StoryStopSnap({
  trackRef,
  progressRef,
}: {
  trackRef: RefObject<HTMLElement | null>
  progressRef: MutableRefObject<number>
}) {
  const [available, setAvailable] = useState(false)
  const [offsets, setOffsets] = useState<number[]>([])
  const offsetsRef = useRef<number[]>([])
  offsetsRef.current = offsets

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setAvailable(storyStopsAvailable(coarse.matches, reduced.matches))
    update()
    coarse.addEventListener('change', update)
    reduced.addEventListener('change', update)
    return () => {
      coarse.removeEventListener('change', update)
      reduced.removeEventListener('change', update)
    }
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!available || !el) return
    const measure = () => setOffsets(stopOffsets(el.scrollHeight - window.innerHeight))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [available, trackRef])

  useEffect(() => {
    if (!available) return
    const root = document.documentElement
    let prevY = 0
    let prevT = 0
    let lastY = 0
    let lastT = 0
    let quiet = 0

    const disarm = () => root.classList.remove(SNAP_CLASS)

    // A new touch cancels whatever the platform was doing, and this gesture has to earn the snap
    // on its own velocity — so every gesture starts disarmed.
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      prevY = lastY = t.clientY
      prevT = lastT = e.timeStamp
      disarm()
    }

    // Velocity over the LAST move only. A gesture-long average would still read "slow" several
    // moves into a flick, which is exactly the window the arming has to land in.
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0]
      const stops = offsetsRef.current
      if (!t || stops.length === 0) return
      prevY = lastY
      prevT = lastT
      lastY = t.clientY
      lastT = e.timeStamp
      const dt = Math.max(1, lastT - prevT)
      const velocity = ((lastY - prevY) / dt) * 1000
      const trackTop = (trackRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY
      const lastStopY = trackTop + stops[stops.length - 1]
      if (flingArmed(velocity, window.scrollY, lastStopY) && !isGoverned(progressRef.current))
        root.classList.add(SNAP_CLASS)
      else disarm()
    }

    // Let go once the page has come to rest, so nothing that is not a fling — a programmatic
    // scroll, the tap-to-advance glide, an anchor jump — ever finds the snap type armed.
    const onScroll = () => {
      // Entering a governed beat drops it on the spot rather than 240 ms later:
      // the frames in between are exactly the ones the leash and the platform
      // would have spent fighting over the document.
      if (isGoverned(progressRef.current)) disarm()
      window.clearTimeout(quiet)
      quiet = window.setTimeout(disarm, 240)
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(quiet)
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('scroll', onScroll)
      disarm()
    }
  }, [available, trackRef])

  if (!available) return null

  return (
    <>
      <style>{`html.${SNAP_CLASS}{scroll-snap-type:y mandatory}`}</style>
      {offsets.map((top, chapter) => (
        <div
          key={chapter}
          data-sw-stop={chapter}
          aria-hidden
          style={{
            position: 'absolute',
            top,
            left: 0,
            width: 1,
            height: 1,
            pointerEvents: 'none',
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
          }}
        />
      ))}
    </>
  )
}

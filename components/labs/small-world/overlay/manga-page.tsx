'use client'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { mangaPageSrc, type MangaPage } from '../manga/types'
import { FINISHED, panelInk, typedLength } from '../manga/reveal'
import { PALETTE } from '../palette'
import { BalloonText, CaptionBox } from './manga-lettering'

/**
 * One manga page, inking itself in.
 *
 * THE PAGE IS ONE IMAGE, DRAWN SEVERAL TIMES. Each panel is the same `<img>`
 * clipped to its own rectangle, so the browser makes one request and one decode
 * and the panels are exact crops of the printed page — gutters, borders and the
 * splash's overlapping insets included, with no per-panel asset to keep in sync.
 * They arrive in reading order against the blank paper of the card, which is
 * what makes the reveal read as a page being drawn rather than as a picture
 * fading up.
 *
 * The `loading`/`decoding` hints matter more than they look: this component
 * only mounts when its checkpoint is close (see `manga-card.tsx`), so the
 * request is the point at which the page enters the payload at all.
 */
export function MangaPageArt({
  page,
  /** Held at 0 until the card is most of the way in, then released. */
  running,
  /** Reduced motion, or a page shown in the lightbox: skip straight to finished. */
  instant = false,
  priority = false,
}: {
  page: MangaPage
  running: boolean
  instant?: boolean
  priority?: boolean
}) {
  const elapsed = useRevealClock(running, instant)

  const rootStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    aspectRatio: `${page.size.w} / ${page.size.h}`,
    // The page is the container every piece of lettering sizes itself against
    // (`cqw` in manga-lettering), which is what lets one manifest serve the
    // card, the lightbox and the phone from a single set of fractions.
    containerType: 'inline-size',
    background: PALETTE.sky,
    overflow: 'hidden',
  }

  return (
    <div style={rootStyle} data-testid="sw-manga-page" data-manga-page={page.id}>
      {page.panels.map((rect, i) => {
        const ink = panelInk(i, elapsed)
        if (ink <= 0) return null
        const inset = `${rect.y * 100}% ${(1 - rect.x - rect.w) * 100}% ${(1 - rect.y - rect.h) * 100}% ${rect.x * 100}%`
        const style: CSSProperties = {
          position: 'absolute',
          inset: 0,
          clipPath: `inset(${inset})`,
          opacity: ink,
          // Scaled about the panel's OWN centre so each frame settles into place
          // instead of sliding in from the page's middle.
          transformOrigin: `${(rect.x + rect.w / 2) * 100}% ${(rect.y + rect.h / 2) * 100}%`,
          transform: `scale(${0.955 + 0.045 * ink})`,
          willChange: ink < 1 ? 'opacity, transform' : undefined,
        }
        return (
          <div key={`${page.id}-p${i}`} style={style} data-manga-panel={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mangaPageSrc(page.id)}
              alt=""
              width={page.size.w}
              height={page.size.h}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
            {/* PINK TRIM: the frame that is currently landing is ruled in the lab
                pink, which fades out as the panel settles to printed ink. It is
                the page's one moving accent and it marks the reading order. */}
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
                boxSizing: 'border-box',
                border: `0.5cqw solid ${PALETTE.blossomDeep}`,
                opacity: ink < 1 ? 1 - ink * ink : 0,
                pointerEvents: 'none',
              }}
            />
          </div>
        )
      })}

      {page.balloons.map((balloon, i) => {
        if (panelInk(balloon.panel, elapsed) <= 0) return null
        const shown = typedLength(balloon.text, balloon.panel, elapsed)
        if (shown <= 0 && !balloon.drawn) return null
        return <BalloonText key={`${page.id}-b${i}`} balloon={balloon} page={page} shown={shown} />
      })}

      {page.captions.map((caption, i) => {
        const shown = typedLength(caption.text, caption.panel, elapsed)
        if (shown <= 0) return null
        return <CaptionBox key={`${page.id}-c${i}`} caption={caption} page={page} shown={shown} />
      })}
    </div>
  )
}

/**
 * Milliseconds since the page started inking.
 *
 * Ticks on rAF only while the reveal is unfinished, then stops: a parked
 * checkpoint costs nothing. `instant` (reduced motion, or the lightbox, which
 * shows a page the reader has already watched arrive) skips the clock entirely
 * rather than fast-forwarding it, so no frame of animation is scheduled at all.
 */
function useRevealClock(running: boolean, instant: boolean): number {
  const [elapsed, setElapsed] = useState(instant ? FINISHED : 0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (instant) {
      setElapsed(FINISHED)
      return
    }
    if (!running) {
      startRef.current = null
      setElapsed(0)
      return
    }
    let raf = 0
    let stopped = false
    const tick = (now: number) => {
      if (stopped) return
      if (startRef.current === null) startRef.current = now
      const next = now - startRef.current
      setElapsed(next)
      // 6s is past the longest page (4 panels + the longest line); once there,
      // stop scheduling frames rather than idling for the rest of the dwell.
      if (next < 6000) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
    }
  }, [running, instant])

  return elapsed
}

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
/**
 * WHAT THE 11px FLOOR COSTS, AND WHERE IT IS PAID BACK.
 *
 * Below ~340px of page the floor stops the lettering scaling down with the art, so the type is
 * suddenly LARGE relative to its box — and a caption box sized as a fraction of the page becomes a
 * tall thin column of two-word lines. So on a narrow page the narrator boxes get most of their
 * panel's width instead of their manifest fraction.
 *
 * A container query rather than a viewport one, because the page — not the window — is what the
 * lettering is sized against: the same rule then covers the phone stack AND the phone lightbox AND
 * any future small mount, and leaves the desktop card and its lightbox at the geometry the round
 * already verified.
 */
const NARROW_PAGE_STYLES = `
  @container (max-width: 340px) {
    .sw-manga-caption {
      /* Twice its authored width, but never past the page: a caption that starts
         halfway across has only the remainder to grow into, and 3% of trailing
         margin keeps it off the page's own edge. */
      width: min(calc(var(--sw-cap-w) * 2), calc(97% - var(--sw-cap-x))) !important;
      padding: 1.6cqw 1.8cqw !important;
      border-width: 0.5cqw !important;
      border-left-width: 1.8cqw !important;
    }
  }
`

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
    // The BLANK PAPER the panels ink onto, and it has to be the paper the pages
    // are actually printed on — `pagePaper`, measured. It was `sky`, so the first
    // second of every reveal showed a warm cream sheet that the arriving art then
    // covered with a near-white one (Task 74).
    background: PALETTE.pagePaper,
    overflow: 'hidden',
  }

  return (
    <div style={rootStyle} data-testid="sw-manga-page" data-manga-page={page.id}>
      <style>{NARROW_PAGE_STYLES}</style>
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
        return <CaptionBox key={`${page.id}-c${i}`} caption={caption} shown={shown} />
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

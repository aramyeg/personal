'use client'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { mangaPageSrc, type MangaPage, type Point, type Rect } from '../manga/types'
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

/**
 * THE DONATED PANEL, AND WHAT THE LEAF DOES WITH THE HOLE IT LEAVES.
 *
 * The right-hand leaf anchors itself on one panel of the chapter's own printed
 * page (`info-page-spec.ts` → `DONATED_PANEL`). Aram's rule is that no panel may
 * appear on BOTH leaves, so the story leaf leaves that panel out — and a page
 * with a panel simply missing is a page with a hole in it, which is worse than
 * the duplication was.
 *
 * So the remainder is RE-PASTED: the surviving panels' shared bounding box is
 * mapped onto the leaf with a UNIFORM scale and centred. Uniform is the whole
 * point — a stretch to fill both axes would print her at a different aspect on
 * every chapter, which is the one thing a page of ink may never do. Whatever the
 * uniform fit does not cover stays blank paper, which is what a manga page's own
 * margin is anyway.
 *
 * Because the root box carries the PAGE's aspect, one scale factor in page
 * fractions is one scale factor in pixels on both axes — no per-axis correction,
 * and no chance of a silent squash creeping in through the aspect mismatch.
 */
export type LeafFit = {
  /** The surviving panels' shared bounding box, in page fractions. */
  bbox: Rect
  /** Uniform page-fraction scale that fits `bbox` inside the leaf. */
  scale: number
  /** Where the scaled bbox's top-left lands, in leaf fractions. */
  offset: Point
}

const boundingBox = (rects: readonly Rect[]): Rect => {
  const x = Math.min(...rects.map((r) => r.x))
  const y = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...rects.map((r) => r.x + r.w))
  const bottom = Math.max(...rects.map((r) => r.y + r.h))
  return { x, y, w: right - x, h: bottom - y }
}

/**
 * The transform the leaf applies when a panel has been donated away.
 *
 * `null` means "print the page as it is": no omission asked for, an index that
 * is not a panel, or nothing left to paste. That null is what keeps the
 * un-omitted leaf and the lightbox on exactly today's code path.
 */
export function redistributeFit(panels: readonly Rect[], omit: number | undefined): LeafFit | null {
  if (omit === undefined || !Number.isInteger(omit) || omit < 0 || omit >= panels.length) return null
  const kept = panels.filter((_, i) => i !== omit)
  if (kept.length === 0) return null
  const bbox = boundingBox(kept)
  if (bbox.w <= 0 || bbox.h <= 0) return null
  const scale = Math.min(1 / bbox.w, 1 / bbox.h)
  return {
    bbox,
    scale,
    offset: { x: (1 - scale * bbox.w) / 2, y: (1 - scale * bbox.h) / 2 },
  }
}

/**
 * A page-fraction point as the reader sees it, in leaf fractions.
 *
 * Everything on the leaf — panel rects, balloon boxes, caption corners — moves
 * through this one map, which is the registration guarantee: the lettering
 * cannot drift off its balloon because it is not transformed separately, it is
 * carried by the same wrapper the art is.
 */
export const fitPoint = (fit: LeafFit | null, p: Point): Point =>
  fit
    ? { x: fit.offset.x + (p.x - fit.bbox.x) * fit.scale, y: fit.offset.y + (p.y - fit.bbox.y) * fit.scale }
    : p

/** ...and a rect through the same map. */
export const fitRect = (fit: LeafFit | null, r: Rect): Rect => {
  const { x, y } = fitPoint(fit, r)
  return fit ? { x, y, w: r.w * fit.scale, h: r.h * fit.scale } : { ...r }
}

export function MangaPageArt({
  page,
  /** Held at 0 until the card is most of the way in, then released. */
  running,
  /** Reduced motion, or a page shown in the lightbox: skip straight to finished. */
  instant = false,
  priority = false,
  /**
   * The panel this chapter has donated to the info leaf, if any. Left undefined
   * — as the lightbox deliberately leaves it — the page prints complete.
   */
  omitPanel,
}: {
  page: MangaPage
  running: boolean
  instant?: boolean
  priority?: boolean
  omitPanel?: number
}) {
  const elapsed = useRevealClock(running, instant)
  const fit = redistributeFit(page.panels, omitPanel)
  /** Normalised: an index the fit rejected omits nothing. */
  const omitted = fit ? omitPanel : undefined

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

  const body = (
    <>
      {page.panels.map((rect, i) => {
        if (i === omitted) return null
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
        if (balloon.panel === omitted) return null
        if (panelInk(balloon.panel, elapsed) <= 0) return null
        const shown = typedLength(balloon.text, balloon.panel, elapsed)
        if (shown <= 0 && !balloon.drawn) return null
        return <BalloonText key={`${page.id}-b${i}`} balloon={balloon} page={page} shown={shown} />
      })}

      {page.captions.map((caption, i) => {
        if (caption.panel === omitted) return null
        const shown = typedLength(caption.text, caption.panel, elapsed)
        if (shown <= 0) return null
        return <CaptionBox key={`${page.id}-c${i}`} caption={caption} shown={shown} />
      })}
    </>
  )

  return (
    <div style={rootStyle} data-testid="sw-manga-page" data-manga-page={page.id}>
      <style>{NARROW_PAGE_STYLES}</style>
      {/* ART, LETTERING AND TRIM MOVE TOGETHER OR NOT AT ALL. With no donated
          panel there is no wrapper at all, so the complete page — the lightbox's
          case — renders through exactly the markup it always did. */}
      {fit ? (
        <div data-testid="sw-manga-fit" data-manga-fit={omitted} style={fitStyle(fit)}>
          {body}
        </div>
      ) : (
        body
      )}
    </div>
  )
}

/**
 * The re-paste, as one CSS transform.
 *
 * Read right to left, the way the browser composes it: put the bbox's corner at
 * the origin, scale uniformly, then drop the result at its centred offset. The
 * percentages resolve against the wrapper's own box — which is the leaf — so
 * `-bbox.x * 100%` is exactly `-bbox.x` of a page width, and the same for y.
 */
function fitStyle(fit: LeafFit): CSSProperties {
  const { bbox, scale, offset } = fit
  return {
    position: 'absolute',
    inset: 0,
    transformOrigin: '0 0',
    transform: `translate(${offset.x * 100}%, ${offset.y * 100}%) scale(${scale}) translate(${-bbox.x * 100}%, ${-bbox.y * 100}%)`,
  }
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

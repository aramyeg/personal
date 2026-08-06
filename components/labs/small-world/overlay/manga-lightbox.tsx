'use client'
import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { MangaPage } from '../manga/types'
import { PALETTE } from '../palette'
import { MangaPageArt } from './manga-page'

/**
 * The page, full size, over everything.
 *
 * THIS IS THE ONE THING ALLOWED TO BLANKET THE CANVAS, and only while it is
 * open. Task 61's rule is that the lab must not leave an invisible full-frame
 * click catcher over the canvas during normal reading — a modal that the
 * visitor deliberately opened is the opposite case, and it wants every click:
 * anywhere outside the page closes it, and because the backdrop consumes the
 * event the canvas never sees it, so tap-to-advance cannot fire underneath.
 * It unmounts on close, taking its pointer surface with it.
 *
 * The page renders `instant`: the reader has already watched it ink in on the
 * card, and replaying the reveal here would make them wait to see the thing
 * they just asked to see.
 */
/** Backdrop padding, named once — the frame's width has to subtract exactly this. */
const PAD = 'min(4vh, 28px)'

export function MangaLightbox({
  page,
  chapterNumber,
  onClose,
}: {
  page: MangaPage
  /** 1-based, for the label a screen reader actually reads out. */
  chapterNumber: number
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // The lab's Escape protocol (see `gallery-chrome.tsx` and the curator's
      // `use-esc-capture.ts`): claim the key in the CAPTURE phase and mark it
      // handled with preventDefault, which the chrome's bubble listener checks
      // via `defaultPrevented` before navigating away. Without this, closing the
      // page would also leave the lab for the museum.
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    closeRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [onClose])

  const backdrop: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 40,
    background: 'rgba(20, 18, 24, 0.82)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: PAD,
    pointerEvents: 'auto',
    cursor: 'zoom-out',
  }

  /**
   * THE FRAME IS SIZED, THE HEIGHT IS NOT SET, AND THAT IS THE FIX.
   *
   * It used to carry `height`, `aspect-ratio` and `max-width` at once and let them argue. On a
   * phone they did: the flex line clamped the WIDTH to the padded viewport (334px) while the
   * explicit height held at 561.59, so the box resolved to aspect 0.5947 while the page inside it
   * is 0.6667 — leaving 72.6px of the frame's own cream background under the last panel, which
   * the review read, fairly, as a loading error. Desktop leaked 12px of the same thing.
   *
   * Now only the WIDTH is declared and the height comes from the content, so the frame is whatever
   * the page turns out to be plus its border — a gap is not expressible. The width is the smaller
   * of what the padded viewport allows and what the padded viewport's HEIGHT allows once the
   * border is accounted for, so a 2:3 page is height-limited on a landscape screen and
   * width-limited on a phone, without either being a special case.
   *
   * `flexShrink: 0` is load-bearing: without it the flex line is free to shrink the frame below
   * the width computed here, which is exactly how the old geometry lost its aspect.
   */
  const border = 4
  const aspect = page.size.w / page.size.h
  const frame: CSSProperties = {
    width: `min(calc(100vw - 2 * ${PAD}), calc((100vh - 2 * ${PAD} - ${2 * border}px) * ${aspect} + ${2 * border}px))`,
    flexShrink: 0,
    boxSizing: 'border-box',
    border: `${border}px solid ${PALETTE.ink}`,
    borderRadius: 6,
    boxShadow: `0 24px 60px rgba(0,0,0,0.5)`,
    background: PALETTE.sky,
    overflow: 'hidden',
    cursor: 'default',
    lineHeight: 0, // no inline-descender strip under the page
  }

  return (
    <div
      style={backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Chapter ${chapterNumber} comic page, full size`}
      data-testid="sw-manga-lightbox"
    >
      <div data-sw-lightbox-frame="" style={frame} onClick={(e) => e.stopPropagation()}>
        <MangaPageArt page={page} running instant priority />
      </div>
      {/* A DRAWN CROSS, not a glyph. This was `×` set in `--sw-font-panel`, which is Bangers — a
          slanted comic face — so the control rendered as a leaning lowercase x with subpixel
          colour fringing on its stroke. A close button is chrome, not lettering: two strokes at
          exact 45 degrees, `shapeRendering="geometricPrecision"` so the diagonals stay clean, and
          `currentColor` so it holds up against either background it can land on. */}
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close the page"
        style={{
          position: 'absolute',
          top: 'min(3vh, 20px)',
          right: 'min(3vw, 24px)',
          display: 'grid',
          placeItems: 'center',
          width: 44,
          height: 44,
          padding: 0,
          borderRadius: 999,
          border: `3px solid ${PALETTE.ink}`,
          background: PALETTE.sky,
          color: PALETTE.ink,
          cursor: 'pointer',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false" shapeRendering="geometricPrecision">
          <path
            d="M3 3 L15 15 M15 3 L3 15"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </button>
    </div>
  )
}
